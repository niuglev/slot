// --- Элементы DOM ---
let reelsAreaElement;
let reelsHostContainerElement;
let balanceSpanElement;
let spinButtonElement;
let betButtons;
let currentBetDisplayElement;
let errorNotificationElement;
let errorMessageSpanElement;
let paylinesSvgContainer;
let reelElements = [];

// Элементы для "Магия Спина"
let winNotificationContainerElement;
let winNotificationBannerElement;
let winAmountBannerSpanElement;

// --- Функции UI ---
function updateUserBalanceDisplay(newBalance) {
    currentBalance = newBalance;
    if (balanceSpanElement) balanceSpanElement.textContent = newBalance;
}

function updateCurrentBetDisplay(newBet) {
    currentBet = newBet;
    if (currentBetDisplayElement) currentBetDisplayElement.textContent = newBet;
}

function showWinNotificationBanner(amount) {

    winAmountBannerSpanElement.textContent = amount;
    winNotificationBannerElement.classList.add('show');
    winNotificationBannerElement.classList.remove('opacity-0', '-translate-y-full');
    playSound('win');



    setTimeout(() => {
        winNotificationBannerElement.classList.remove('show');
        winNotificationBannerElement.classList.add('opacity-0', '-translate-y-full');
    }, 3000);
}

function showErrorNotification(message) {
    if (!errorNotificationElement || !errorMessageSpanElement) return;
    errorMessageSpanElement.textContent = message;
    errorNotificationElement.classList.remove('hidden');
    errorNotificationElement.classList.add('show');
}

const reelAnimations = [];

function setReelSymbols(reelElement, symbols, isSpinning = false) {
    const symbolsContainer = reelElement.querySelector('.reel-symbols-container');
    if (!symbolsContainer) return;

    const symbolDOMElements = Array.from(symbolsContainer.querySelectorAll('.symbol'));
    const visibleStartIndex = Math.floor((DOM_SYMBOLS_PER_REEL - VISIBLE_ROWS) / 2 -3);

    for (let i = 0; i < DOM_SYMBOLS_PER_REEL; i++) {
        const symbolElement = symbolDOMElements[i];
        const isVisible = i >= visibleStartIndex && i < visibleStartIndex + VISIBLE_ROWS;

        // Для видимых символов используем переданные значения
        if (isVisible) {
            const symbolIndex = i - visibleStartIndex;
            if (symbolIndex < symbols.length) {
                symbolElement.textContent = SYMBOL_MAP[symbols[symbolIndex]] || symbols[symbolIndex];
            }
        }
        // Для фейковых символов используем случайные
        else {
            const filler = serverConfig.symbols[Math.floor(Math.random() * serverConfig.symbols.length)];
            symbolElement.textContent = SYMBOL_MAP[filler] || filler;
        }

        // Плавное изменение состояния
        gsap.to(symbolElement, {
            opacity: isSpinning ? (isVisible ? 1 : 0.7) : (isVisible ? 1 : 0),
            filter: isSpinning ? (isVisible ? 'blur(0.5px)' : 'blur(2px)') : 'none',
            duration: 0.5,
            overwrite: 'auto'
        });
    }
}

