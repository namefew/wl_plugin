let allbetSocket;
let isCreatingAllbetSocket = false; // 锁变量
let resolveQueue = []; // 用于存储等待的 resolve 函数
const maxReconnectAttempts = 5; // 最大重连次数
const initialReconnectInterval = 1000; // 初始重连间隔时间，单位为毫秒
let urlPattern;
let attachedTabs = new Set(); // 用于跟踪已经附加调试器的标签页
let needRefresh = false;
let interval_id = null;
let rooms = {}
let bets = {}

chrome.storage.local.get(['rooms', 'bets'], function(items) {
        rooms = JSON.parse(items.rooms||'{}');
        bets = JSON.parse(items.bets||'{}');
    });

let SID = (e => (e[e.HEARTBEATS = 1] = "HEARTBEATS",
    e[e.LOGIN_SUCCESS = 106] = "LOGIN_SUCCESS",
    e[e.LOGIN_ERROR = 107] = "LOGIN_ERROR",
    e[e.ERROR = 600] = "ERROR",
    e[e.SERVER_MAINTAIN = 700] = "SERVER_MAINTAIN",
    e[e.ACCOUNT_REMOTE_LOGIN = 702] = "ACCOUNT_REMOTE_LOGIN",
    e[e.UPDATE_SCORE = 720] = "UPDATE_SCORE",
    e[e.ROOM_INFOS = 1001] = "ROOM_INFOS",
    e[e.ROOM_BEGIN_CHIP = 1002] = "ROOM_BEGIN_CHIP",
    e[e.ROOM_GAME_RESULT = 1004] = "ROOM_GAME_RESULT",
    e[e.ENTER_INNER_ROOM = 1006] = "ENTER_INNER_ROOM",
    e[e.BACCARAT_BET = 1008] = "BACCARAT_BET",
    e[e.BACCARAT_STOP_BET = 1009] = "BACCARAT_STOP_BET",
    e[e.BACCARAT_ONLINE_LIST = 1101] = "BACCARAT_ONLINE_LIST",
    e[e.SELF_SCORE = 1102] = "SELF_SCORE",
    e[e.GAME_CONFIG = 1201] = "GAME_CONFIG",
    e[e.BET_STAGE_ERROR = 1202] = "BET_STAGE_ERROR",
    e[e.DEAL_CARD = 1300] = "DEAL_CARD",
    e[e.EDIT_CARDS = 1301] = "EDIT_CARDS",
    e[e.WASHING_CARD = 1302] = "WASHING_CARD",
    e[e.GOOD_ROAD_CHANGE = 1303] = "GOOD_ROAD_CHANGE",
    e[e.INTO_MAINTAIN = 1304] = "INTO_MAINTAIN",
    e[e.ROAD_SET_SUCCEED = 1305] = "ROAD_SET_SUCCEED",
    e[e.CHECK_BETTING_ROOM = 1314] = "CHECK_BETTING_ROOM",
    e[e.SET_SHOW_OPTION_SUCCEED = 1308] = "SET_SHOW_OPTION_SUCCEED",
    e[e.BET_INFO_RES = 1315] = "BET_INFO_RES",
    e[e.BACCARAT_KICK_USER_2_LIST = 1316] = "BACCARAT_KICK_USER_2_LIST",
    e[e.BACCARAT_UPDATE_DEALER_INFO = 1317] = "BACCARAT_UPDATE_DEALER_INFO",
    e[e.BACCARAT_MI_START = 1400] = "BACCARAT_MI_START",
    e[e.BACCARAT_MI_INFO = 1401] = "BACCARAT_MI_INFO",
    e[e.BACCARAT_MI_END = 1402] = "BACCARAT_MI_END",
    e[e.BACCARAT_MI_RIGHT_INFO = 1403] = "BACCARAT_MI_RIGHT_INFO",
    e[e.BACCARAT_MI_OTHER_OPEN = 1404] = "BACCARAT_MI_OTHER_OPEN",
    e[e.BACCARAT_MI_CAN_ENTER_WITH_SIT = 1405] = "BACCARAT_MI_CAN_ENTER_WITH_SIT",
    e[e.BACCARAT_MI_ENTER_WITH_SIT_RES = 1406] = "BACCARAT_MI_ENTER_WITH_SIT_RES",
    e[e.BACCARAT_ROOM_VIDEO_URL_INFO = 1407] = "BACCARAT_ROOM_VIDEO_URL_INFO",
    e[e.BACCARAT_BET_RES = 1409] = "BACCARAT_BET_RES",
    e[e.ROOM_VIDEO = 1410] = "ROOM_VIDEO",
    e[e.BACCARAT_CLIENT_CONFIG = 1430] = "BACCARAT_CLIENT_CONFIG",
    e[e.BACCARAT_SELF_CHIPS = 1441] = "BACCARAT_SELF_CHIPS",
    e[e.SYNC_BET = 1999] = "SYNC_BET",
    e[e.ROOM_LIST = 2999] = "ROOM_LIST",
    e))({});

