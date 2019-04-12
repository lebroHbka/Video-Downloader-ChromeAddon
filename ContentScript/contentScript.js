

//region LinkedIn Classes
class LinkedInVideoItem {
    static sourceVideoPattern = /(https\:\/\/files\d+\.lynda\.com\/secure\/courses\/\d{1,10}\/VBR_MP4h264.+?)&quot/gi;
    static videoLinkNameWithoutQuery = /https\:\/\/files\d+\.lynda\.com\/secure\/courses\/\d{1,10}\/VBR_MP4h264.+?\/(.+?)\.mp4/i;
    static checkLockPattern = "li-icon[type='lock-icon']";
    static blackListVideoName = [];     // need for _filterVideoLinkRule3

    domNode;
    isVideoDownloadable = false;

    _videoSourcePageLink = "";      // link <a> from DOM node video element
    _videoDownloadLink = "";    // <source> link from page
    _videoName = "";
    _videoDownloadPagePromise;   // promise return html page


    constructor(domNode) {
        if(!domNode){
            this._videoItemInitializedWithOutNode();
            return;
        }
        this.domNode = domNode;         // dom element with .video-item
        this._videoSourcePageLink = this.domNode.querySelector("a").href;

        this._configureIsVideoDownloadable();
        this._downloadVideoPage();
    }

    get videoName() {
        if (!this._videoName) {
            this._videoName = this.domNode.querySelector(".toc-item__content").firstChild.textContent;
        }
        return this._videoName;
    }

    set videoDownloadLink(value) {
        if (!value) {
            console.error("Video download link is null or empty");
        } else {
            this._videoDownloadLink = value;
            LinkedInVideoItem.blackListVideoName.push(this._simplifyLinkName(value));
        }
    }

    get videoDownloadLink() {
        return this._videoDownloadLink;
    }

    // region Public methods

    getLinkForDownloadAsync() {
        return new Promise((resolve, rejected) => {
            if(!this.isVideoDownloadable) {
                rejected({error: "videoIsNotDownloadable"});
            } else {
                this._videoDownloadPagePromise.then(() => {
                    resolve(this.videoDownloadLink)        // videoDownloadLink is initialized in previous promise stage
                });
            }
        });
    }

    // endregion


    //region Private methods

    _configureIsVideoDownloadable() {
        if (!this.domNode.querySelector(LinkedInVideoItem.checkLockPattern)) {
            this.isVideoDownloadable = true;
        }
    }

    _downloadVideoPage() {
        if(!this.isVideoDownloadable) {
            return;
        }
        this._videoDownloadPagePromise = this._getVideoDownloadPagePromise();
        this._videoDownloadPagePromise.then(this._afterVideoPageDownloaded.bind(this), this._downloadVideoSourcePageError);
    }

    _getVideoDownloadPagePromise() {
        var promise = new Promise((resolve, rejected) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", this._videoSourcePageLink, true);
            xhr.onload = function() {
                if(this.status === 200) {
                    resolve(this.responseText);
                } else {
                    rejected(this)
                }
            };
            xhr.send();
        });
        return promise;
    }

    _afterVideoPageDownloaded(htmlPage){
        this.videoDownloadLink = this._getVideoDownloadLink(htmlPage);     // now this._videoDownloadLink is initialized
    }

    _getVideoDownloadLink(htmlPage) {
        let matches;
        let links = [];
        let result;
        while((matches = LinkedInVideoItem.sourceVideoPattern.exec(htmlPage)) !== null) {
            links.push(matches[1]);
        }
        if(!links.length) {
            this._noLinksInDownloadedPageError();
        }
        result = this._filterVideoLinkByRules(links);
        return result;
    }

    _filterVideoLinkByRules(links) {
        let result;

        result = this._filterVideoLinkByDuplicate(links);
        if (result.length > 1) {
            result = result.filter(v => this._filterVideoLinkByBlackList(v));
        }

        if(result.length !== 1) {
            this._linksNotFilteredByRulesError();
        }

        return result[0];
    }

    _filterVideoLinkByDuplicate(linksArray) {
        let simplifyLinks = linksArray.map((link) => {
            return this._simplifyLinkName(link);
        });

        if ( [...new Set(simplifyLinks)].length === 1) {
            return [linksArray[0]];
        } else {
            return linksArray;
        }
    }

    _filterVideoLinkByBlackList(link) {
        let isSomeVideoInBlackList = LinkedInVideoItem.blackListVideoName.some((v) => {
            return !!~link.indexOf(v);
        });
        return !isSomeVideoInBlackList;
    }

    _simplifyLinkName(link) {
        return LinkedInVideoItem.videoLinkNameWithoutQuery.exec(link)[1];
    }

    //endregion


    // region Error messages

    _downloadVideoSourcePageError(response) {
        console.error(`getPromiseDownloadFromLink (finished with code ${response.status})`);
    }

    _noLinksInDownloadedPageError() {
        console.error("Links was not found in html page");
    }

    _linksNotFilteredByRulesError() {
        console.error("Links not filtered by rules");
    }

    _videoItemInitializedWithOutNode() {
        console.error("Video item initialized without dom node in constructor");
    }

    // endregion
}


