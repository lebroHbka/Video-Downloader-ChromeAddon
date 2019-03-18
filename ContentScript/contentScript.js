

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
        let link;
        while((matches = LinkedInVideoItem.sourceVideoPattern.exec(htmlPage)) !== null) {
            link = matches[1];
        }
        return link;
    }

}


class LinkedInVideoManager {
    static videoManager;
    _videoItemsList = [];
    _videoItemPattern = ".video-item";
    _videoNodes;
    _initializeManagerSyncInterval = 500;
    _initializeManagerMaxRepeatTimes = 5;
    _videoNodesInitializePromise;

    static getVideoManager() {
        if(!this.videoManager) {
            this.videoManager = new LinkedInVideoManager();
        }
        return this.videoManager;
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


var videoManager;


function initializeManager(sendResponse) {
    switch (document.domain) {
        case "www.linkedin.com":
            videoManager = LinkedInVideoManager.getVideoManager();
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


