// Game Configuration
const CONFIG = {
    MIN_BET: 1,
    MAX_BET: 10000,
    DICE_VALUES: {
        1: [0, 0, 0], // x, y, z rotation
        2: [0, 90, 0],
        3: [90, 0, 0],
        4: [-90, 0, 0],
        5: [0, -90, 0],
        6: [0, 180, 0]
    }
};

// State
let balance = GameBridge.getBalance();
let currentBet = 10;
let selectedChoice = 'small';
let isRolling = false;

// DOM Elements
const balanceDisplay = document.getElementById('balance-amount');
const betInput = document.getElementById('bet-amount');
const btnBetInfo = document.getElementById('btn-bet-info');
const diceCup = document.getElementById('dice-cup');
const resultDisplay = document.getElementById('result-display');
const totalDisplay = document.getElementById('total-display');
const rollBtn = document.getElementById('roll-btn');
const choiceBtns = document.querySelectorAll('.choice-btn');

function init() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login to play!', 'err');
    }
    updateBalanceDisplay();
    updateBetDisplay();
    setupDiceFaces();
    addEventListeners();

    // Set default choice
    document.querySelector('.choice-btn.small').classList.add('active');
}

function setupDiceFaces() {
    // Manually assign face classes to ensure dots are correct
    const dice = document.querySelectorAll('.dice');
    dice.forEach(d => {
        const faces = d.querySelectorAll('.face');
        faces[0].className = 'face front f1';  // 1
        faces[1].className = 'face back f6';   // 6
        faces[2].className = 'face top f3';    // 3
        faces[3].className = 'face bottom f4'; // 4
        faces[4].className = 'face right f2';  // 2
        faces[5].className = 'face left f5';   // 5
    });
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
        if (isRolling) return;
        betInput.value = (parseFloat(betInput.value) + 10).toFixed(2);
        updateBetDisplay();
    });

    document.getElementById('minus-bet').addEventListener('click', () => {
        if (isRolling) return;
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
            if (isRolling) return;
            betInput.value = parseFloat(btn.dataset.val).toFixed(2);
            updateBetDisplay();
        });
    });

    // Choice Selection
    choiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isRolling) return;
            choiceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedChoice = btn.dataset.choice;
        });
    });

    // Main Action
    rollBtn.addEventListener('click', handleRoll);
}

async function handleRoll() {
    if (!GameBridge.isLoggedIn()) {
        notify('Please login first!', 'err');
        return;
    }

    const amount = parseFloat(betInput.value);
    if (amount > balance) {
        notify('Insufficient funds!', 'err');
        return;
    }

    if (isRolling) return;

    // 1. Prepare for Sync
    const newBalance = balance - amount;

    // 2. Sync deduction to database
    const sync = await GameBridge.updateBalance(newBalance, -amount, `Bet on BigSmall`);

    if (sync && sync.error) {
        notify('Sync Error: Bet failed. Try again.', 'err');
        return;
    }

    // 3. Start Animation
    isRolling = true;
    balance = newBalance;
    updateBalanceDisplay();

    rollBtn.disabled = true;
    diceCup.classList.add('shaking');
    resultDisplay.innerText = "ROLLING...";
    totalDisplay.innerText = "";

    // Generate results
    const results = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];
    const total = results.reduce((a, b) => a + b, 0);

    setTimeout(() => {
        diceCup.classList.remove('shaking');

        // Rotate Dice
        results.forEach((val, i) => {
            const d = document.getElementById(`dice-${i + 1}`);
            // Add some extra random spins
            const extraX = Math.floor(Math.random() * 4) * 360;
            const extraY = Math.floor(Math.random() * 4) * 360;

            let rotX = 0, rotY = 0;
            if (val === 1) { rotX = 0; rotY = 0; }
            if (val === 6) { rotX = 180; rotY = 0; }
            if (val === 3) { rotX = -90; rotY = 0; }
            if (val === 4) { rotX = 90; rotY = 0; }
            if (val === 2) { rotX = 0; rotY = -90; }
            if (val === 5) { rotX = 0; rotY = 90; }

            d.style.transform = `rotateX(${rotX + extraX}deg) rotateY(${rotY + extraY}deg)`;
        });

        setTimeout(async () => {
            // Determine result
            let resultType = '';
            // Rules: 4-10 is Small, 11-17 is Big. 3 and 18 are "Triples" (House usually wins both)
            if (total >= 4 && total <= 10) resultType = 'small';
            else if (total >= 11 && total <= 17) resultType = 'big';
            else resultType = 'triple'; // 3 or 18

            const won = resultType === selectedChoice;
            totalDisplay.innerText = `TOTAL: ${total}`;

            if (won) {
                const winAmount = amount * 2;
                balance += winAmount;
                updateBalanceDisplay();

                // Sync win
                await GameBridge.updateBalance(balance, winAmount, `Win on BigSmall`);

                resultDisplay.innerText = `YOU WON! (${resultType.toUpperCase()})`;
                resultDisplay.style.color = 'var(--accent-green)';
                notify(`WON ৳${winAmount.toFixed(2)}`, 'win');
            } else {
                resultDisplay.innerText = resultType === 'triple' ? "TRIPLE! HOUSE WINS" : `YOU LOST! (${resultType.toUpperCase()})`;
                resultDisplay.style.color = 'var(--accent-red)';
                notify(`LOST ৳${amount.toFixed(2)}`, 'err');
            }

            isRolling = false;
            rollBtn.disabled = false;
        }, 1500);

    }, 1000);
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
