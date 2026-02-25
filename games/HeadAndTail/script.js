// Game Configuration
const CONFIG = {
    INITIAL_BALANCE: 5000,
    MIN_BET: 1,
    MAX_BET: 1000
};

// State
let balance = GameBridge.getBalance();
let currentBet = 10;
let selectedSide = 'heads';
let isFlipping = false;

// DOM Elements
const balanceDisplay = document.getElementById('balance-amount');
const betInput = document.getElementById('bet-amount');
const btnBetInfo = document.getElementById('btn-bet-info');
const coin = document.getElementById('coin');
const resultDisplay = document.getElementById('result-display');
const mainBtn = document.getElementById('flip-action-btn');
const sideBtns = document.querySelectorAll('.side-btn');

function init() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login to play!', 'err');
    }
    updateBalanceDisplay();
    updateBetDisplay();
    addEventListeners();
}

function updateBalanceDisplay() {
    balanceDisplay.innerText = `৳${balance.toFixed(2)}`;
}

function updateBetDisplay() {
    const val = parseFloat(betInput.value) || 0;
    btnBetInfo.innerText = `${val.toFixed(2)} ৳`;
}

function addEventListeners() {
    // Bet adjustments
    document.getElementById('plus-bet').addEventListener('click', () => {
        if (isFlipping) return;
        betInput.value = (parseFloat(betInput.value) + 10).toFixed(2);
        updateBetDisplay();
    });

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (isFlipping) return;
        let val = parseFloat(betInput.value);
        if (val > 10) {
            betInput.value = (val - 10).toFixed(2);
            updateBetDisplay();
        }
    });

    betInput.addEventListener('input', updateBetDisplay);

    // Quick bets
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isFlipping) return;
            betInput.value = parseFloat(btn.dataset.val).toFixed(2);
            updateBetDisplay();
        });
    });

    // Side Selection
    sideBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isFlipping) return;
            sideBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSide = btn.dataset.side;
            resultDisplay.innerText = `BETTING ON ${selectedSide.toUpperCase()}`;
        });
    });

    // Main Action
    mainBtn.addEventListener('click', handleFlip);
}

async function handleFlip() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login first!', 'err');
        return;
    }

    const amount = parseFloat(betInput.value);
    if (amount > balance) {
        notify('Insufficient funds!', 'err');
        return;
    }

    if (isFlipping) return;

    // 1. Prepare for Sync
    const newBalance = balance - amount;

    // 2. Sync deduction to database FIRST
    const sync = await GameBridge.updateBalance(newBalance, -amount, `Bet on Head & Tail`);

    if (sync && sync.error) {
        notify('Sync Error: Bet failed. Try again.', 'err');
        return;
    }

    // 3. Start Animation only if sync succeeded
    isFlipping = true;
    balance = newBalance;
    updateBalanceDisplay();

    mainBtn.disabled = true;
    resultDisplay.innerText = "FLIPPING...";
    resultDisplay.classList.remove('win-anim');

    const result = Math.random() < 0.5 ? 'heads' : 'tails';

    coin.className = 'coin'; // Reset
    void coin.offsetWidth;   // Reflow
    coin.classList.add(result === 'heads' ? 'spinning-heads' : 'spinning-tails');

    setTimeout(async () => {
        const win = result === selectedSide;

        if (win) {
            const winAmount = amount * 2;
            const winBalance = balance + winAmount;

            // Sync win to database
            const winSync = await GameBridge.updateBalance(winBalance, winAmount, `Win on Head & Tail`);

            if (winSync && winSync.error) {
                notify('Sync Error: Winnings not saved! Try again.', 'err');
                // Note: In a real app we would retry here
            } else {
                balance = winBalance;
                updateBalanceDisplay();
            }

            resultDisplay.innerText = `YOU WON! (${result.toUpperCase()})`;
            resultDisplay.classList.add('win-anim');
            notify(`WON ৳${winAmount.toFixed(2)}`, 'win');
        } else {
            resultDisplay.innerText = `YOU LOST! (${result.toUpperCase()})`;
            notify(`LOST ৳${amount.toFixed(2)}`, 'err');
        }

        isFlipping = false;
        mainBtn.disabled = false;
    }, 3000);
}

function notify(text, type) {
    const area = document.getElementById('notification-area');
    if (!area) return;
    const note = document.createElement('div');
    note.style.cssText = `
        background: ${type === 'win' ? '#2ecc71' : '#ff2d55'};
        color: white; padding: 12px 25px; border-radius: 12px;
        margin-bottom: 10px; font-weight: 900; box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        transform: translateY(-20px); opacity: 0; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    note.innerText = text;
    area.appendChild(note);

    setTimeout(() => {
        note.style.transform = 'translateY(0)';
        note.style.opacity = '1';
    }, 10);
    setTimeout(() => {
        note.style.transform = 'translateY(-20px)';
        note.style.opacity = '0';
        setTimeout(() => note.remove(), 300);
    }, 4000);
}

init();
