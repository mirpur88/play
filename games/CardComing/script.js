/**
 * CARD COMING - Elite Match Slots
 */

const CONFIG = {
    SYMBOL_HEIGHT: 100,
    REEL_SYMBOLS: [
        ['W', 'A+', 'A', 'K', 'Q', 'J', '10'],
        ['A+', 'W', 'A', 'K', 'Q', 'J', '10'],
        ['A', 'K', 'W', 'A+', 'Q', 'J', '10'],
        ['x2', 'x5', 'x2', 'x10', 'x2', 'x2', 'x2', 'x2', 'x2', 'x5', 'x10']
    ]
};

let balance = 0;
let isSpinning = false;
let notifyBox, balanceEl, betInput, spinBtn;

function init() {
    balance = GameBridge.getBalance();
    notifyBox = document.getElementById('notify-box');
    balanceEl = document.getElementById('balance-amount');
    betInput = document.getElementById('bet-amount');
    spinBtn = document.getElementById('spin-btn');

    updateBalanceDisplay();
    setupReels();
    attachListeners();
}

function updateBalanceDisplay() {
    balanceEl.innerText = balance.toFixed(2);
}

function setupReels() {
    const symbolsSet = CONFIG.REEL_SYMBOLS;

    const reels = document.querySelectorAll('.reel');
    reels.forEach((reel, i) => {
        const strip = reel.querySelector('.strip');
        strip.innerHTML = '';

        const symbols = symbolsSet[i];
        // Create 100 sets for infinite scrolling effect
        for (let j = 0; j < 100; j++) {
            symbols.forEach(symbol => {
                const div = document.createElement('div');
                div.className = 'symbol';
                div.dataset.val = symbol;
                div.innerText = symbol === '—' ? ' ' : symbol;
                strip.appendChild(div);
            });
        }

        // Initial position
        const symbolCount = symbols.length;
        const middleOffset = (50 * symbolCount) * CONFIG.SYMBOL_HEIGHT;
        strip.style.transform = `translateY(-${middleOffset - CONFIG.SYMBOL_HEIGHT}px)`;
        reel.dataset.pos = 50 * symbolCount;
    });
}

function attachListeners() {
    spinBtn.addEventListener('click', handleSpin);

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (isSpinning) return;
        let val = parseInt(betInput.value);
        if (val > 10) betInput.value = val - 10;
        // No need to rebuild reels as symbols are constant now
    });

    document.getElementById('plus-bet').addEventListener('click', () => {
        if (isSpinning) return;
        betInput.value = parseInt(betInput.value) + 10;
        // No need to rebuild reels as symbols are constant now
    });

    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSpinning) return;
            betInput.value = btn.dataset.val;
            // No need to rebuild reels as symbols are constant now
        });
    });
}