function startReelSpinAnimation() {
    reelAnimations.forEach(anim => anim.kill());
    reelAnimations.length = 0;

    reelElements.forEach((reel, index) => {
        const container = reel.querySelector('.reel-symbols-container');
        if (!container) return;

        const symbolHeight = SYMBOL_HEIGHT_PX;
        const totalHeight = symbolHeight * DOM_SYMBOLS_PER_REEL;

        // Инициализация случайными символами
        const spinSymbols = Array(VISIBLE_ROWS).fill().map(() =>
            serverConfig.symbols[Math.floor(Math.random() * serverConfig.symbols.length)]
        );
        setReelSymbols(reel, spinSymbols, true);

        // Плавное ускорение
        const spinUp = gsap.to(container, {
            y: totalHeight,
            duration: 0.7,
            ease: "power2.out",
            onComplete: () => {
                // Бесконечное вращение
                const mainSpin = gsap.to(container, {
                    y: `+=${totalHeight}`,
                    duration: 0.4,
                    ease: "none",
                    repeat: -1,
                    modifiers: {
                        y: y => {
                            const newY = parseFloat(y) % totalHeight;
                            return newY;
                        }
                    },
                    onRepeat: () => {
                        // Обновляем символы каждое повторение
                        const newSymbols = Array(VISIBLE_ROWS).fill().map(() =>
                            serverConfig.symbols[Math.floor(Math.random() * serverConfig.symbols.length)]
                        );
                        setReelSymbols(reel, newSymbols, true);
                    }
                });
                reelAnimations[index] = mainSpin;
            }
        });
    });
}

function stopReelSpinAnimation(finalGrid) {
    const reelStopPromises = [];

    reelElements.forEach((reel, reelIndex) => {
        const promise = new Promise(resolve => {
            const container = reel.querySelector('.reel-symbols-container');
            if (!container) { resolve(); return; }

            const animation = reelAnimations[reelIndex];
            if (animation) animation.kill();

            const finalSymbols = finalGrid[reelIndex] || [];
            const symbolHeight = SYMBOL_HEIGHT_PX;
            const totalHeight = symbolHeight * DOM_SYMBOLS_PER_REEL;

            if (skipRequested) {
                // Пропущенный спин — мгновенная подмена
                setReelSymbols(reel, finalSymbols, false);
                gsap.set(container, { y: 0 });
                resolve();
                return;
            }

            // Текущая позиция
            const currentY = parseFloat(gsap.getProperty(container, "y"));
            const extraSpins = 3;
            const targetPosition = (extraSpins * totalHeight) + currentY;
            let symbolsSwapped = false;

            gsap.to(container, {
                y: targetPosition,
                duration: 1.8,
                ease: "back.out(0.8)",
                delay: 0.2 * reelIndex,
                onUpdate: function () {
                    if (this.progress() > 0.7 && !symbolsSwapped) {
                        setReelSymbols(reel, finalSymbols, true);
                        symbolsSwapped = true;
                    }
                },
                onComplete: () => {
                    gsap.set(container, { y: 0 });
                    setReelSymbols(reel, finalSymbols, false);
                    resolve();
                }
            });
        });

        reelStopPromises.push(promise);
    });

    return reelStopPromises;
}


function clearPaylineHighlights() {
    if (!paylinesSvgContainer) return;
    Object.values(paylineSvgElements).forEach(path => path.classList.remove('active'));
}

function highlightWinningLines(winningLineIndices) {
    if (!paylinesSvgContainer || !serverConfig.paylines) return;
    clearPaylineHighlights();

    winningLineIndices.forEach(lineIndex => {
        const pathElement = paylineSvgElements[lineIndex];
        if (pathElement) {
            pathElement.classList.add('active');

            // Временная подсветка для отладки
            console.log(`Highlighting payline ${lineIndex}:`, pathElement.getAttribute('d'));
        }
    });

    setTimeout(() => {
        clearPaylineHighlights();
    }, 3800);
}

function getSymbolCoordinates(reelIndex, rowIndex, reelWidth, reelGap) {
    const reelElement = reelElements[reelIndex];
    if (!reelElement) return { x: 0, y: 0 };

    const symbolHeight = SYMBOL_HEIGHT_PX;
    const reelRect = reelElement.getBoundingClientRect();
    const containerRect = reelsHostContainerElement.getBoundingClientRect();

    // Относительные координаты внутри барабана
    const x = reelRect.left - containerRect.left + reelWidth / 2;
    const y = reelRect.top - containerRect.top + (rowIndex + 0.5) * symbolHeight;

    return { x, y };
}

