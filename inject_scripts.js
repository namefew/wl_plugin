(function() {
    console.info("injecting script to self:", self);
    window.isBetting=false
   
    function clickCenter(element, clickCount = 1) {
        if (!element) {
            console.warn('handleMessage clickCenter: element is null or undefined');
            return;
        }
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < clickCount; i++) {
            const event = new MouseEvent('click', {
                view: self,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
            });
            element.dispatchEvent(event);
        }
    }
    function selectCoins(betAmount) {
        const coins = [1000, 5000,10000,20000,50000,100000, 200000,500000,1000000,2000000,5000000, 10000000];
        let theBet = betAmount * 100;
        const selectedCoins = [];
        for (let i = coins.length - 1; i >= 0; i--) {
            while (theBet >= coins[i]) {
                selectedCoins.push(coins[i]);
                theBet -= coins[i];
            }
        }
        return selectedCoins;
    }
    function getNavigationTitle() {
        let div = document.querySelector('#navBar span.text-sm')
        if (div === null || div === undefined || div.innerText === null || div.innerText === undefined) {
            return '';
        }
        return div.innerText;
    }
    function isLongHuPage(){
        return getNavigationTitle().includes('L01')
    }

    function handleMessage(card1, card2, theTime, betAmount) {
        console.info('handle message:', card1, card2, theTime, betAmount);
        // if (!isLongHuPage()) {
        //     console.warn('当前不是"龙虎 L01"页面,忽略消息');
        //     removeFloatingDiv();
        //     return;
        // }
        if(betAmount==0){
            betAmount = localStorage.getItem('betAmount');
            if(!betAmount||betAmount==0){
                if (window.betRates && window.betRates['龙虎']){
                    betAmount = window.betRates['龙虎'][0]
                }
            }
            if(!betAmount||betAmount==0) betAmount=10;
        }
        if(betAmount<=1){
            let maxBet = localStorage.getItem('totalMoney')
            if(!maxBet){
                maxBet = getMaxSelectedChipValue()
            }
            betAmount = maxBet * betAmount;
            if(betAmount<0)betAmount=-betAmount;
        }


        const card1_num = (card1 % 13) + 1;
        const card2_num = (card2 % 13) + 1;
        const area_num = card1_num > card2_num ? 0 : (card1_num < card2_num ? 2 : 1);

        if (self.wsNet && wsNet.send) {
            const randomTimeOffset = Math.floor(Math.random() * (300 - 100 + 1))+100;
            const timestmp = Date.now()
            if (card1_num > card2_num) {
                wsNet.send(500, 2000, { roomId: 8801, betEnv: 1, carrier: '8801-' + timestmp, areaBet: [{ area: 1, bet: betAmount * 100, betType: 0, count: 1 }] });
            } else if (card1_num < card2_num) {
                wsNet.send(500, 2000, { roomId: 8801, betEnv: 1, carrier: '8801-' + timestmp, areaBet: [{ area: 2, bet: betAmount * 100, betType: 0, count: 1 }] });
            } else if (card1_num == card2_num) {
                wsNet.send(500, 2000, { roomId: 8801, betEnv: 1, carrier: '8801-' + timestmp, areaBet: [{ area: 3, bet: betAmount * 100, betType: 0, count: 1 }] });
            }
            console.info('handle pack spend time:', new Date().getTime() - theTime, card1_num, card2_num, area_num,betAmount);
            return true;
        }

        const coins = selectCoins(betAmount);
        if(coins.length==0)return false;
        const chipValue = coins[0];
        const cnt = coins.filter(item => item === chipValue).length;
        const chipButton = document.querySelector(`div[data-type="${chipValue}"]`);
        if (chipButton && window.getComputedStyle(chipButton).display !== 'none' && chipButton.parentElement && window.getComputedStyle(chipButton.parentElement).display !== 'none') {
            const betAreaSelector = '.area-' + area_num + ' > div[fast-click]';
            const confirmSelector = '.area-' + area_num + ' .button-click.chips-button-right';
            chipButton.addEventListener('click', () => {
                console.info(`handle message Clicked chip with value: ${chipValue}`);
                clickBetAreaThenConfirm(betAreaSelector,confirmSelector,cnt,theTime);
            }, { once: true });
            clickCenter(chipButton);
            return true;
        }
        return false;
    }

    function isMutipleTable(){
        let firstRoombettingDiv = document.querySelector('#more-list-wrap .room-betting')
        return firstRoombettingDiv
    }

    function handleTableMessage(tableId, card1, card2, tableName, theTime, betAmount) {
        console.info('handle table message:', tableId, card1, card2, tableName, theTime, betAmount);
        console.info('receive message spend time:',Date.now()-theTime)
        let navTitle = getNavigationTitle();
        if (tableId == 8801 && navTitle.includes('L01')) {
            console.info('当前是龙虎 L01页面,且是龙虎消息,立即处理...');
            return handleMessage(card1, card2, theTime, betAmount);
        } else if (tableId == 8801) {
            console.info('当前不是龙虎页面，忽略龙虎消息。');
            return false;
        }
        if (navTitle.includes(tableName)) {
            //console.info('当前在游戏' + tableName + '页面...');
            return betBaccInSingleTable(tableId, card1, card2, theTime, betAmount);
        }
        if (!isMutipleTable()) {
            console.info('当前不是多台游戏页面，忽略消息。');
            return false;
        }
        let maxBet = getMaxSelectedChipValue();
        const card1_num = (card1 % 13) + 1;
        const card2_num = (card2 % 13) + 1;
        let dot1 = card1_num >= 10 ? 0 : card1_num, dot2 = card2_num >= 10 ? 0 : card2_num;
        let xDot = (dot1 + dot2) % 10;
        let needBet,needBetAmount,theDotKey
        for(key in window.betRates){
            if(key.includes(''+xDot)){
                theDotKey = key
                needBet = window.betRates[key][1]
                needBetAmount = window.betRates[key][0]
                break
            }
        }
        if(card1_num==card2_num){
            let key = '闲对'
            theDotKey = key
            needBet = window.betRates[key][1]
            needBetAmount = window.betRates[key][0]
        }
        console.info("闲"+xDot+"["+card1_num+","+card2_num+"] 下注:"+theDotKey+" - "+needBet+" - "+needBetAmount);
        if(!needBet){
            return false;
        }

        // area-0:闲对  area-3:闲  area-5:庄  area-4:和
        const betAreaMap = {
            0: 'area-5',
            1: 'area-5',
            2: 'area-5',
            3: 'area-5',
            4: 'area-5',
            5: 'area-5',
            6: 'area-4',
            7: 'area-3',
            8: 'area-3',
            9: 'area-3'
        };

        const betArea = card1_num === card2_num ? 'area-0' : betAreaMap[xDot];
        let theBetAmount;
        if(betAmount>1){
            theBetAmount = betAmount;
        }else if (betAmount==-1||betAmount==0){
            theBetAmount = needBetAmount;
        }
        if(theBetAmount<=1){
            theBetAmount = maxBet * theBetAmount;
            theBetAmount = Math.round(theBetAmount / 10) * 10
        }
        if (theBetAmount < 10) theBetAmount = 10;
        console.info('bet area:'+betArea+' money:'+theBetAmount);
        if(self.wsNet){
            const randomTimeOffset = Math.floor(Math.random() * (300 - 100 + 1))+100;
            const timestmp = Date.now()

            area = betArea=='area-3'?4:betArea=='area-5'?5:betArea=='area-4'?2:betArea=='area-0'?1:'' ;//闲:4 , 庄:5 , 和:2 闲对:1
            self.wsNet.send(500, 2000, { roomId: tableId, betEnv: 3, carrier: tableId+'-' + timestmp, areaBet: [{ area: area, bet: theBetAmount * 100, betType: 0, count: 1 }] });
            console.info('handle pack spend time:', new Date().getTime() - theTime, card1_num, card2_num, betArea,theBetAmount);
            return true;
        }
        if (isBetting){
            console.debug("有其他桌正在下注...,本次取消："+tableId)
            return false;
        }
        isBetting = true;
        const coins = selectCoins(theBetAmount);
        if (coins.length == 0) return false;
        const chipValue = coins[0];
        const cnt = coins.filter(item => item === chipValue).length;
        const chipButton = document.querySelector(`div[data-type="${chipValue}"]`);
        const clickAreaSelector = `#lot-bet-item-box-${tableId} .${betArea} > div[fast-click]`;
        const confirmAreaSelector = `#lot-bet-item-box-${tableId} .${betArea} .button-click.chips-button-right`;
        const outDiv = document.querySelector(`#lot-bet-item-box-${tableId}`);
        let clickedBet = false;

        if (outDiv) {
            if (outDiv.getAttribute('class') == 'lazy-show' && outDiv.getAttribute('inview') == 'true') {
                clickChipAndBet();
            } else {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            observer.unobserve(outDiv); // 停止观察
                            if (outDiv.getAttribute('class') == 'lazy-show' && outDiv.getAttribute('inview') == 'true') {
                                clickChipAndBet();
                            } else {
                                const mutationObserver = new MutationObserver((mutationsList) => {
                                    for (let mutation of mutationsList) {
                                        if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'inview')) {
                                            if (outDiv.getAttribute('class') == 'lazy-show' && outDiv.getAttribute('inview') == 'true') {
                                                clickChipAndBet();
                                                mutationObserver.disconnect(); // 停止观察
                                            }
                                        }
                                    }
                                });
                                mutationObserver.observe(outDiv, { attributes: true, attributeFilter: ['class', 'inview'] });
                            }
                        }
                    });
                }, { threshold: 1 });
                observer.observe(outDiv);
                outDiv.scrollIntoView();
            }
            setTimeout(() => {
                clickChipAndBet();
            }, 20);
            return true;
        }
        function betBaccInSingleTable(tableId, card1, card2, theTime, betAmount){
            let maxBet = getMaxSelectedChipValue();
            const card1_num = (card1 % 13) + 1;
            const card2_num = (card2 % 13) + 1;
            let dot1 = card1_num >= 10 ? 0 : card1_num, dot2 = card2_num >= 10 ? 0 : card2_num;
            let xDot = (dot1 + dot2) % 10;
            let needBet,needBetAmount,theDotKey
            for(key in window.betRates){
                if(key.includes(''+xDot)){
                    theDotKey = key
                    needBet = window.betRates[key][1]
                    needBetAmount = window.betRates[key][0]
                    break
                }
            }
            if(card1_num==card2_num){
                let key = '闲对'
                theDotKey = key
                needBet = window.betRates[key][1]
                needBetAmount = window.betRates[key][0]
            }

            // area-0:闲对  area-4:闲  area-6:庄  area-5:和
            const betAreaMap = {
                0: 'area-banker',
                1: 'area-banker',
                2: 'area-banker',
                3: 'area-banker',
                4: 'area-banker',
                5: 'area-banker',
                6: 'area-tied',
                7: 'area-player',
                8: 'area-player',
                9: 'area-player'
            };
            const betArea = card1_num === card2_num ? 'area-id-1' : betAreaMap[xDot];
            let theBetAmount;
            if(betAmount>1){
                theBetAmount = betAmount;
            }else if (betAmount==-1||betAmount==0){
                theBetAmount = needBetAmount;
            }
            if(theBetAmount<=1){
                theBetAmount = maxBet * theBetAmount;
            }
            if (theBetAmount < 10) theBetAmount = 10;
            console.info("闲"+xDot+"["+card1_num+","+card2_num+"] 下注:"+theDotKey+" - "+betArea+" - "+theBetAmount+' - '+needBet);
            if(!needBet){
                return false;
            }
            if(window.wsNet){
                const randomTimeOffset = Math.floor(Math.random() * (300 - 100 + 1))+100;
                const timestmp = Date.now()-randomTimeOffset

                area = betArea=='area-player'?4:betArea=='area-banker'?5:betArea=='area-tied'?2:betArea=='area-id-1'?1:'' ;//闲:4 , 庄:5 , 和:2 闲对:1
                wsNet.send(500, 2000, { roomId: tableId, betEnv: 1, carrier: roomId+'-' + timestmp, areaBet: [{ area: area, bet: theBetAmount * 100, betType: 0, count: 1 }] });
                console.info('handle pack spend time:', new Date().getTime() - theTime, card1_num, card2_num, betArea,theBetAmount);
                return true;
            }
            const coins = selectCoins(theBetAmount);
            if(coins.length==0)return false;
            const chipValue = coins[0];
            const cnt = coins.filter(item => item === chipValue).length;
            const chipButton = document.querySelector(`div[data-type="${chipValue}"]`);
            if (chipButton && window.getComputedStyle(chipButton).display !== 'none' && chipButton.parentElement && window.getComputedStyle(chipButton.parentElement).display !== 'none') {
                const betAreaSelector = '#bettingSwiper .' + betArea+ '>div[data-safe-area]';
                const confirmSelector = '#bettingSwiper .' + betArea + ' .button-click.chips-button-right';
                chipButton.addEventListener('click', () => {
                    console.info(`handle message Clicked chip with value: ${chipValue}`);
                    clickBetAreaThenConfirm(betAreaSelector,confirmSelector,cnt,theTime);
                }, { once: true });
                clickCenter(chipButton);
                return true;
            }
            return false;
        }

        function clickChipAndBet() {
            if (chipButton && window.getComputedStyle(chipButton).display !== 'none' && chipButton.parentElement && window.getComputedStyle(chipButton.parentElement).display !== 'none' && !clickedBet) {
                clickedBet = true;
                // 检查 chipButton 是否具有 chips-select 类
                if (chipButton.classList.contains('chips-select')) {
                    console.info('chipButton already chips-select:',chipValue);
                    clickBetAreaThenConfirm(clickAreaSelector, confirmAreaSelector, cnt, theTime);
                } else {
                    console.info('chipButton does not have chips-select class, clicking chipButton and observing...');
                    clickCenter(chipButton);
                    clickedBet = true;
                    const observer = new MutationObserver((mutationsList) => {
                        for (let mutation of mutationsList) {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                                if (chipButton.classList.contains('chips-select')) {
                                    observer.disconnect();
                                    console.info(`handle message Clicked chip with value: ${chipValue}`);
                                    clickBetAreaThenConfirm(clickAreaSelector, confirmAreaSelector, cnt, theTime);
                                }
                            }
                        }
                    });
                    observer.observe(chipButton, { attributes: true, attributeFilter: ['class'] });
                }
            }
        }
    }

    function clickBetAreaThenConfirm(areaSelector, confirmSelector, count, theTime) {
        document.querySelectorAll(areaSelector).forEach(div => {
            for (let i = count - 1; i > 0; i--) {
                clickCenter(div);
            }
            const clickPromise = new Promise(resolve => {
                div.addEventListener('click', function () {
                    // 触发点击事件
                    const childDivs = document.querySelectorAll(confirmSelector);
                    childDivs.forEach(div1 => {
                        requestAnimationFrame(() => {
                            if (window.getComputedStyle(div1).display !== 'none' && div1.parentElement && window.getComputedStyle(div1.parentElement).display !== 'none') { // 检查子div是否显示
                                clickCenter(div1); // 延迟触发点击事件
                                console.info('handle message click confirm spend time:', new Date().getTime() - theTime);
                            }
                        });
                    });
                    resolve(); // 解析 Promise
                }, { once: true });
            });
            clickCenter(div);
            console.info('handle message click bet div spend time:', new Date().getTime() - theTime);
            // 等待 clickPromise 解析后再继续
            clickPromise.then(() => {
            });
        });
        isBetting = false
    }
    function sendMessageToContentScript(message) {
      
        
        window.postMessage({ action: "Echo", data: message },"*");
        // console.info("页面发送消息:", message);
    }
    self.handleTableMessage = handleTableMessage;
    self.sendMessageToContentScript = sendMessageToContentScript;

    // 暴露方法供外部调用
    self.handleMessage = handleMessage;

    function removeFloatingDiv(){
        const existingDiv = document.getElementById('betFloatingDiv');
        if (existingDiv) {
            existingDiv.remove();
            console.log("floating div removed!")
        }
    }
   // 创建悬浮的 div
    function createFloatingDiv() {
        // 检查是否已经存在悬浮 div
        removeFloatingDiv();
        const floatingDiv = document.createElement('div');
        floatingDiv.id = 'betFloatingDiv'; // 添加唯一的 id
        floatingDiv.style.position = 'fixed';
        floatingDiv.style.bottom = '20px';
        floatingDiv.style.left = '20px'; // 初始位置调整为左下角
        floatingDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        floatingDiv.style.border = '2px solid #ff6347'; // 设置鲜艳的颜色边框
        floatingDiv.style.padding = '10px';
        floatingDiv.style.borderRadius = '3px';
        floatingDiv.style.boxShadow = '0 2px 3px rgba(0, 0, 0, 0.2)';
        floatingDiv.style.zIndex = '10000';
        floatingDiv.style.cursor = 'move'; // 添加鼠标移动光标
        floatingDiv.style.width = '180px'; // 调整宽度以适应更多内容
        floatingDiv.style.height = 'auto'; // 高度自适应
        floatingDiv.style.fontSize = '12px';

        // 创建标题
        const title = document.createElement('div');
        title.id = 'bet-comment';
        title.textContent = '插件配置';
        title.style.textAlign = 'center';
        title.style.marginBottom = '10px';
        title.style.width = '100%';
        floatingDiv.appendChild(title);
        // 默认值
        const defaultValues = {
            '0庄': [0.29, false],
            '1庄': [0.28, false],
            '2庄': [0.25, false],
            '3庄': [0.21, false],
            '4庄': [0.14, false],
            '5庄': [0.05, false],
            '6和': [0.03, false],
            '7闲': [0.15, false],
            '8闲': [0.65, false],
            '9闲': [1, true],
            '闲对': [1, true],
            '龙虎': [1, true]
        };

        // 从 localStorage 加载数据，如果没有则使用默认值
        const storedValues = window.betRates || JSON.parse(localStorage.getItem('betRates')) || defaultValues;
        window.betRates = storedValues;
        let isLonghuPage = isLongHuPage();
        // 创建标签、输入框和复选框
        const labelsAndInputs = Object.keys(window.betRates);
        labelsAndInputs.forEach(labelText => {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.marginBottom = '3px';

            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.marginRight = '3px';
            label.style.flex = '1';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'checkbox_' + labelText;
            checkbox.style.marginRight = '3px';

            const input = document.createElement('input');
            input.type = 'number';
            input.name = 'input_' + labelText;
            input.style.width = '65%'; // 设置输入框宽度
            input.style.border = '1px solid #ccc';
            input.style.marginRight = '3px';

            // 设置默认值
            input.value = storedValues[labelText][0];
            checkbox.checked = storedValues[labelText][1];

            let display = isLonghuPage && labelText == '龙虎'||!isLonghuPage&&labelText !== '龙虎';
            container.style = 'display:'+(display?'block':'none');
			// 将标签、复选框和输入框添加到容器
			container.appendChild(label);
			container.appendChild(checkbox);
			container.appendChild(input);

			// 将容器添加到悬浮 div
			floatingDiv.appendChild(container);
            
        });

        // 创建保存按钮
        const saveButton = document.createElement('button');
        saveButton.textContent = '保存';
        saveButton.style.backgroundColor = '#007bff'; // 蓝色背景
        saveButton.style.color = '#fff'; // 白色文字
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '3px';
        saveButton.style.padding = '3px 10px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.width = '60px'; // 宽度占满整个 div
        saveButton.style.marginTop = '10px'; // 上边距

        saveButton.addEventListener('click', () => {
            const newValues = {};
            labelsAndInputs.forEach(labelText => {
                const checkbox = floatingDiv.querySelector(`input[name="checkbox_${labelText}"]`);
                const input = floatingDiv.querySelector(`input[name="input_${labelText}"]`);
                newValues[labelText] = [parseFloat(input.value) || defaultValues[labelText][0], checkbox.checked];
            });
            localStorage.setItem('betRates', JSON.stringify(newValues));
            window.betRates = newValues;
            console.info('数据已保存到 localStorage 并更新到 window.betRates');
        });

        // 将保存按钮添加到悬浮 div
        floatingDiv.appendChild(saveButton);

        // 添加拖动功能
        let offsetX, offsetY;

        floatingDiv.addEventListener('mousedown', (e) => {
            offsetX = e.clientX - floatingDiv.offsetLeft;
            offsetY = e.clientY - floatingDiv.offsetTop;
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        function mouseMoveHandler(e) {
            floatingDiv.style.left = (e.clientX - offsetX) + 'px';
            floatingDiv.style.top = (e.clientY - offsetY) + 'px';
        }

        function mouseUpHandler() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        }

        // 将悬浮 div 添加到 body
        document.body.appendChild(floatingDiv);
        console.info('betFloatingDiv div added');

    }

    function getMaxSelectedChipValue() {
        const selectedChips = document.querySelectorAll('#slide-container .relative.chips-icon');
        let maxValue = 0;
        selectedChips.forEach(chipDiv => {
            // 获取第一个子 div
            const firstChildDiv = chipDiv.querySelector('div');
            if (firstChildDiv) {
                // 获取 data-id 属性
                const dataId = firstChildDiv.getAttribute('data-id');
                // 将 data-id 转换为数字并更新 maxValue
                if (!dataId || dataId==='forbid_0') {
                    value = 0;
                } else {
                    value = parseInt(dataId.split('_')[1], 10);
                }
                if (!isNaN(value) && value > maxValue) {
                    maxValue = value;
                }
            }
        });
        return maxValue;
    }

    // 创建悬浮 div
    createFloatingDiv();
    // 添加自定义 CSS
    function addCustomCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* 自定义 CSS 规则 */
            .van-overlay {
                display: none;
            }
            .van-dialog {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
    // 调用函数添加 CSS
    addCustomCSS();

    console.info('injecting scripts successfully.');
    return true;
})();