setInterval(() => {
    chrome.storage.local.set({ 
        rooms: JSON.stringify(rooms) 
    }, () => {
        if (chrome.runtime.lastError) {
            console.error('持久化失败:', chrome.runtime.lastError);
        }
    });
}, 5 * 60 * 1000); // 每5分钟保存一次
function getWebSocket() {
    return new Promise((resolve, reject) => {
        if (allbetSocket && allbetSocket.readyState === WebSocket.OPEN) {
            resolve(allbetSocket);
            return;
        }

        if (isCreatingAllbetSocket) {
            // 如果已经有进程在创建 WebSocket 连接，将当前进程加入等待队列
            resolveQueue.push(resolve);
            return;
        }

        isCreatingAllbetSocket = true;

        let reconnectAttempts = 0; // 当前重连次数

        const createAndInitializeWebSocket = () => {
            chrome.storage.local.get(['wsUrl'], ({ wsUrl }) => {
                console.info('configured WebSocket URL:', wsUrl);
                const url = wsUrl || 'ws://localhost:8765/wl'; // 替换为实际的 WebSocket 服务端 URL
                const socket = new WebSocket(url);

                socket.addEventListener('open', function(event) {
                    console.info('WebSocket connection established.');
                    allbetSocket = socket;
                    isCreatingAllbetSocket = false;
                    reconnectAttempts = 0; // 重置重连次数

                    // 解锁所有等待的进程
                    resolveQueue.forEach(res => res(socket));
                    resolveQueue = [];

                    resolve(socket);
                });

                socket.addEventListener('message', function(event) {
                    console.info('Received message:', event.data);
                    handleServerMessage(event.data);
                });

                socket.addEventListener('close', function(event) {
                    console.info('WebSocket connection closed:', event.code, event.reason);
                    allbetSocket = null;
                    attemptReconnect();
                });

                socket.addEventListener('error', function(event) {
                    console.error('WebSocket error:', event);
                    allbetSocket = null;
                    attemptReconnect();
                });

                function attemptReconnect() {
                    if (reconnectAttempts < maxReconnectAttempts) {
                        const reconnectDelay = initialReconnectInterval * Math.pow(3, reconnectAttempts);
                        console.log(`Attempting to reconnect in ${reconnectDelay} ms. Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
                        setTimeout(createAndInitializeWebSocket, reconnectDelay);
                        reconnectAttempts++;
                    } else {
                        console.error('Max reconnect attempts reached. Giving up.');
                        isCreatingAllbetSocket = false;
                        reject(new Error('Max reconnect attempts reached'));
                    }
                }
            });
        };
        createAndInitializeWebSocket();
    });
}

// 初始化 WebSocket 连接
getWebSocket().then(socket => {
    console.info('WebSocket initialized successfully:', socket);
}).catch(error => {
    console.error('Failed to initialize WebSocket:', error);
});

function setupWebSocketFrameListener() {
    chrome.debugger.onEvent.addListener((source, method, params) => {
        if (method === 'Network.webSocketFrameReceived') {
            //if (!isGameUrl(source.url))return ;
            const { requestId, timestamp, response } = params;
            const { opcode, mask, payloadData } = response;
            let payloadDisplay;

            if (opcode === 1) {
                payloadDisplay = payloadData;
                console.log("<<", payloadDisplay);
                if (allbetSocket && allbetSocket.readyState === WebSocket.OPEN){
                    if (payloadDisplay.startsWith('{')) {
                        payloadDisplay = JSON.parse(payloadDisplay);
                        allbetSocket.send(payloadData)
                    }
                }
            }else{
                 
            }

        }
    });
};
function refreshAndReload() {
    // Step 1: 获取目标调试器 ID
    chrome.debugger.getTargets((targets) => {
        const target = targets.find(t => t.type === 'page' && isGameUrl(t.url));
        if (!target) {
            console.warn("未找到对应的目标页面或不符合游戏 URL 规则");
            return;
        }

        // 保存 tabId（页面刷新后保持不变）
        const tabId = target.tabId;
        
        // Step 2: 刷新页面
        chrome.debugger.sendCommand(
            { targetId: target.id }, 
            "Page.reload", 
            { ignoreCache: true }, 
            () => {
                console.log(`标签页 ${tabId} 正在刷新...`);
                
                // Step 3: 等待页面加载完成并执行点击逻辑
                setTimeout(() => {
                   clickWL(tabId);
                }, 8000); // 等待 8 秒确保页面加载完成
            }
        );
    });
}
chrome.storage.local.get(['gameUrlPattern'], ({ gameUrlPattern }) => {
    urlPattern = gameUrlPattern || '/888,egret';
});

function clickWL(tabId) { 
     const clickScript = `
        (function() {
            console.log("点击开始...");
            const nameElement = Array.from(
                document.querySelectorAll('.name-inner')
            ).find(el => el.textContent && el.textContent.includes('WL真人'));
            
            if (nameElement && nameElement.parentNode && nameElement.parentNode.parentNode) {
                const targetElement = nameElement.parentNode.parentNode.firstElementChild;
                targetElement.click();
                console.log('成功点击WL真人');
                return true;
            } else {
                console.warn('未找到WL真人元素');
                return false;
            }
        })()
    `;

    // 关键修改：使用 tabId 而不是 targetId
    chrome.debugger.sendCommand(
        { tabId: tabId }, // 使用保存的 tabId
        "Runtime.evaluate",
        { expression: clickScript },
        (result) => {
            if (chrome.runtime.lastError) {
                console.error("执行点击失败:", chrome.runtime.lastError.message);
            } else {
                console.log("点击脚本执行结果:", result);
            }
        }
    );
}
// 使用存储的 gameUrlPattern 进行匹配
function isGameUrl(url) {
    let mt = false;
    urlPattern.split(',').forEach(pattern => {
        if (pattern && (url.includes("http://") || url.includes("https://")) && url.includes(pattern)&&!url.endsWith(".js")) {
            mt = true;
        }
    });
   return mt;
    // return true;
}

// 给接收到的消息执行相应动作
function handleServerMessage(message) {
    const infos = message.split(',');
    // 确保有足够的字段
    if (infos.length < 3) {
        console.error('Received message does not have enough fields:', message);
        return;
    }
    // 转换数据类型
    if(infos.length==3){
        const card1 = parseInt(infos[0], 10);
        const card2 = parseInt(infos[1], 10);
        const theTime = parseFloat(infos[2]) * 1000; // 假设 theTime 是秒数，转换为毫秒
        const startTime = new Date().getTime();
        chrome.storage.local.get(['amount'], ({ amount }) => {
            let betAmount = amount !== undefined ? amount : 10;
            const script = 'handleMessage(' + card1 + ',' + card2 + ',' + theTime + ',' + betAmount + ');';
            executeScriptInTabs(script);
            const timeSpend = new Date().getTime() - startTime;
            console.info(`spend ${timeSpend} ms on message redirect ${card1} - ${card2}, ${betAmount}`);

        });
        return true;
    }else if(infos.length==5){
        const table_id = parseInt(infos[0], 10);
        const card1 = parseInt(infos[1], 10);
        const card2 = parseInt(infos[2], 10);
        const tableName = infos[3];
        const theTime = parseFloat(infos[4]) * 1000;
        const startTime = new Date().getTime();
        if(rooms[table_id]!==undefined){
            let room = rooms[table_id];
            if(room.status===2 && room.lastOcr!==undefined && room.lastOcr.match){
                console.info("收到消息："+message);
                console.info("可下注当前局：",room.roomId,room.roundId,room.currentShoe[room.roundId]);
                rooms[table_id].currentShoe[room.roundId].bets={
                    card1: card1,
                    card2: card2,
                    startTime:startTime
                }
                chrome.storage.local.get(['amount'], ({ amount }) => {
                    let betAmount = amount !== undefined ? amount : 10;
                    const script = 'handleTableMessage(' + table_id + ',' + card1 + ',' + card2 +',"' + tableName+'",' + theTime + ',' + betAmount + ');';
                    executeScriptInTabs(script);
                    const timeSpend = new Date().getTime() - startTime;
                    console.info(`spend ${timeSpend} ms on message redirect ${table_id}-${tableName} - ${card1} - ${card2}, ${betAmount}`)
                });
            }else{
                console.info("收到消息："+message);
                console.info("不可下注，状态："+(room.status===2)+" ,前一次识别匹配："+(room.lastOcr!==undefined && room.lastOcr.match))
            }
            room.lastOcr = {
                card1: card1,
                card2: card2,
                time: theTime,
                match:false
            };
        }
    }

}
function setBreak(target) {
    chrome.debugger.sendCommand({ targetId: target.id }, 'Debugger.setBreakpointByUrl', {
        lineNumber: 41,
        columnNumber: 41525,
        urlRegex: '.*/video/assets/_nexus-.*\\.js(\\?.*)?',
        condition: ""
    }, (breakpoint) => {
        if (chrome.runtime.lastError) {
            console.error("设置断点失败：", chrome.runtime.lastError.message);
            return;
        }

        const currentBreakpointId = breakpoint.breakpointId;
        console.log('断点设置成功:', currentBreakpointId, target.url);

        // 监听暂停事件并关联上下文
        const onPaused = (source, method, params) => {
            if (method === 'Debugger.paused') {
                const topCallFrame = params.callFrames[0];
                if (!topCallFrame) return;

                // 直接使用 callFrameId 执行代码
                handleBreak(target, currentBreakpointId, topCallFrame.callFrameId);
            }
        };
        chrome.debugger.onEvent.addListener(onPaused);
    });
}

function handleBreak(target, currentBreakpointId,callFrameId) {
    try {
        console.info("执行到断点 ...",target.url);
        // 执行你的自定义代码
        script = `
        console.info("开始断点执行:");
        if (WSNet && this.IS_LOGIN && self.wsNet === undefined) { 
            self.wsNet = this;
            console.info(self.wsNet);
            console.info("设置wsNet成功");
            if (self.wsNet._WSInstance.listenerMap.get("msg").length > 1) { 
                console.info("已设置wsNet 转发");
            }else{
                wsNet._WSInstance.addEventListener("msg", e => { 
                    sendMessageToContentScript(e.detail);
                }); 
                console.info("设置wsNet 转发成功");
            }
            a = true; 
        } else { 
            console.info("设置wsNet失败，WSNet不能识别:",WSNet===undefined);
            a = false; 
        }
        `
        console.info("断点执行自定义代码...", script, target.url);
        chrome.debugger.sendCommand({ targetId: target.id }, "Debugger.evaluateOnCallFrame", {
            expression: script,
            callFrameId: callFrameId
        }, (result) => {
            if (chrome.runtime.lastError) {
                console.error("",chrome.runtime.lastError.message);
                return;
            }
            console.log('断点执行自定义代码成功:', result);
            if(result.result.value){
                 // 移除断点
                console.info("移除断点...", currentBreakpointId, target.url);
                chrome.debugger.sendCommand({
                        targetId: target.id
                    }, 'Debugger.removeBreakpoint', {
                        breakpointId: currentBreakpointId
                    }, (result1) => {
                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError.message);
                        }
                        console.info("恢复执行...", target.url);
                        chrome.debugger.sendCommand({
                            targetId: target.id
                        }, 'Debugger.resume', () => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError.message);
                            }
                            console.info("恢复执行完成", target.url);
                        });
                    });
            }else{
                console.info("恢复执行...", target.url);
                chrome.debugger.sendCommand({
                    targetId: target.id
                }, 'Debugger.resume', () => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                    }
                    console.info("恢复执行完成", target.url);
                });
            }
         });

    } catch (error) {
        console.error('Breakpoint handler error:', error);
    }
}
async function executeScriptInTabs(script) {

    // 获取所有调试目标
    chrome.debugger.getTargets((targets) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting targets:', chrome.runtime.lastError);
            return;
        }
        targets.forEach((target) => {
            // 检查 target 是否属于当前 tab 或其 iframe
            const isGame = isGameUrl(target.url);
            if (isGame && target.attached) {
                chrome.debugger.sendCommand({ targetId: target.id }, "Runtime.evaluate", {
                    expression: script
                }, (result) => {
                    if (chrome.runtime.lastError) {
                        console.error("执行失败：", chrome.runtime.lastError.message, target.url);
                        return;
                    }
                    console.log('handle message result:', result);
                });
            }
        });
    });
}

// 监听 storage 变化事件
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.wsUrl) {
        console.info('wsUrl changed to:', changes.wsUrl.newValue);
        closeWebSocket();
        getWebSocket().then(socket => {
            console.info('WebSocket reinitialized successfully:', socket);
        }).catch(error => {
            console.error('Failed to reinitialize WebSocket:', error);
        });
    }
    if (namespace === 'local' && changes.gameUrlPattern) {
        urlPattern = changes.gameUrlPattern.newValue;
        console.info('url pattern changed to:', changes.gameUrlPattern.newValue);
    }
});

// 关闭当前的 WebSocket 连接
function closeWebSocket() {
    if (allbetSocket) {
        allbetSocket.close();
        allbetSocket = null;
        console.info('Current WebSocket connection closed.');
    }
}

async function attachDebugger() {
    const script = await fetch(chrome.runtime.getURL('inject_scripts.js')).then(response => response.text());
    chrome.debugger.getTargets((targets) => {
        if (chrome.runtime.lastError) {
            console.error('Error getting targets:', chrome.runtime.lastError);
            return;
        }

        targets.forEach((target) => {
            const isGame = isGameUrl(target.url);
            if (isGame && !attachedTabs.has(target.id)) {
                // Step 2: 连接到目标
                chrome.debugger.attach({ targetId: target.id }, "1.3", () => {
                    if (chrome.runtime.lastError?.message.includes("already attached")) {
                        console.log('Already attached, skip');
                        chrome.debugger.sendCommand({ targetId: target.id }, 'Network.enable');
                        return;
                    }
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                    }
                    chrome.debugger.sendCommand({ targetId: target.id }, 'Network.enable');

                    console.log(`成功连接到目标: ${target.url}`);
                    attachedTabs.add(target.id);
                    if(target.url.includes("/video"))
                        inject_scripts(target, script);
                });
                
            }
        });
    });
}

function inject_scripts(target, script) {
    // 启用 Debugger 代理
    chrome.debugger.sendCommand({ targetId: target.id }, 'Debugger.enable', {}, () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to enable Debugger:', chrome.runtime.lastError);
            return;
        }
        chrome.debugger.sendCommand({ targetId: target.id }, 'Network.enable');

        chrome.debugger.sendCommand({ targetId: target.id }, "Runtime.evaluate", {
            expression: script
        }, (result) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
            console.log('注入脚本成功:', result);
        });
        chrome.debugger.sendCommand({ targetId: target.id },"Runtime.evaluate", {
            expression: "(window.wsNet===undefined)"
        }, (result) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
            if(result.result.value){
                setBreak(target);
            }
        });
    });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
       await attachTab(tab);
       if(isGameUrl(tab.url)){
            setTimeout(()=>{
                clickWL(tabId);
            },1000);
       }
    }
});

async function attachTab(tab){
    // if (isGameUrl(tab.url)){
    //     chrome.scripting.executeScript({
    //         target: { tabId: tab.id },
    //         files: ["content.js"]
    //     }).catch(err => {
    //         console.error("注入失败:", err);
    //     });
    // }
    const script = await fetch(chrome.runtime.getURL('inject_scripts.js')).then(response => response.text());
    chrome.debugger.getTargets((targets) => {
        if (chrome.runtime.lastError) {
            console.warn('Error getting targets:', chrome.runtime.lastError);
            return;
        }

        targets.forEach((target) => {
            const isGame = isGameUrl(target.url);
            if (isGame && target.url === tab.url) {
                // Step 2: 连接到目标
                chrome.debugger.attach({ targetId: target.id }, "1.3", () => {
                    if (chrome.runtime.lastError) {
                        console.warn(chrome.runtime.lastError.message);
                    }
                    chrome.debugger.sendCommand({ targetId: target.id }, 'Network.enable');
                    console.log(`成功连接到目标: ${target.url}`);
                    attachedTabs.add(target.id);
                    if(target.url.includes("/video"))
                        inject_scripts(target, script); 
                });
            }
        });
    });
}

// 监听新标签页创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
    attachDebugger();
});

// 监听标签页被替换事件
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    attachDebugger();
});
// setupWebSocketFrameListener()

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "Echo") {
        // 处理消息并返回响应
        if(message.data){
            // 1. 添加错误处理
            chrome.storage.local.get(['enableMessage'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('配置读取失败:', chrome.runtime.lastError);
                    return;
                }
                // 2. 使用安全的布尔判断
                if (result.enableMessage !== false) {  
                    try {
                        allbetSocket.send(JSON.stringify(message.data));
                    } catch (error) {
                        console.error('消息发送失败:', error);
                    }
                }
            });
           
            let sid = message.data.sid;
            if(sid === SID.LOGIN_ERROR){//
                refreshAndReload();
            }
            let data = message.data.data;
            let roomId = data?.roomId;
            if(roomId!==undefined){
                let room = rooms[roomId];
                if(room===undefined){
                    room = rooms[roomId]={};
                    room.roomId = roomId;
                    room.roundId=-1;
                    room.currentShoe={};
                }
                if(sid===SID.WASHING_CARD){
                    if(room.currentShoe!==undefined){
                        if(room.shoeHistory===undefined){
                            room.shoeHistory = [];
                        }
                        room.shoeHistory.push(room.currentShoe)
                    }
                    room.currentShoe={} 
                    room.status=5;//洗牌中
                }else if(sid===SID.ROOM_BEGIN_CHIP){
                    room.roundId = data.roundId;
                    room.status=2;
                    let round = {};
                    room.currentShoe[room.roundId] = round
                    round.roundId = data.roundId;
                    round.round=data.round;
                    round.countdown = data.countdown;
                    round.betDuration = data.betDuration;
                    round.userCount = data.userCount;
                    round.status = 2;//下注
                    round.startTime = Date.now();
                }else if(sid===SID.BACCARAT_STOP_BET){
                    room.status=3;
                    if(room.currentShoe[room.roundId]!==undefined)
                        room.currentShoe[room.roundId].status = 3;//开牌
                }else if(sid===SID.ROOM_GAME_RESULT){
                    room.status = 4;
                    let round = room.currentShoe[room.roundId];
                    if(round!==undefined){
                        round.status = 4;//结算中
                        round.cards = data.cards;
                    }
                    if(room.lastOcr!==undefined){
                        if(data.cards.length>2){//百家乐
                            room.lastOcr.match = (data.cards[0].card%13+1)===(room.lastOcr.card1%13+1) && (data.cards[2].card%13+1)===(room.lastOcr.card2%13+1);
                        }else if(data.cards.length==2){//龙虎
                            room.lastOcr.match = (data.cards[0].card%13+1)===(room.lastOcr.card1%13+1) && (data.cards[1].card%13+1)===(room.lastOcr.card2%13+1);
                        }
                    }
                }else if(sid===SID.BACCARAT_BET){
                    //下注{"roomId":8129,"areaBet":[{"area":4,"bet":1000,"count":1,"betType":0}],"carrier":"8129-1755653054972"}} 
                    bets[data.carrier]=data;
                    bets[data.carrier].roundId = room.roundId;
                }else if(sid===SID.BACCARAT_BET_RES){ 
                    //下注结果 {"success":true,"carrier":"8129-1755653054972","roomId":8129}}
                    if(bets[data.carrier]!==undefined){
                        bets[data.carrier].success=data.success;
                        chrome.storage.local.set({ 
                            bets: JSON.stringify(bets) 
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('持久化失败:', chrome.runtime.lastError);
                            }
                        });
                    }
                                    
                }
            }
        }
        sendResponse({data: "echo ok"});
    }else if (data.action === "Response") {
        // 处理消息并返回响应
        if(data.data){
            allbetSocket.send(JSON.stringify(data.data));
        }
         sendResponse({data: "response ok"});   
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, async (tab) => {
        if (!tab) {
            console.error('Failed to retrieve tab information.');
            return;
        }

        
        attachDebugger();
       
    });
});
chrome.webNavigation.onCommitted.addListener((details) => {
    attachDebugger();
}, { url: [{ pathContains: "/" }] }); 
function isEmbedUrl(url) {
    return url && url.includes('embed');
}

console.info("web socket monitor background.js is loaded.");