function createPaylineVisualsSVG(paylineDefinitions) {
    if (!paylinesSvgContainer || !reelsHostContainerElement || reelElements.length === 0) return;

    paylinesSvgContainer.innerHTML = '';
    paylineSvgElements = {};

    const reelWidth = parseFloat(window.getComputedStyle(reelElements[0]).width);
    const reelsContainerStyle = window.getComputedStyle(reelsHostContainerElement);
    const gapValue = reelsContainerStyle.gap.split(' ')[0];
    const reelGap = parseFloat(gapValue) || 8;

    // Получаем реальные размеры контейнера
    const reelsRect = reelsHostContainerElement.getBoundingClientRect();
    paylinesSvgContainer.setAttribute('viewBox', `0 0 ${reelsRect.width} ${reelsRect.height}`);
    paylinesSvgContainer.style.width = `${reelsRect.width}px`;
    paylinesSvgContainer.style.height = `${reelsRect.height}px`;

    paylineDefinitions.forEach(lineDef => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('payline-path');
        path.setAttribute('stroke', 'gold');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');

        let d = '';
        const points = [];

        // Собираем все точки линии
        lineDef.cells.forEach((cell, index) => {
            const coords = getSymbolCoordinates(cell[0], cell[1], reelWidth, reelGap);
            points.push(coords);

            if (index === 0) {
                d += `M ${coords.x} ${coords.y}`;
            } else {
                d += ` L ${coords.x} ${coords.y}`;
            }
        });

        // Сглаживание линии через кривые Безье
        if (points.length > 2) {
            d = '';
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (i === 0) {
                    d += `M ${p.x},${p.y}`;
                } else {
                    // Рассчитываем контрольные точки для сглаживания
                    const prev = points[i - 1];
                    const next = points[i + 1] || p;
                    const cp1x = prev.x + (p.x - prev.x) * 0.5;
                    const cp1y = prev.y;
                    const cp2x = p.x - (next.x - p.x) * 0.5;
                    const cp2y = p.y;

                    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p.x},${p.y}`;
                }
            }
        }

        path.setAttribute('d', d);
        paylinesSvgContainer.appendChild(path);
        paylineSvgElements[lineDef.index] = path;
    });
}

function createReelDOM(numberOfReels) {
    if (!reelsHostContainerElement) return;
    reelsHostContainerElement.innerHTML = '';
    reelElements = [];

    for (let i = 0; i < numberOfReels; i++) {
        const reelDiv = document.createElement('div');
        reelDiv.className = 'reel';
        reelDiv.style.width = '64px';
        reelDiv.style.height = `${SYMBOL_HEIGHT_PX * VISIBLE_ROWS}px`;
        reelDiv.id = `reel-${i}`;

        const symbolsContainerDiv = document.createElement('div');
        symbolsContainerDiv.className = 'reel-symbols-container absolute w-full';
        symbolsContainerDiv.style.height = `${SYMBOL_HEIGHT_PX * DOM_SYMBOLS_PER_REEL}px`;
        symbolsContainerDiv.style.transform = 'translateZ(0)'; // GPU ускорение

        for (let j = 0; j < DOM_SYMBOLS_PER_REEL; j++) {
            const symbolDiv = document.createElement('div');
            symbolDiv.className = 'symbol w-full flex items-center justify-center';
            symbolDiv.style.height = `${SYMBOL_HEIGHT_PX}px`;
            symbolDiv.style.position = 'absolute';
            symbolDiv.style.top = `${j * SYMBOL_HEIGHT_PX}px`;
            symbolDiv.style.willChange = 'opacity, filter';
            symbolDiv.style.pointerEvents = 'none';
            symbolsContainerDiv.appendChild(symbolDiv);
        }

        reelDiv.appendChild(symbolsContainerDiv);
        reelsHostContainerElement.appendChild(reelDiv);
        reelElements.push(reelDiv);
    }
}