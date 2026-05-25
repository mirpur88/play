/**
 * MONEY COMING - High Multiplier Game
 */

const CONFIG = {
    REEL_SYMBOLS: [
        ['—', '1', '—', '5', '—', '10', '—', '0', '—', '2', '—'], // Base symbols
        ['—', '0', '—', '5', '—', '1', '—', '0', '—', '0', '—'],
        ['—', '0', '—', '0', '—', '0', '—', '5', '—', '0', '—'],
        ['—', 'x2', '—', 'x5', '—', 'x10', '—', 'x2', '—']
    ],
    HIGH_SYMBOLS: [
        ['—', '10', '—', '50', '—', '100', '—', '10', '—', '50', '—'],
        ['—', '0', '—', '5', '—', '0', '—', '10', '—', '5', '—'],
        ['—', '00', '—', '0', '—', '00', '—', '5', '—', '0', '—'],
        ['—', 'x2', '—', 'x5', '—', 'x10', '—', 'x5', '—']
    ],
    SYMBOL_HEIGHT: 120,
    SPIN_STRENGTH: 20
};

let balance = GameBridge.getBalance();
let isSpinning = false;

// DOM
const balanceDisplay = document.getElementById('balance-amount');
const betInput = document.getElementById('bet-amount');
const spinBtn = document.getElementById('spin-btn');
const notifyBox = document.getElementById('notification');

function init() {
    updateBalanceDisplay();
    setupReels();
    addEventListeners();
}

let lastBetLevel = null;

function updateBalanceDisplay() {
    balanceDisplay.innerText = `৳${balance.toFixed(2)}`;
}

function setupReels(force = false) {
    const bet = parseFloat(betInput.value);
    const isHigh = bet >= 100;

    // Only refresh if bet level changed or forced
    if (lastBetLevel === isHigh && !force) return;
    lastBetLevel = isHigh;

    const symbolsSet = isHigh ? CONFIG.HIGH_SYMBOLS : CONFIG.REEL_SYMBOLS;

    // Use constant height for all devices (standardized to mobile view)
    CONFIG.SYMBOL_HEIGHT = 100;

    const reels = document.querySelectorAll('.reel');
    reels.forEach((reel, i) => {
        const strip = reel.querySelector('.strip');
        const symbols = symbolsSet[i];

        // Create a very long strip for looping
        let content = '';
        for (let j = 0; j < 100; j++) {
            symbols.forEach(s => {
                content += `<div class="symbol" data-val="${s}">${s}</div>`;
            });
        }
        strip.innerHTML = content;
        strip.style.transition = 'none';

        // Keep current position if possible, else reset
        const currentPos = parseInt(reel.dataset.pos) || 0;
        const offset = currentPos * CONFIG.SYMBOL_HEIGHT;
        strip.style.transform = `translateY(-${offset}px)`;
    });
}

function addEventListeners() {
    spinBtn.addEventListener('click', handleSpin);

    document.getElementById('plus-bet').addEventListener('click', () => {
        if (isSpinning) return;
        betInput.value = parseInt(betInput.value) + 10;
    });

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (isSpinning) return;
        let val = parseInt(betInput.value);
        if (val > 10) betInput.value = val - 10;
        setupReels(); // Update immediately
    });

    document.getElementById('plus-bet').addEventListener('click', () => {
        if (isSpinning) return;
        betInput.value = parseInt(betInput.value) + 10;
        setupReels(); // Update immediately
    });

    betInput.addEventListener('change', () => {
        if (isSpinning) return;
        setupReels();
    });

    // Quick Bets
    document.querySelectorAll('.q-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSpinning) return;
            betInput.value = btn.dataset.val;
            setupReels();
        });
    });
}

