

class ChromeAddon {

    _isTabInitialized = false;

    constructor() {
        this._init();
        this._subscribeForTabEvents();
    }

    downloadCurrentVideo() {
        this._sendTabMsgAsync({type: "getCurrentVideoUrl"}).then(this._downloadAsync.bind(this));
    }

    downloadAllDownloadableVideos() {
        this._sendTabMsgAsync({type: "getAllDownloadableVideosUrls"}).then(urlsArr => {
            urlsArr.forEach(url => this._downloadAsync(url));
        });
    }

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
        return new Promise(resolve => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let tab = tabs[0].id;
                chrome.tabs.sendMessage(tab, msg, function (response) {
                    if (response && response.error) {
                        console.error(`Message with type "${msg.type}" ended with error - "${response.error}"`);
                        return;
                    }
                    resolve(response);
                });
            });
        });
    }

    _downloadAsync(url) {
        return new Promise(resolve => {
            if (!url) {
                console.error(`url is: "${url}" manager isn't initialize"`);
            } else {
                chrome.downloads.download({"url": url}, resolve);
            }
        });
    }

    _downloadVideosNamesPromise() {
        return new Promise((resolve) => {
            this._sendTabMsgAsync({type: "getVideoNamesList"}).then(resolve.bind(this));
        });
    }

    _updateVideoNamesList() {
        this._downloadVideosNamesPromise().then(videosList=> {
            let videos = `<hr/> ${videosList.join("\n<hr/>")} <hr/>`;
            document.getElementById("list").innerHTML = videos;
        });
    }
}

var ca = new ChromeAddon();

