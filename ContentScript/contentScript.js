

//region LinkedIn Classes
class LinkedInVideoItem {
    static sourceVideoPattern = /(https\:\/\/files\d+\.lynda\.com\/secure\/courses\/\d{1,10}\/VBR_MP4h264.+?)&quot/gi;
    static checkLockPattern = "li-icon[type='lock-icon']";

    domNode;
    isVideoDownloadable = false;

    _videoSourcePage = "";      // link <a> from DOM node video element
    _videoDownloadLink = "";    // <source> link from page
    _isVideoSourceLoaded = false;
    _videoName = "";
    _downloadFromLinkPromise;


    constructor(domNode) {
        this.domNode = domNode;         // dom element with .video-item
        this._videoSourcePage = this.domNode.querySelector("a").href;

        this._configureIsVideoDownloadable();
        this._downloadVideoPage();
    }

    getLinkForDownloadAsync(callBack) {
        if(!this.isVideoDownloadable) {
            callBack();
        } else if(this._isVideoSourceLoaded) {
            callBack(this._videoDownloadLink);
        } else {
            this._downloadFromLinkPromise.then(callBack);
        }
    }

    get videoName() {
        if (!this._videoName) {
            this._videoName = this.domNode.querySelector(".toc-item__content").firstChild.textContent;
        }
        return this._videoName;
    }

    _configureIsVideoDownloadable() {
        if (!this.domNode.querySelector(LinkedInVideoItem.checkLockPattern)) {
            this.isVideoDownloadable = true;
        }
    }

    _downloadVideoPage() {
        if(!this.isVideoDownloadable) {
            this._isVideoSourceLoaded = true;
            return;
        }

        this._downloadFromLinkPromise = this._getPromiseDownloadFromLink();
        this._downloadFromLinkPromise.then(this._videoSourcePageDownloaded.bind(this), (status) => {console.error(`getPromiseDownloadFromLink (finished with code ${status})`);});
    }

    _getPromiseDownloadFromLink() {
        var promise = new Promise((resolve, rejected) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", this._videoSourcePage, true);
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

    _videoSourcePageDownloaded(htmlPage){
        this._getVideoSource(htmlPage);     // now this._videoDownloadLink is initialized
        this._isVideoSourceLoaded = true;
    }

    _getVideoSource(htmlPage) {
        let matches;
        while((matches = LinkedInVideoItem.sourceVideoPattern.exec(htmlPage)) !== null) {
            this._videoDownloadLink = matches[1];
        }
    }

}


class LinkedInVideoManager {
    _videoList = [];
    _videoItemPattern = ".video-item";
    _videoNodes;
    _initializeManagerSyncInterval = 500;
    _initializeManagerMaxRepeatTimes = 5;

    constructor() {
        this._initializeManagerAsync(this._prepareVideos.bind(this));
    }

    getVideoUrlByNumberAsync(number, callBack) {
        if (!this._videoList[number]) {
            callBack();
        } else {
            this._videoList[number].getLinkForDownloadAsync(callBack);
        }
    }

    getCurrentVideoUrlAsync(callBack) {
        let number = this._findVideoNumberOfCurrentPage();
        if (number !== undefined) {
            this.getVideoUrlByNumberAsync(number, callBack);
        }
    }

    getAllVideosUrlsAsync(callBack) {

    }

    get videoNodes() {
        if (!this._videoNodes) {
            this._videoNodes = document.querySelectorAll(this._videoItemPattern);
        }
        return this._videoNodes;
    }


    _initializeManagerAsync(callBack, repeatNumber = 0) {
        if(this.videoNodes.length) {
            callBack();
            return;
        }

        if(repeatNumber < this._initializeManagerMaxRepeatTimes) {
            setTimeout(this._initializeManagerAsync.bind(this, callBack, repeatNumber + 1), this._initializeManagerSyncInterval);
        } else {
            console.error("Video manager hasn't been initialize, or no video items in page")
        }
    }

    _prepareVideos() {
        for (let i = 0; i < this.videoNodes.length; i++) {
            let videoNode = new LinkedInVideoItem(this.videoNodes[i]);
            this._videoList.push(videoNode);
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

}
//endregion


var videoManager;


function initializeManager(sendResponse) {
    switch (document.domain) {
        case "www.linkedin.com":
            videoManager = new LinkedInVideoManager();
            break;
    }
    sendResponse();
}

function responseCurrentDomain(sendResponse) {
    sendResponse(document.domain);
}

function responseNoSuchMsgType(sendResponse) {
    sendResponse({error: "responseNoSuchMsgType"})
}

function responseGetVideoUrlByNumber(request, sendResponse) {
    if(!videoManager) {
        sendResponse();
        return;
    }
    if (typeof request.number === "number") {
        videoManager.getVideoUrlByNumberAsync(request.number, sendResponse);
    } else {
        console.error(`message 'downloadVideo' has incorrect request.number - ${request.number}`);
    }
}

function responseGetCurrentVideoUrl(sendResponse) {
    videoManager.getCurrentVideoUrlAsync(sendResponse);
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        switch(request.type){
            case "getDomain":
                responseCurrentDomain(sendResponse.bind(this));
                break;
            case "getVideoUrlByNumber":
                responseGetVideoUrlByNumber(request, sendResponse.bind(this));
                break;
            case "getCurrentVideoUrl":
                responseGetCurrentVideoUrl(sendResponse.bind(this));
                break;
            case "initializeManager":
                initializeManager(sendResponse.bind(this));
                break;
            default:
                responseNoSuchMsgType(sendResponse.bind(this));
                break;
        }
    });