class LinkedInVideoManager {
    static _videoManager;
    _videoItemsList = [];
    _videoItemPattern = ".video-item";
    _videoNodes;
    _initializeManagerSyncInterval = 500;
    _initializeManagerMaxRepeatTimes = 10;
    _videoNodesInitializePromise;


    constructor() {
        this._initializeVideoItemsAsync();
    }

    static get defaultVideoManager() {
        if(!this._videoManager) {
            this._videoManager = new LinkedInVideoManager();
        }
        return this._videoManager;
    }

    get videoNodes() {
        if (!this._videoNodes) {
            this._videoNodes = document.querySelectorAll(this._videoItemPattern);
        }
        return this._videoNodes;
    }


    //region Public methods

    getVideoUrlByNumberAsync(number) {
        return new Promise((resolve, rejected) => {
            this._videoNodesInitializePromise.then(() => {
                if (!this._videoItemsList[number]) {
                    rejected({error: `No video with such number "${number}"`});
                } else {
                    this._videoItemsList[number].getLinkForDownloadAsync().then(resolve, rejected);
                }
            });
        });
    }

    getCurrentVideoUrlAsync() {
        let number = this._findVideoNumberOfCurrentPage();
        return this.getVideoUrlByNumberAsync(number);
    }

    getAllDownloadableVideosUrlsAsync() {
        return new Promise((resolve, rejected) => {
            this._videoNodesInitializePromise.then(() => {
                let videoItemsPromisesList = [];
                for (let i = 0; i < this._videoItemsList.length; i++) {
                    if(this._videoItemsList[i].isVideoDownloadable) {
                        videoItemsPromisesList.push(this.getVideoUrlByNumberAsync(i));
                    }
                }
                Promise.all(videoItemsPromisesList).then(resolve, rejected);
            });
        });
    }

    getAllVideoNamesListAsync() {
        return new Promise(resolve => {
            this._videoNodesInitializePromise.then(() => {
                let videosNames = this._videoItemsList.map((v) => v.videoName);
                resolve(videosNames);
            });
        });
    }

    //endregion


    //region Private methods

    _initializeVideoItemsAsync() {
        this._videoNodesInitializePromise = this._getVideoNodesInitializePromise();
        this._videoNodesInitializePromise.then(this._initializeFirstVideo.bind(this))
                                         .then(this._initializeVideoItemsList.bind(this), this._videoNodesInitializeError.bind(this));

    }

    _getVideoNodesInitializePromise() {
        let promise = new Promise((resolve, reject) => {
            let recurInitializeFunc = (repeatNumber) => {
                if(repeatNumber >= this._initializeManagerMaxRepeatTimes) {
                    reject();
                    return;
                }

                if(this.videoNodes.length) {
                    resolve();
                }
                 else {
                    setTimeout(recurInitializeFunc.bind(this,repeatNumber + 1), this._initializeManagerSyncInterval);
                }
            };

            setTimeout(recurInitializeFunc.bind(this, 0), this._initializeManagerSyncInterval);
        });

        return promise;
    }

