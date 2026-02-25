// Game Configuration
const CONFIG = {
    INITIAL_BALANCE: 5000,
    GRID_SIZE: 25,
    CHICKEN_IMG: 'https://cdn-icons-png.flaticon.com/256/2632/2632733.png',
    BONE_IMG: 'https://cdn-icons-png.flaticon.com/256/1020/1020216.png'
};

const CUSTOM_MULT = {
    1: [1.01, 1.05, 1.10, 1.15, 1.21, 1.28, 1.35, 1.43, 1.52],
    3: [1.10, 1.26, 1.45, 1.68, 1.96, 2.30, 2.73, 3.28, 3.98, 4.70, 5.88, 7.48, 9.72],
    5: [1.21, 1.53, 1.96, 2.53, 3.32, 4.25, 5.77, 7.98, 11.31, 16.45, 24.68, 38.39, 62.39, 106.95],
    10: [1.62, 2.77, 4.70, 8.62, 16.45, 32.91, 69.47, 156.31, 379.61, 1012.3],
    20: [4.65, 27.90, 213.90, 2352.90, 49410.9]
};

// State
let balance = GameBridge.getBalance();
let currentBet = 10;
let mineCount = 3;
let mines = [];
let revealedTiles = [];
let gameState = 'idle'; // idle, playing, lost, won
let multipliers = [];

// DOM Elements
const balanceDisplay = document.getElementById('balance-amount');
const betInput = document.getElementById('bet-amount');
const mineSelect = document.getElementById('mine-count');
const gridContainer = document.getElementById('grid-container');
const multiplierTrack = document.getElementById('multiplier-track');
const statusDisplay = document.getElementById('game-status');
const playBtn = document.getElementById('play-btn');
const cashoutBtn = document.getElementById('cashout-btn');
const cashoutVal = document.getElementById('cashout-val');

function init() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login to play!', 'err');
    }
    updateBalanceDisplay();
    createGrid();
    updateMultipliers();
    addEventListeners();
}

function updateBalanceDisplay() {
    balanceDisplay.innerText = `৳${balance.toFixed(2)}`;
}

function createGrid() {
    gridContainer.innerHTML = '';
    for (let i = 0; i < CONFIG.GRID_SIZE; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.index = i;

        const img = document.createElement('img');
        tile.appendChild(img);

        tile.addEventListener('click', () => handleTileClick(i));
        gridContainer.appendChild(tile);
    }
}

function updateMultipliers() {
    multiplierTrack.innerHTML = '';
    const mines = parseInt(mineSelect.value);
    multipliers = [];

    const customList = CUSTOM_MULT[mines] || [];
    const maxSteps = Math.min(CONFIG.GRID_SIZE - mines, 20);

    let currentMult = 1;
    // Standard formula fallback if custom list runs out
    const houseEdge = 0.97;

    for (let i = 1; i <= maxSteps; i++) {
        const stepIdx = i - 1;

        if (customList[stepIdx]) {
            currentMult = customList[stepIdx];
        } else {
            const prob = (CONFIG.GRID_SIZE - mines - (i - 1)) / (CONFIG.GRID_SIZE - (i - 1));
            currentMult *= (houseEdge / prob);
        }

        multipliers.push(currentMult);

        const step = document.createElement('div');
        step.className = 'step-card';
        step.innerHTML = `
            <div style="font-size: 0.6rem; opacity: 0.6;">STEP ${i}</div>
            <div style="font-weight: 950; color: ${mines >= 5 ? 'var(--accent-yellow)' : 'inherit'}">${currentMult.toFixed(2)}x</div>
        `;
        multiplierTrack.appendChild(step);
    }
}

function addEventListeners() {
    mineSelect.addEventListener('change', () => {
        if (gameState === 'idle') updateMultipliers();
    });

    document.getElementById('plus-bet').addEventListener('click', () => {
        if (gameState !== 'idle') return;
        betInput.value = (parseFloat(betInput.value) + 10).toFixed(2);
    });

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (gameState !== 'idle') return;
        let val = parseFloat(betInput.value);
        if (val > 10) betInput.value = (val - 10).toFixed(2);
    });

    playBtn.addEventListener('click', startGame);
    cashoutBtn.addEventListener('click', cashOut);
}

