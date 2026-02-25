// Game Configuration
const CONFIG = {
    INITIAL_BALANCE: 5000,
    MIN_BET: 1,
    MAX_BET: 1000,
    TICK_SPEED: 0.1, // Controls the exponential growth rate
};

// State
let balance = GameBridge.getBalance();
let currentBet = 10;
let gameState = 'waiting'; // waiting, flying, crashed
let multiplier = 1.00;
let crashPoint = 1.00;
let startTime = 0;
let animationId = null;

let isBetPlaced = false;
let nextRoundBet = null;
let currentRoundBetValue = 0;
let waitingTime = 5; // Countdown between rounds
let waitingTimerId = null;

// DOM Elements
const balanceDisplay = document.getElementById('balance-amount');
const multiplierDisplay = document.getElementById('multiplier-display');
const mainBtn = document.getElementById('main-action-btn');
const btnBetInfo = document.getElementById('btn-bet-info');
const betInput = document.getElementById('bet-amount');
const planeContainer = document.getElementById('plane-container');
const planeShaker = document.getElementById('plane-shaker');
const planeImg = document.getElementById('plane-img');
const flightZone = document.getElementById('flight-zone');
const cloudsContainer = document.getElementById('clouds-container');
const crashText = document.getElementById('crash-text');
const historyContainer = document.getElementById('history-container');
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let pathPoints = [];
let cameraOffset = { x: 0, y: 0 };
let worldCoords = { x: 0, y: 0 };

// Sound Simulation (Visual Feedback)
function notify(text, type = 'info') {
    const area = document.getElementById('notification-area');
    const note = document.createElement('div');
    note.className = `notification ${type}`;
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

// Initialization
function init() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login to play!', 'err');
    }
    updateBalanceDisplay();
    updateBetDisplay();
    addEventListeners();
    addExampleHistory();
    createClouds();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Start the infinite round cycle
    startWaitingCycle();
}

function startWaitingCycle() {
    gameState = 'waiting';
    waitingTime = 5;
    multiplierDisplay.innerHTML = '<span class="waiting-title">WAITING...</span>';
    multiplierDisplay.style.fontSize = ''; // Let CSS handle it

    updateMainButtonUI();

    waitingTimerId = setInterval(() => {
        waitingTime--;
        if (waitingTime <= 0) {
            clearInterval(waitingTimerId);
            takeoff();
        } else {
            multiplierDisplay.innerHTML = `
                <div class="waiting-title">NEXT ROUND IN</div>
                <div class="waiting-timer">${waitingTime}</div>
            `;
        }
    }, 1000);
}

function resizeCanvas() {
    canvas.width = flightZone.offsetWidth;
    canvas.height = flightZone.offsetHeight;
}

function createClouds() {
    for (let i = 0; i < 15; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        const size = 50 + Math.random() * 150;
        cloud.style.width = `${size}px`;
        cloud.style.height = `${size / 1.5}px`;
        cloud.style.top = `${Math.random() * 100}%`;
        cloud.style.left = `${Math.random() * 100}%`;
        cloud.style.animation = `floatCloud ${10 + Math.random() * 20}s linear infinite`;
        cloud.style.animationDelay = `-${Math.random() * 20}s`;
        cloudsContainer.appendChild(cloud);
    }
}

function updateBalanceDisplay() {
    balanceDisplay.innerText = `৳${balance.toFixed(2)}`;
}

function updateBetDisplay() {
    btnBetInfo.innerText = `${parseFloat(betInput.value).toFixed(2)} ৳`;
}

function addEventListeners() {
    // Bet Adjustments
    document.getElementById('plus-bet').addEventListener('click', () => {
        if (gameState !== 'waiting') return;
        let val = parseFloat(betInput.value);
        betInput.value = (val + 1).toFixed(2);
        updateBetDisplay();
    });

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (gameState !== 'waiting') return;
        let val = parseFloat(betInput.value);
        if (val > CONFIG.MIN_BET) {
            betInput.value = (val - 1).toFixed(2);
            updateBetDisplay();
        }
    });

    betInput.addEventListener('input', updateBetDisplay);

    // Quick Bets
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameState !== 'waiting') return;
            betInput.value = parseFloat(btn.dataset.val).toFixed(2);
            updateBetDisplay();
        });
    });

    // Main Action
    mainBtn.addEventListener('click', handleMainAction);
}

