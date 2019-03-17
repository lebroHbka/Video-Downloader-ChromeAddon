

var managerInitialized = false;


// TODO check if tab is loaded befor send msg
function sendMsg(msg, callBack) {
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

function download(url, callBack) {
    debugger;
    chrome.downloads.download({"url": url},callBack);
}

function askForDomain() {
    sendMsg({type: "getDomain"}, (r) => {console.log(r)});
}

function downloadCurrentVideo() {
    if(downloadCurrentVideo) {
        sendMsg({type: "getCurrentVideoUrl"}, (response) => {
            download(response, () => {
            })
        });
    }
}

function subscribeForEvents() {
    document.getElementById('downloadBtn').addEventListener('click', downloadCurrentVideo);
}

function initializeManager() {
    sendMsg({type: "initializeManager"}, (r) => {console.log("manager initialized");managerInitialized = true;});
}

initializeManager();

subscribeForEvents();



//document.getElementById('downloadBtn').addEventListener('click', testMessage);