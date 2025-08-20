console.info("load content.js");
window.addEventListener("message", function (event) {
    if(chrome===undefined||chrome.runtime===undefined){
        console.warn('Chrome runtime not available, cannot send message to background');
    }else{
        try{
            if (event.data.action === "Echo") {
                // console.info("收到来自content-script的消息:", event);
                chrome.runtime.sendMessage(event.data, function (response) {
                    // console.log("转发消息到 background:", event, response);
                });
            }
        }catch (e) {
            //console.error(e);
        }
    }
});