

class ChromeAddon {

    _isTabInitialized = false;

    constructor() {
        this._init();
        this._subscribeForTabEvents();
    }

    downloadCurrentVideo() {
        this._sendTabMsg({type: "getCurrentVideoUrl"}, (response) => {
            this._download(response, () => {
            })
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
        this._sendInitManagerMsg();
        this._subscribeForEvents();
    }

    _sendInitManagerMsg() {
        this._sendTabMsg({type: "initializeManager"}, (r) => {
            console.log("manager initialized");
        });
    }

    _subscribeForEvents() {
        document.getElementById('downloadBtn').addEventListener('click', this.downloadCurrentVideo.bind(this));
    }

    _subscribeForTabEvents() {
        chrome.tabs.onUpdated.addListener( (tabId , info) => {
            if((info.status === "complete") && (!this._isTabInitialized)){
                this._isTabInitialized = true;
                this._initManager();
            }
        });
    }

    _sendTabMsg(msg, callBack) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            let tab = tabs[0].id;
            chrome.tabs.sendMessage(tab, msg, function (response) {
                if (response && response.error) {
                    console.error(`Message with type "${msg.type}" ended with error - "${response.error}"`);
                    return;
                }
                callBack(response);
            });
        });

    }

    _download(url, callBack) {
        if (!url) {
            console.error(`url is: "${url}" manager isn't initialize"`);
        } else {
            chrome.downloads.download({"url": url}, callBack);
        }
    }
}

var ca = new ChromeAddon();