function handleMainAction() {
    if (gameState === 'waiting') {
        if (!isBetPlaced) {
            placeBet();
        } else {
            cancelBet();
        }
    } else if (gameState === 'flying') {
        if (isBetPlaced) {
            cashOut();
        } else {
            // Queue bet for next round
            if (nextRoundBet === null) {
                queueNextRoundBet();
            } else {
                cancelNextRoundBet();
            }
        }
    }
}

async function placeBet() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login first!', 'err');
        return;
    }

    const amount = parseFloat(betInput.value);
    if (amount > balance) {
        notify('Insufficient balance!', 'err');
        return;
    }

    // Calculate new balance first
    const newBalance = balance - amount;

    // Update local state immediately
    balance = newBalance;
    currentRoundBetValue = amount;
    isBetPlaced = true;
    updateBalanceDisplay();
    updateMainButtonUI();

    // Sync to DB (non-blocking — game continues even if sync has a hiccup)
    const sync = await GameBridge.updateBalance(newBalance, -amount, `Bet on Aviator`);
    if (sync && sync.error) {
        console.warn('[AviBD] Sync warning (bet saved locally but DB may be delayed):', sync.error);
        // Don't block the game — the balance is already deducted locally
    }
}

async function cancelBet() {
    balance += currentRoundBetValue;

    // Sync refund
    await GameBridge.updateBalance(balance, currentRoundBetValue, `Cancel bet on Aviator`);

    currentRoundBetValue = 0;
    isBetPlaced = false;
    updateBalanceDisplay();
    updateMainButtonUI();
}

async function queueNextRoundBet() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login first!', 'err');
        return;
    }

    const amount = parseFloat(betInput.value);
    if (amount > balance) {
        notify('Insufficient balance!', 'err');
        return;
    }

    const newBalance = balance - amount;
    const sync = await GameBridge.updateBalance(newBalance, -amount, `Bet queued on Aviator`);
    if (sync && sync.error) {
        notify('Sync Error: Queue failed', 'err');
        return;
    }

    balance = newBalance;
    nextRoundBet = amount;
    updateBalanceDisplay();
    updateMainButtonUI();
    notify('Bet queued for next round');
}

async function cancelNextRoundBet() {
    balance += nextRoundBet;

    // Sync refund
    await GameBridge.updateBalance(balance, nextRoundBet, `Cancel queued bet on Aviator`);

    nextRoundBet = null;
    updateBalanceDisplay();
    updateMainButtonUI();
    notify('Next round bet cancelled');
}

function updateMainButtonUI() {
    if (gameState === 'waiting') {
        mainBtn.disabled = false;
        mainBtn.classList.remove('cashout-mode');
        mainBtn.classList.add('bet-mode');
        mainBtn.style.opacity = '1';
        if (isBetPlaced) {
            mainBtn.innerHTML = `
                <span class="btn-primary-text">CANCEL</span>
                <span class="btn-secondary-text">${currentRoundBetValue.toFixed(2)} ৳</span>
            `;
            mainBtn.style.background = 'var(--accent-red)';
        } else {
            mainBtn.innerHTML = `
                <span class="btn-primary-text">BET</span>
                <span class="btn-secondary-text" id="btn-bet-info">${parseFloat(betInput.value).toFixed(2)} ৳</span>
            `;
            mainBtn.style.background = 'var(--green-cash)';
        }
    } else if (gameState === 'flying') {
        if (isBetPlaced) {
            mainBtn.disabled = false;
            mainBtn.classList.remove('bet-mode');
            mainBtn.classList.add('cashout-mode');
            mainBtn.style.opacity = '1';
            mainBtn.style.background = 'var(--accent-gold)';
            mainBtn.innerHTML = `
                <span class="btn-primary-text">CASH OUT</span>
                <span class="btn-secondary-text" id="cashout-val">0.00 ৳</span>
            `;
        } else {
            // Options for queuing next bet
            mainBtn.classList.remove('cashout-mode');
            mainBtn.classList.add('bet-mode');
            if (nextRoundBet !== null) {
                mainBtn.innerHTML = `
                    <span class="btn-primary-text">CANCEL NEXT</span>
                    <span class="btn-secondary-text">${nextRoundBet.toFixed(2)} ৳</span>
                `;
                mainBtn.style.background = 'var(--accent-red)';
            } else {
                mainBtn.innerHTML = `
                    <span class="btn-primary-text">BET NEXT</span>
                    <span class="btn-secondary-text">${parseFloat(betInput.value).toFixed(2)} ৳</span>
                `;
                mainBtn.style.background = 'rgba(46, 204, 113, 0.5)';
            }
        }
    } else if (gameState === 'cashed_out') {
        mainBtn.disabled = true;
        mainBtn.style.opacity = '0.5';
    }
}

