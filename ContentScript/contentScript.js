

//region LinkedIn Classes
class LinkedInVideoItem {
    static sourceVideoPattern = /(https\:\/\/files\d+\.lynda\.com\/secure\/courses\/\d{1,10}\/VBR_MP4h264.+?)&quot/gi;
    static checkLockPattern = "li-icon[type='lock-icon']";

    domNode;
    isVideoDownloadable = false;

    _videoSourcePageLink = "";      // link <a> from DOM node video element
    _videoDownloadLink = "";    // <source> link from page
    _videoName = "";
    _videoDownloadPagePromise;   // promise return html page


    constructor(domNode) {
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
        }
    }

    get videoDownloadLink() {
        return this._videoDownloadLink;
    }



    getLinkForDownloadAsync(callBack) {
        if(!this.isVideoDownloadable) {
            callBack({error: "videoIsNotDownloadable"});
        } else {
            this._videoDownloadPagePromise.then(() => {
               callBack(this.videoDownloadLink)        // videoDownloadLink is initialized in previous promise stage
            });
        }
    }

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
        this._videoDownloadPagePromise.then(this._afterVideoPageDownloaded.bind(this), (status) => {console.error(`getPromiseDownloadFromLink (finished with code ${status})`);});
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
        let result, name;
        while((matches = LinkedInVideoItem.sourceVideoPattern.exec(htmlPage)) !== null) {
            links.push(matches[1]);
        }
        result = this._filterVideoLinkByRules(links, this.videoName.split(" "));
        return result;
    }

    _filterVideoLinkByRules(links, words) {
        let result;
        result = links.filter((link) => {
            return this._filterVideoLinkRule1(link, words);
        });

        if (result.length === 1) {
            return result[0];
        }

        result = links.filter((link) => {
            return this._filterVideoLinkRule2(link, words);
        });

        if (result.length === 1) {
            return result[0];
        }

    }

    _filterVideoLinkRule1(link, words) {
        let match = 0;
        let tlink = link.toLowerCase();
        let tWords = words.map((w) => w.toLowerCase());
        let minWordsMatchCount = tWords.length > 2 ? 2 : 1;

        for (let i = 0; i < words.length; i++) {
            if (~tlink.indexOf(tWords[i])) {
                match++;
            }
        }
        return match >= minWordsMatchCount;
    }

    _filterVideoLinkRule2(link, words) {
        let tlink = link.toLowerCase();
        return words.some((w) => tlink.indexOf(w.toLowerCase() > -1));
    }
}


class LinkedInVideoManager {
    static _videoManager;
    _videoItemsList = [];
    _videoItemPattern = ".video-item";
    _videoNodes;
    _initializeManagerSyncInterval = 500;
    _initializeManagerMaxRepeatTimes = 10;
    _videoNodesInitializePromise;

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


    constructor() {
        this._initializeVideoItemsAsync();
    }

    getVideoUrlByNumberAsync(number, callBack) {
        this._videoNodesInitializePromise.then(() => {
            if (!this._videoItemsList[number]) {
                callBack({error: "No video with such number"});
            } else {
                this._videoItemsList[number].getLinkForDownloadAsync(callBack);
            }
        });

    }

    getCurrentVideoUrlAsync(callBack) {
        this._videoNodesInitializePromise.then(() => {
            let number = this._findVideoNumberOfCurrentPage();
            if (number !== undefined) {
                this.getVideoUrlByNumberAsync(number, callBack);
            }
        });

    }

    getAllVideosUrlsAsync(callBack) {
        // after initialize
    }


    _initializeVideoItemsAsync() {
        this._videoNodesInitializePromise = this._getVideoNodesInitializePromise();
        this._videoNodesInitializePromise.then(this._initializeVideoItemsList.bind(this), this._videoItemsNotFound.bind(this));

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

    _initializeVideoItemsList() {
        for (let i = 0; i < this.videoNodes.length; i++) {
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

    _videoItemsNotFound() {
        console.error(`Video items wasn't found with pattern "${this._videoItemPattern}"`);
    }

}
//endregion



class AddonRunner {

    _videoManager;

    start() {
        this._subscribeForMessages();
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
                    case "initializeManager":
                        this._initializeManager(sendResponse.bind(this));
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
        if(!this._videoManager) {
            sendResponse();
            return;
        }
        if (typeof request.number === "number") {
            this._videoManager.getVideoUrlByNumberAsync(request.number, sendResponse);
        } else {
            console.error(`message 'downloadVideo' has incorrect request.number - ${request.number}`);
        }
    }

    _responseGetCurrentVideoUrl(sendResponse) {
        this._videoManager.getCurrentVideoUrlAsync(sendResponse);
    }

    _initializeManager(sendResponse) {
        switch (document.domain) {
            case "www.linkedin.com":
                this._videoManager = LinkedInVideoManager.defaultVideoManager;
                break;
        }
        console.log("initialized");
        sendResponse();
    }

    _responseNoSuchMsgType(sendResponse) {
        sendResponse({error: "responseNoSuchMsgType"})
    }
}





new AddonRunner().start();


