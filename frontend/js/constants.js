const API_BASE_URL = 'https://slot-fcu7.onrender.com';
const SYMBOL_MAP = {
    "Cherry": "🍒", "Lemon": "🍋", "Orange": "🍊",
    "Plum": "🍇", "Bell": "🔔", "Bar": "🍫", "Seven": "7️⃣"
};

const SPIN_ANIMATION_BASE_DURATION_S = 0.5;  // Базовая скорость анимации
const INITIAL_SPIN_DELAY_MS = 1000;          // Задержка перед остановкой
const SYMBOL_HEIGHT_PX = 56;                 // Высота символа
const VISIBLE_ROWS = 3;                      // Видимые ряды
const DOM_SYMBOLS_PER_REEL = 10;             // Всего символов на барабане
