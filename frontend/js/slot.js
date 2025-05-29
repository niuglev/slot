// --- Состояние игры ---
let currentBet = 1;
let currentBalance = 0;
let serverConfig = {
    reels: 5,
    rows: 3,
    symbols: Object.keys(SYMBOL_MAP),
    paylines: []
};
let isSpinning = false;
let paylineSvgElements = {};
let lastWinDetails = null;
let skipRequested = false;
let autoplayEnabled = false;
let autoplayTimer = null;

// --- Логика Спина ---
async function handleSpinAction() {
    if (isSpinning) return;

    isSpinning = true;
    skipRequested = false;
    spinButtonElement.innerHTML = '⏩ Пропустить';
    clearPaylineHighlights();

    playSound('spin');

    reelElements.forEach(reel => {
        const container = reel.querySelector('.reel-symbols-container');
        if (container) {
            gsap.set(container, {
                y: 0,
                opacity: 1,
                filter: 'blur(0px)'
            });
        }
    });

    startReelSpinAnimation();
    let responseData = null;

    try {
        const response = await fetch(`${API_BASE_URL}/spin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet: currentBet })
        });

        responseData = await response.json();
        if (!response.ok) throw new Error(responseData.error || `Server error: ${response.status}`);

        finalSpinResult = responseData.grid;

        // Ждем, но если пользователь нажал "⏩", мы не ждем
        let waited = 0;
        const waitTime = INITIAL_SPIN_DELAY_MS + 1800;
        while (waited < waitTime && !skipRequested) {
            await new Promise(res => setTimeout(res, 100));
            waited += 100;
        }

        if (!skipRequested) {
            const reelStopPromises = stopReelSpinAnimation(responseData.grid);
            await Promise.all(reelStopPromises);
        }

        if (responseData.payout?.amount > 0) {
            showWinNotificationBanner(responseData.payout.amount);
            if (responseData.payout.lines?.length > 0) {
                highlightWinningLines(responseData.payout.lines);
            }
        }

    } catch (error) {
        console.error("Error:", error);
        showErrorNotification(error.message || 'Network error');
        const fallbackGrid = reelElements.map(() => Array(VISIBLE_ROWS).fill("?"));
        const reelStopPromises = stopReelSpinAnimation(fallbackGrid);
        await Promise.all(reelStopPromises);
    } finally {
        isSpinning = false;
        skipRequested = false;
        finalSpinResult = null;
        spinButtonElement.disabled = false;
        spinButtonElement.innerHTML = 'Крутить';
        updateUserBalanceDisplay(responseData?.balance);
        if (autoplayEnabled) {
            autoplayTimer = setTimeout(() => {
                handleSpinAction();
            }, 300); // пауза между авто-спинами
        }
        if (!autoplayEnabled && autoplayTimer) {
            clearTimeout(autoplayTimer);
            autoplayTimer = null;
        }
    }
}


function forceStopSpin(finalGrid) {
    reelAnimations.forEach(anim => anim.kill());
    reelAnimations.length = 0;

    reelElements.forEach((reel, reelIndex) => {
        const container = reel.querySelector('.reel-symbols-container');
        if (!container) return;

        const finalSymbols = finalGrid[reelIndex] || [];

        setReelSymbols(reel, finalSymbols, false);
        gsap.set(container, { y: 0 });
    });
}



// --- Инициализация ---
async function initializeSlotMachine() {
    // Получаем элементы DOM
    reelsAreaElement = document.getElementById('reels-area');
    reelsHostContainerElement = document.getElementById('reels');
    balanceSpanElement = document.getElementById('balance');
    spinButtonElement = document.getElementById('spin-button');
    betButtons = document.querySelectorAll('.bet-btn');
    currentBetDisplayElement = document.getElementById('current-bet-display');
    errorNotificationElement = document.getElementById('error-notification');
    errorMessageSpanElement = document.getElementById('error-message');
    paylinesSvgContainer = document.getElementById('paylines-svg-container');

    winNotificationContainerElement = document.getElementById('win-notification-container');
    winNotificationBannerElement = document.getElementById('win-notification-banner');
    winAmountBannerSpanElement = document.getElementById('win-amount-banner');


    // Создаем барабаны
    createReelDOM(5);

    // Настраиваем обработчики событий
    betButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSpinning) return;
            betButtons.forEach(b => b.classList.remove('active-bet'));
            btn.classList.add('active-bet');
            updateCurrentBetDisplay(parseInt(btn.dataset.bet));
        });
    });

    spinButtonElement.addEventListener('click', handleSpinAction);

    let finalSpinResult = null;

    spinButtonElement.onclick = async () => {


        await handleSpinAction();
    };



    try {
        // Получаем начальное состояние с сервера
        const response = await fetch(`${API_BASE_URL}/state`);
        if (!response.ok) throw new Error('Ошибка сервера');
        const state = await response.json();

        serverConfig = {
            reels: state.reels || 5,
            rows: state.rows || 3,
            symbols: state.symbols || Object.keys(SYMBOL_MAP),
            paylines: state.paylines || []
        };

        // Обновляем UI
        updateUserBalanceDisplay(state.balance);
        createReelDOM(serverConfig.reels);

        // Задержка для корректного расчета размеров
        await new Promise(resolve => setTimeout(resolve, 50));
        createPaylineVisualsSVG(serverConfig.paylines);

        // Устанавливаем начальные символы
        reelElements.forEach(reelElement => {
            setReelSymbols(reelElement, Array(VISIBLE_ROWS).fill("?"));
        });

        spinButtonElement.disabled = false;
    } catch (error) {
        console.error("Ошибка инициализации:", error);
        showErrorNotification("Ошибка подключения к серверу");
        if (spinButtonElement) {
            spinButtonElement.disabled = true;
            spinButtonElement.textContent = 'Ошибка';
        }
    }
    const autoplayToggle = document.getElementById('autoplay-toggle');

    if (autoplayToggle) {
        autoplayToggle.addEventListener('change', () => {
            autoplayEnabled = autoplayToggle.checked;

            // Если включили и не крутим — сразу запускаем
            if (autoplayEnabled && !isSpinning) {
                handleSpinAction();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initializeSlotMachine);