async function handleSpin() {
    if (isSpinning) return;

    const bet = parseInt(betInput.value);
    if (balance < bet) {
        showNotify("Insufficient Balance!", true);
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;
    notifyBox.classList.remove('show');

    balance -= bet;
    updateBalanceDisplay();
    await GameBridge.updateBalance(balance, -bet, "Card Coming Bet");

    const currentSymbolsSet = CONFIG.REEL_SYMBOLS;

    // Generate results
    const results = [
        Math.floor(Math.random() * currentSymbolsSet[0].length),
        Math.floor(Math.random() * currentSymbolsSet[1].length),
        Math.floor(Math.random() * currentSymbolsSet[2].length),
        Math.floor(Math.random() * currentSymbolsSet[3].length)
    ];

    const reels = document.querySelectorAll('.reel');
    reels.forEach((reel, i) => {
        const strip = reel.querySelector('.strip');
        const symbols = currentSymbolsSet[i];
        const symbolCount = symbols.length;

        const targetSymbolIndex = results[i];
        const extraSpins = 40 + (i * 5);
        const finalPosition = (extraSpins * symbolCount) + targetSymbolIndex;

        const offset = (finalPosition - 1) * CONFIG.SYMBOL_HEIGHT;

        strip.style.transition = `transform ${0.8 + i * 0.15}s cubic-bezier(0.15, 0, 0.15, 1)`;
        strip.style.transform = `translateY(-${offset}px)`;

        setTimeout(() => {
            strip.style.transition = 'none';
            const safePosition = (50 * symbolCount) + targetSymbolIndex;
            const resetOffset = (safePosition - 1) * CONFIG.SYMBOL_HEIGHT;
            strip.style.transform = `translateY(-${resetOffset}px)`;
            reel.dataset.pos = safePosition;
        }, (0.8 + i * 0.15) * 1000 + 50);
    });

    setTimeout(async () => {
        const winAmount = calculateWin(results, bet);

        if (winAmount > 0) {
            balance += winAmount;
            updateBalanceDisplay();
            await GameBridge.updateBalance(balance, winAmount, "Card Coming Win");
            showNotify(`💰 YOU WON: ৳${winAmount.toFixed(2)}`, false);
        }

        isSpinning = false;
        spinBtn.disabled = false;
        // removed setupReels() to prevent flickering

        if (document.getElementById('auto-spin-switch').checked && !isSpinning) {
            setTimeout(handleSpin, 300);
        }
    }, 1500);
}

function calculateWin(results, bet) {
    const symbolsSet = CONFIG.REEL_SYMBOLS;

    const s1 = symbolsSet[0][results[0]];
    const s2 = symbolsSet[1][results[1]];
    const s3 = symbolsSet[2][results[2]];
    const sSpec = symbolsSet[3][results[3]];

    console.log(`[CardComing] Lands: ${s1}, ${s2}, ${s3} | Special: ${sSpec}`);

    let multiplier = 0;

    // Check 3 of a kind with WILD (W) Support
    const symbols = [s1, s2, s3];
    const nonWilds = symbols.filter(s => s !== 'W' && s !== '—');

    // 1. Full Match with Wilds
    let matchSymbol = null;
    if (nonWilds.length === 0 && symbols.every(s => s === 'W')) {
        matchSymbol = 'W'; // Triple Wild!
    } else {
        const first = nonWilds[0];
        if (first && symbols.every(s => s === first || s === 'W')) {
            matchSymbol = first;
        }
    }

    let baseWin = 0;
    if (matchSymbol) {
        // Individual symbol values as % of bet
        const symbolValues = {
            'W': 2.0,   // 200% (Joker Jackpot)
            'A+': 2.0,  // 200%
            'A': 1.0,   // 100%
            'K': 0.8,   // 80%
            'Q': 0.7,   // 70%
            'J': 0.6,   // 60%
            '10': 0.5   // 50%
        };

        // Sum 3 symbols (Wilds take the value of the match)
        const unitValue = bet * (symbolValues[matchSymbol] || 0.1);
        baseWin = unitValue + unitValue + unitValue;
    }

    // 2. Special reel multiplier (Flexible parsing)
    let extraMul = 1;
    if (sSpec) {
        if (sSpec.includes('x20')) extraMul = 20;
        else if (sSpec.includes('x10')) extraMul = 10;
        else if (sSpec.includes('x5')) extraMul = 5;
        else if (sSpec.includes('x2')) extraMul = 2;
    }

    let finalWin = baseWin * extraMul;

    // 3. Optional Safety Cap (Set to extremely high so it doesn't interfere)
    let absoluteLimit = bet * 1000;
    if (finalWin > absoluteLimit) finalWin = absoluteLimit;

    return finalWin;
}

function showNotify(text, isError = false) {
    notifyBox.innerText = text;
    notifyBox.style.background = isError ? "linear-gradient(135deg, #ff2d55 0%, #8b0000 100%)" : "linear-gradient(135deg, #ffcc00 0%, #ff8c00 100%)";
    notifyBox.style.color = isError ? "white" : "black";
    notifyBox.classList.add('show');
    if (isError) setTimeout(() => notifyBox.classList.remove('show'), 3000);
}

init();