    // need for initialize blackListVideoName in VideoItem
    _initializeFirstVideo() {
        let videoNode = new LinkedInVideoItem(this.videoNodes[0]);
        this._videoItemsList.push(videoNode);
        return new Promise(resolve => {
            videoNode.getLinkForDownloadAsync().then(() => {
                resolve();
            });
        });
    }

    _initializeVideoItemsList() {
        for (let i = 1; i < this.videoNodes.length; i++) {
            let videoNode = new LinkedInVideoItem(this.videoNodes[i]);
            this._videoItemsList.push(videoNode);
        }
    }

    _findVideoNumberOfCurrentPage() {
        let currentPageNumber = undefined;
        [].forEach.call(this.videoNodes, (node, index) => {
            if (node.querySelector(".toc-item.active")) {
                currentPageNumber = index;
            }
        });

        return currentPageNumber;
    }

    //endregion


    // region Error messages

    _videoNodesInitializeError() {
        console.error(`Video items wasn't found with pattern "${this._videoItemPattern}"`);
    }

    //endregion

}
//endregion



class AddOnRunner {

    _videoManager;

    // region Public methods

    start() {
        this._initializeManager();
        this._subscribeForMessages();
    }

    //endregion


    //region Private methods

    _initializeManager() {
        switch (document.domain) {
            case "www.linkedin.com":
                this._videoManager = LinkedInVideoManager.defaultVideoManager;
                break;
            default:
                console.log("No manager for current domain. Manager not initialized");
                break;
        }
        if (this._videoManager) {
            console.log("Manager initialized");
        }
    }

    _subscribeForMessages() {
        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
                switch(request.type){
                    case "getDomain":
                        this._responseCurrentDomain(sendResponse.bind(this));
                        break;
                    case "getVideoUrlByNumber":
                        this._responseGetVideoUrlByNumber(request, sendResponse.bind(this));
                        break;
                    case "getCurrentVideoUrl":
                        this._responseGetCurrentVideoUrl(sendResponse.bind(this));
                        break;
                    case "getAllDownloadableVideosUrls":
                        this._responseGetAllDownloadableVideosUrls(sendResponse.bind(this));
                        break;
                    case "getVideoNamesList":
                        this._responseGetVideoNamesList(sendResponse.bind(this));
                        break;
                    default:
                        this._responseNoSuchMsgType(sendResponse.bind(this));
                        break;
                }
                return true;
            });
    }


    _responseCurrentDomain(sendResponse) {
        sendResponse(document.domain);
    }

    _responseGetVideoUrlByNumber(request, sendResponse) {
        if (typeof request.number === "number") {
            this._videoManager.getVideoUrlByNumberAsync(request.number).then(sendResponse, this._getVideoUrlByNumberError.bind(sendResponse));
        } else {
            console.error(`message 'downloadVideo' has incorrect request.number - ${request.number}`);
        }
    }

    _responseGetCurrentVideoUrl(sendResponse) {
        this._videoManager.getCurrentVideoUrlAsync().then(sendResponse, this._getCurrentVideoUrlError.bind(sendResponse));
    }

    _responseGetVideoNamesList(sendResponse) {
        this._videoManager.getAllVideoNamesListAsync().then(sendResponse);
    }

    _responseGetAllDownloadableVideosUrls(sendResponse) {
        this._videoManager.getAllDownloadableVideosUrlsAsync().then(sendResponse, this._getAllDownloadableVideosUrlsError.bind(sendResponse));
    }

    _responseNoSuchMsgType(sendResponse) {
        sendResponse({error: "responseNoSuchMsgType"})
    }

    //endregion


    //region Error messages

    _getVideoUrlByNumberError(sendResponse, e) {
        console.error(`getVideoUrlByNumberAsync ended with error: "${e.error}"`);
        sendResponse();
    }

    _getCurrentVideoUrlError(sendResponse, e) {
        console.error(`getCurrentVideoUrlAsync ended with error: "${e.error}"`);
        sendResponse();
    }

    _getAllDownloadableVideosUrlsError(sendResponse, e) {
        console.error(`getAllDownloadableVideosUrlsAsync ended with error: "${e.error}"`);
        sendResponse();
    }

    //endregion
}





new AddOnRunner().start();