async function startGame() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login first!', 'err');
        return;
    }

    const amount = parseFloat(betInput.value);
    if (amount > balance) {
        notify('Insufficient balance!', 'err');
        return;
    }

    // Reset State
    gameState = 'playing';
    currentBet = amount;
    balance -= currentBet;
    updateBalanceDisplay();

    // Sync deduction to database
    const sync = await GameBridge.updateBalance(balance, -amount, `Bet on Mines`);

    if (sync && sync.error) {
        // Rollback local balance if database update failed
        balance += currentBet;
        updateBalanceDisplay();
        gameState = 'idle';
        playBtn.disabled = false;
        playBtn.innerText = 'START GAME';
        mineSelect.disabled = false;
        notify('Sync Error: Bet not placed. Please try again.', 'err');
        return;
    }

    mineCount = parseInt(mineSelect.value);
    revealedTiles = [];
    mines = [];

    // Place Mines
    while (mines.length < mineCount) {
        let r = Math.floor(Math.random() * CONFIG.GRID_SIZE);
        if (mines.indexOf(r) === -1) mines.push(r);
    }

    // UI Reset
    statusDisplay.innerText = 'AVOID THE MINES!';
    statusDisplay.style.color = 'var(--accent-yellow)';

    playBtn.disabled = true;
    playBtn.innerText = 'GAME IN PROGRESS';
    mineSelect.disabled = true;

    cashoutBtn.disabled = true;
    cashoutBtn.classList.add('disabled');
    cashoutVal.innerText = '0.00';

    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(t => {
        t.className = 'tile';
        t.querySelector('img').src = '';
    });

    const stepCards = document.querySelectorAll('.step-card');
    stepCards.forEach(s => s.classList.remove('active'));
}

async function handleTileClick(index) {
    if (gameState !== 'playing' || revealedTiles.includes(index)) return;

    const tiles = document.querySelectorAll('.tile');
    const tile = tiles[index];
    const img = tile.querySelector('img');

    revealedTiles.push(index);

    if (mines.includes(index)) {
        // HIT MINE
        gameState = 'lost';
        tile.classList.add('revealed-mine', 'revealed');
        img.src = CONFIG.BONE_IMG;

        revealAllMines();
        gameOver('GAME OVER! YOU HIT A MINE', 'err');
    } else {
        // HIT SAFE
        tile.classList.add('revealed-safe', 'revealed');
        img.src = CONFIG.CHICKEN_IMG;

        const stepIdx = Math.min(revealedTiles.length - 1, 19); // Adjusted max index
        const currentMult = multipliers[stepIdx];

        // Update Multiplier UX
        const stepCards = document.querySelectorAll('.step-card');
        stepCards.forEach(s => s.classList.remove('active'));
        if (stepCards[stepIdx]) {
            stepCards[stepIdx].classList.add('active');
            stepCards[stepIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        // Enable Cashout
        cashoutBtn.disabled = false;
        cashoutBtn.classList.remove('disabled');
        cashoutVal.innerText = (currentBet * currentMult).toFixed(2);

        if (revealedTiles.length === (CONFIG.GRID_SIZE - mineCount)) {
            await cashOut(); // Auto cashout on perfect game
        }
    }
}

function revealAllMines() {
    const tiles = document.querySelectorAll('.tile');
    mines.forEach(idx => {
        const t = tiles[idx];
        t.classList.add('revealed-mine', 'revealed');
        t.querySelector('img').src = CONFIG.BONE_IMG;
    });
}

async function cashOut() {
    if (gameState !== 'playing') return;

    const stepIdx = revealedTiles.length - 1;
    const winAmount = currentBet * multipliers[stepIdx];

    balance += winAmount;
    updateBalanceDisplay();

    // Sync win
    await GameBridge.updateBalance(balance, winAmount, `Win on Mines`);

    gameState = 'won';
    gameOver(`YOU WON ৳${winAmount.toFixed(2)}`, 'win');
}

function gameOver(msg, type) {
    statusDisplay.innerText = msg;
    statusDisplay.style.color = type === 'win' ? 'var(--accent-green)' : 'var(--accent-red)';

    playBtn.disabled = false;
    playBtn.innerText = 'START NEW GAME';
    mineSelect.disabled = false;

    cashoutBtn.disabled = true;
    cashoutBtn.classList.add('disabled');

    notify(msg, type);

    // Disable grid
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(t => t.classList.add('disabled'));
}

function notify(text, type) {
    const area = document.getElementById('notification-area');
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