async function handleSpin() {
    if (isSpinning) return;

    const bet = parseFloat(betInput.value);
    if (bet > balance) {
        showNotify("Insufficient Funds!", true);
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;
    notifyBox.classList.remove('show'); // Clear before spin

    // Deduction
    balance -= bet;
    updateBalanceDisplay();
    await GameBridge.updateBalance(balance, -bet, "Money Coming Spin");

    // Deciding Result (Simulated)
    const reels = document.querySelectorAll('.reel');
    const currentSymbolsSet = bet >= 100 ? CONFIG.HIGH_SYMBOLS : CONFIG.REEL_SYMBOLS;

    const results = [
        Math.floor(Math.random() * currentSymbolsSet[0].length),
        Math.floor(Math.random() * currentSymbolsSet[1].length),
        Math.floor(Math.random() * currentSymbolsSet[2].length),
        Math.floor(Math.random() * currentSymbolsSet[3].length)
    ];

    reels.forEach((reel, i) => {
        const strip = reel.querySelector('.strip');
        const symbols = currentSymbolsSet[i];
        const symbolCount = symbols.length;

        // Use a high number for the spin but keep it within bounds of our 100 repetitions
        const targetSymbolIndex = results[i];
        const extraSpins = 40 + (i * 5);
        const finalPosition = (extraSpins * symbolCount) + targetSymbolIndex;

        // Offset by -1 to center the symbol in the 3-symbol high reel
        const offset = (finalPosition - 1) * CONFIG.SYMBOL_HEIGHT;

        strip.style.transition = `transform ${0.8 + i * 0.15}s cubic-bezier(0.15, 0, 0.15, 1)`;
        strip.style.transform = `translateY(-${offset}px)`;

        // After transition, jump back to a safe "middle" repetition
        setTimeout(() => {
            strip.style.transition = 'none';
            // Jump to repetition 50 to ensure we have symbols above and below
            const safePosition = (50 * symbolCount) + targetSymbolIndex;
            const resetOffset = (safePosition - 1) * CONFIG.SYMBOL_HEIGHT;
            strip.style.transform = `translateY(-${resetOffset}px)`;
            reel.dataset.pos = safePosition;
        }, (0.8 + i * 0.15) * 1000 + 50);
    });

    // Wait for last reel
    setTimeout(async () => {
        const winAmount = calculateWin(results, bet);

        if (winAmount > 0) {
            balance += winAmount;
            updateBalanceDisplay();
            await GameBridge.updateBalance(balance, winAmount, "Money Coming Win");
            showNotify(`💰 YOU WON: ৳${winAmount.toFixed(2)}`, false);
            document.getElementById('reels-area').classList.add('win-active');
            setTimeout(() => document.getElementById('reels-area').classList.remove('win-active'), 2000);
        } else {
            notifyBox.classList.remove('show');
        }

        isSpinning = false;
        spinBtn.disabled = false;
        // setupReels() removed

        // Check for Auto-Spin
        const isAuto = document.getElementById('auto-spin-switch').checked;
        if (isAuto && !isSpinning) {
            setTimeout(handleSpin, 300);
        }
    }, 1500);
}

function calculateWin(results, bet) {
    const isHigh = bet >= 100;
    const symbolsSet = isHigh ? CONFIG.HIGH_SYMBOLS : CONFIG.REEL_SYMBOLS;

    const s1 = symbolsSet[0][results[0]];
    const s2 = symbolsSet[1][results[1]];
    const s3 = symbolsSet[2][results[2]];
    const sSpec = symbolsSet[3][results[3]];

    console.log(`[MoneyComing] Result Symbols: ${s1}, ${s2}, ${s3} | Spec: ${sSpec}`);

    // If any number reel is a blank, it contributes nothing to the string
    let v1 = (s1 === '—') ? "" : s1;
    let v2 = (s2 === '—') ? "" : s2;
    let v3 = (s3 === '—') ? "" : s3;

    // Concatenate numeric strings (e.g. "1" + "0" + "0" = "100")
    let combined = v1 + v2 + v3;
    let baseValue = combined === "" ? 0 : parseInt(combined);

    // Multiplier from special reel
    let multiplier = 1;
    if (sSpec === 'x2') multiplier = 2;
    if (sSpec === 'x5') multiplier = 5;
    if (sSpec === 'x10') multiplier = 10;

    let finalWin = baseValue * multiplier;

    // Apply Win Tiers Logic (Risk Management)
    let maxAllowed = Infinity;
    if (bet <= 10) maxAllowed = 400;
    else if (bet <= 50) maxAllowed = 2500;
    else if (bet <= 100) maxAllowed = 10000;
    else if (bet <= 500) maxAllowed = 50000;
    else if (bet <= 1000) maxAllowed = 100000;
    else if (bet <= 3000) maxAllowed = 250000;
    else if (bet <= 5000) maxAllowed = 600000;
    else if (bet <= 10000) maxAllowed = 1000000;
    else maxAllowed = bet * 100; // Default safety fallback for higher bets

    if (finalWin > maxAllowed) {
        console.log(`[MoneyComing] Capping win: Real ${finalWin} -> Capped ${maxAllowed}`);
        finalWin = maxAllowed;
    }

    console.log(`[MoneyComing] Final Win to Player: ${finalWin}`);
    return finalWin;
}

function showNotify(text, isError = false) {
    notifyBox.innerText = text;
    notifyBox.style.background = isError ? "linear-gradient(135deg, #ff2d55 0%, #8b0000 100%)" : "linear-gradient(135deg, #ffcc00 0%, #ff8c00 100%)";
    notifyBox.style.color = isError ? "white" : "black";
    notifyBox.classList.add('show');

    // Auto-hide only for errors
    if (isError) {
        setTimeout(() => notifyBox.classList.remove('show'), 3000);
    }
}

init();
