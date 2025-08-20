document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('configForm');
    const wsUrlInput = document.getElementById('wsUrl');
    const amountInput = document.getElementById('amount');
    const gameUrlPatternInput = document.getElementById('gameUrlPattern');
    const status = document.getElementById('status');

    // 加载配置项
    chrome.storage.local.get(['wsUrl', 'amount', 'gameUrlPattern', 'enableMessage'], function(items) {
        wsUrlInput.value = items.wsUrl || 'ws://localhost:8765/wl';
        amountInput.value = items.amount;
        gameUrlPatternInput.value = items.gameUrlPattern || '888,/video';
        document.getElementById('enableMessage').checked = items.enableMessage || false; // 默认不启用
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();

        const wsUrl = wsUrlInput.value;
        const amount = parseFloat(amountInput.value);
        const gameUrlPattern = gameUrlPatternInput.value;
        const enableMessage = document.getElementById('enableMessage').checked;

        if (!wsUrl) {
            status.textContent = 'WebSocket服务器地址不能为空';
            status.style.color = 'red';
            return;
        }
        
        if (isNaN(amount)) {
            status.textContent = '金额必须是数字';
            status.style.color = 'red';
            return;
        }

        if (!gameUrlPattern) {
            status.textContent = '游戏URL特征不能为空';
            status.style.color = 'red';
            return;
        }

        chrome.storage.local.set({ wsUrl,amount, gameUrlPattern,enableMessage  }, function() {
            status.textContent = '配置保存成功';
            status.style.color = 'green';
        });
    });
});