function takeoff() {
    gameState = 'flying';
    multiplierDisplay.style.fontSize = ''; // Let CSS handle it

    // Check if there's a queued bet for this round
    if (nextRoundBet !== null) {
        isBetPlaced = true;
        currentRoundBetValue = nextRoundBet;
        nextRoundBet = null;
    }

    updateMainButtonUI();

    multiplier = 1.00;
    const p = Math.random();
    crashPoint = Math.max(1.00, 0.99 / (1 - p));

    if (crashPoint > 1000) crashPoint = 1000;

    startTime = performance.now();
    planeContainer.style.display = 'block';
    crashText.style.display = 'none';
    pathPoints = [];
    cameraOffset = { x: 0, y: 0 };
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (gameState !== 'flying' && gameState !== 'cashed_out') return;

    const elapsed = (currentTime - startTime) / 1000;
    const baseRate = 0.1;
    const acceleration = 0.015;
    multiplier = 1.00 + (baseRate * elapsed) + (acceleration * Math.pow(elapsed, 2));

    const isAutoOn = document.getElementById('auto-cashout-toggle').checked;
    const autoVal = parseFloat(document.getElementById('auto-cashout-value').value);

    if (gameState === 'flying' && isAutoOn && multiplier >= autoVal) {
        multiplier = autoVal;
        cashOut();
    }

    if (multiplier >= crashPoint) {
        multiplier = crashPoint;
        crash();
        return;
    }

    multiplierDisplay.innerText = `${multiplier.toFixed(2)}x`;
    multiplierDisplay.style.color = 'white';

    const cashoutVal = document.getElementById('cashout-val');
    if (cashoutVal) {
        if (gameState === 'flying') {
            cashoutVal.innerText = `${(currentRoundBetValue * multiplier).toFixed(2)} ৳`;
        } else if (gameState === 'cashed_out' || gameState === 'crashed') {
            if (gameState === 'crashed') cashoutVal.innerText = `0.00 ৳`;
        }
    }

    const startX = canvas.width * 0.1;
    const startY = canvas.height * 0.8;

    worldCoords.x = startX + (elapsed * 80);
    worldCoords.y = startY - (Math.pow(elapsed, 1.5) * 10);

    const limitX = canvas.width * 0.85;
    const limitY = canvas.height * 0.25;

    if (worldCoords.x > limitX) {
        cameraOffset.x = worldCoords.x - limitX;
    }
    if (worldCoords.y < limitY) {
        cameraOffset.y = limitY - worldCoords.y;
    }

    const baseJerk = 1.5;
    const intensityFactor = multiplier * 1.2;
    const jerkX = (Math.random() - 0.5) * (baseJerk + intensityFactor / 20);
    const jerkY = (Math.random() - 0.5) * (baseJerk + intensityFactor / 20);

    const screenX = worldCoords.x - cameraOffset.x;
    const screenY = worldCoords.y + cameraOffset.y;

    planeContainer.style.left = `${screenX}px`;
    planeContainer.style.top = `${screenY}px`;
    planeShaker.style.transform = `translate(${jerkX}px, ${jerkY}px)`;

    const vx = 60;
    const vy = 1.6 * Math.pow(elapsed, 0.6) * 12;
    const angleRad = Math.atan2(vy, vx);
    planeContainer.style.transform = `translate(-50%, -50%) rotate(-35deg)`;

    document.querySelector('.grid-overlay').style.backgroundPosition = `${-cameraOffset.x}px ${cameraOffset.y}px`;

    pathPoints.push({ x: worldCoords.x, y: worldCoords.y });
    drawCurve();

    if (multiplier > 10) {
        multiplierDisplay.classList.add('shaking');
    }

    if (gameState === 'flying' || gameState === 'cashed_out') {
        animationId = requestAnimationFrame(gameLoop);
    }
}

