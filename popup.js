

class ChromeAddOn {

    _isTabInitialized = false;

    constructor() {
        this._init();
        this._subscribeForTabEvents();
    }

    // region Public methods

    downloadCurrentVideo() {
        this._sendTabMsgAsync({type: "getCurrentVideoUrl"})
            .then(this._downloadAsync.bind(this).then(null, this._videoCantBeDownloadedError),
                this._sendingMsgToTabError);
    }

    downloadAllDownloadableVideos() {
        this._sendTabMsgAsync({type: "getAllDownloadableVideosUrls"})
            .then(urlsArr => {
                urlsArr.forEach(url => this._downloadAsync(url).then(null, this._videoCantBeDownloadedError));
            }, this._sendingMsgToTabError);
    }

    // endregion


    //region Private methods

    _init() {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            let tab = tabs[0];
            if ((tab.status === "complete") && (!this._isTabInitialized)) {
                this._isTabInitialized = true;
                this._initManager();
            }
        });
    }

    _initManager() {
        this._subscribeForEvents();
        this._updateVideoNamesList();
    }

    _subscribeForEvents() {
        document.getElementById('downloadBtn').addEventListener("click", this.downloadCurrentVideo.bind(this));
        document.getElementById('downloadAllBtn').addEventListener("click", this.downloadAllDownloadableVideos.bind(this));
    }

    _subscribeForTabEvents() {
        chrome.tabs.onUpdated.addListener( (tabId , info) => {
            if((info.status === "complete") && (!this._isTabInitialized)){
                this._isTabInitialized = true;
                this._initManager();
            }
        });
    }

    _sendTabMsgAsync(msg) {
        return new Promise((resolve, rejected) => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let tab = tabs[0].id;
                chrome.tabs.sendMessage(tab, msg, function (response) {
                    if (response && response.error) {
                        rejected(response.error, msg);
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }

    _downloadAsync(url) {
        return new Promise((resolve, reject) => {
            if (!url) {
                reject(url);
            } else {
                chrome.downloads.download({"url": url}, resolve);
            }
        });
    }

    _downloadVideosNamesPromise() {
        return new Promise((resolve) => {
            this._sendTabMsgAsync({type: "getVideoNamesList"}).then(resolve.bind(this), this._sendingMsgToTabError);
        });
    }

    _updateVideoNamesList() {
        this._downloadVideosNamesPromise().then(videosList=> {
            let videos = `<hr/> ${videosList.join("\n<hr/>")} <hr/>`;
            document.getElementById("list").innerHTML = videos;
        });
    }

    //endregion


    //region Error messages

    _videoCantBeDownloadedError(url) {
        console.warn(`Video with url "${url}" can't be downloaded"`);
    }

    _sendingMsgToTabError(error, msg) {
        console.warn(`Message with type "${msg}" ended with error - "${response.error}"`);
    }

    //endregion
}

new ChromeAddOn();

