# GAME INTEGRATION SNIPPETS

### 1. index.html (Pure Structure)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Title</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Outfit:wght@700;900&display=swap" rel="stylesheet">
</head>
<body>
    <div class="app-container">
        <!-- Header -->
        <header class="game-header">
            <div class="logo">
                <div onclick="GameBridge.goHome()" style="cursor: pointer; background: rgba(255,255,255,0.1); padding: 6px 10px; border-radius: 8px; margin-right: 12px; display: inline-flex; align-items: center; gap: 6px; font-size:0.8rem;">
                    <i class="fas fa-home"></i> <span>HOME</span>
                </div>
                <span class="logo-text">GAME NAME</span>
            </div>
            <div class="balance-container">
                <span class="balance-label">BALANCE</span>
                <span id="balance-amount" class="balance-value">৳0.00</span>
            </div>
        </header>

        <!-- Main Area -->
        <main class="game-main">
            <div id="game-area">
                <!-- Place game visuals here -->
            </div>
        </main>

        <!-- Controls -->
        <div class="controls-container">
            <input type="number" id="bet-amount" value="10">
            <button id="play-btn">START</button>
        </div>
    </div>

    <!-- Core Scripts -->
    <script src="../balancer.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

### 2. style.css (Responsive Template)
```css
:root {
    --bg-dark: #0a0b10;
    --card-bg: #141621;
    --accent: #ffcc00;
    --text: #ffffff;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body { 
    background: var(--bg-dark); 
    color: var(--text); 
    display: flex; 
    justify-content: center; 
    align-items: center; 
    height: 100vh;
    overflow: hidden;
}

.app-container {
    width: 100%; max-width: 1000px; height: 90vh;
    background: var(--card-bg); border-radius: 20px;
    display: flex; flex-direction: column; overflow: hidden;
}

.game-header { 
    padding: 15px 25px; display: flex; 
    justify-content: space-between; align-items: center; 
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.game-main { flex: 1; padding: 20px; position: relative; }

.controls-container { 
    padding: 20px; background: rgba(0,0,0,0.2); 
    display: flex; gap: 15px; justify-content: center;
}

/* MOBILE RESPONSIVE */
@media (max-width: 600px) {
    body { overflow: auto; height: auto; align-items: flex-start; }
    .app-container { height: 100dvh; border-radius: 0; }
    .game-main { padding: 10px; flex: 1; }
    .controls-container { padding: 10px; flex-direction: column; }
}
```

### 3. script.js (Sync Logic)
```javascript
// Initialization
let balance = GameBridge.getBalance();
const balanceDisplay = document.getElementById('balance-amount');
const betInput = document.getElementById('bet-amount');

function updateUI() {
    balanceDisplay.innerText = `৳${balance.toFixed(2)}`;
}

// 1. PLACE BET (Loss/Deduction)
async function handleBet() {
    const amount = parseFloat(betInput.value);
    if (amount > balance) return alert("Low balance");

    // Local update
    const newTotal = balance - amount;
    balance = newTotal;
    updateUI();

    // DB SYNC
    await GameBridge.updateBalance(newTotal, -amount, "Game Bet");
}

// 2. HANDLE WIN (Profit)
async function handleWin(winAmount) {
    // Local update
    const newTotal = balance + winAmount;
    balance = newTotal;
    updateUI();

    // DB SYNC
    await GameBridge.updateBalance(newTotal, winAmount, "Game Win");
}

// 3. GO HOME
// Trigger GameBridge.goHome() via HTML button

updateUI();
```

### 4. Admin Panel
- **Link:** `games/FOLDER_NAME/index.html`
- **Active:** `True`