function drawCurve() {
    if (pathPoints.length < 2) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x - cameraOffset.x, canvas.height + 200);
    for (const p of pathPoints) {
        ctx.lineTo(p.x - cameraOffset.x, p.y + cameraOffset.y);
    }
    const lastP = pathPoints[pathPoints.length - 1];
    ctx.lineTo(lastP.x - cameraOffset.x, canvas.height + 200);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 45, 85, 0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff2d55';
    ctx.moveTo(pathPoints[0].x - cameraOffset.x, pathPoints[0].y + cameraOffset.y);
    for (let i = 1; i < pathPoints.length; i++) {
        ctx.lineTo(pathPoints[i].x - cameraOffset.x, pathPoints[i].y + cameraOffset.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

async function cashOut() {
    if (gameState !== 'flying' || !isBetPlaced) return;

    const winAmount = currentRoundBetValue * multiplier;
    const newBalance = balance + winAmount;

    // Sync win to DB first
    const sync = await GameBridge.updateBalance(newBalance, winAmount, `Win on Aviator`);
    if (sync && sync.error) {
        notify('Sync Error: Cashout failed!', 'err');
        return;
    }

    balance = newBalance;
    updateBalanceDisplay();

    notify(`Cashed out at ${multiplier.toFixed(2)}x! Won ৳${winAmount.toFixed(2)}`, 'win');

    isBetPlaced = false;
    currentRoundBetValue = 0;
    gameState = 'cashed_out';
    updateMainButtonUI();
}

function crash() {
    if (gameState === 'flying' && isBetPlaced) {
        isBetPlaced = false;
        currentRoundBetValue = 0;
        updateMainButtonUI();
    }

    gameState = 'crashed';
    cancelAnimationFrame(animationId);

    multiplierDisplay.innerText = `${multiplier.toFixed(2)}x`;
    multiplierDisplay.style.color = 'var(--accent-red)';
    crashText.style.display = 'block';
    planeContainer.style.display = 'none';
    multiplierDisplay.classList.remove('shaking');

    addToHistory(multiplier);

    setTimeout(() => {
        resetGame();
        startWaitingCycle();
    }, 3000);
}

function resetGame() {
    multiplier = 1.00;
    multiplierDisplay.innerText = '1.00x';
    multiplierDisplay.style.color = 'white';
    crashText.style.display = 'none';
    planeContainer.style.left = '10%';
    planeContainer.style.top = '80%';
    updateMainButtonUI();
}

function addToHistory(val) {
    const item = document.createElement('div');
    item.className = 'hist-item';
    if (val < 2) item.classList.add('low');
    else if (val < 10) item.classList.add('mid');
    else item.classList.add('high');
    item.innerText = `${val.toFixed(2)}x`;
    historyContainer.prepend(item);
    if (historyContainer.children.length > 15) {
        historyContainer.lastElementChild.remove();
    }
}

function addExampleHistory() {
    const examples = [1.54, 3.21, 1.02, 12.50, 2.11, 1.88];
    examples.forEach(v => addToHistory(v));
}

const style = document.createElement('style');
style.textContent = `
    #notification-area { position: fixed; top: 100px; right: 20px; z-index: 1000; pointer-events: none; }
`;
document.head.appendChild(style);

init();
