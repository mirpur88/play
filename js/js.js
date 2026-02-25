let games = []; // Will be loaded from Supabase
let siteSettings = {};

// Initialize content on load
document.addEventListener('DOMContentLoaded', () => {
    loadSiteContent();
    registerServiceWorker();
    initPwaInstall();
});

async function loadSiteContent() {
    try {
        console.log("Loading site content...");

        // 0. Init Registration Timer
        if (typeof initRegistrationTimer === 'function') {
            console.log("Starting timer check...");
            initRegistrationTimer();
        }

        // 1. Load Settings
        const { data: settings, error: settingsError } = await supabase.from('site_settings').select('*').single();
        if (settings) {
            siteSettings = settings;
            updateSiteSettings(settings);
        }

        // 2. Load Games
        const { data: fetchedGames, error: gamesError } = await supabase
            .from('games')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (fetchedGames) {
            games = fetchedGames;
            renderGames();
        } else {
            games = [];
            renderGames();
        }

        // 3. Load Carousel
        console.log("Loading carousel...");
        loadCarousel();

    } catch (e) {
        console.error("Error loading content:", e);
    }
}

function updateSiteSettings(settings) {
    // Update Logo
    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        if (settings.site_logo_url) {
            logoEl.innerHTML = `<img src="${settings.site_logo_url}" alt="${settings.site_logo_text || 'Logo'}" style="height: 40px;">`;
        } else if (settings.site_logo_text) {
            logoEl.textContent = settings.site_logo_text;
        }
    }

    // Update Browser Tab Title
    if (settings.site_logo_text) {
        document.title = settings.site_logo_text;
    }

    // Update Welcome/Referral Bonus Texts elsewhere if needed

    // Update Social and Support links
    const updateLink = (id, url) => {
        const el = document.getElementById(id);
        if (el) {
            if (url && url.trim() !== '') {
                el.href = url;
                el.style.display = 'flex';
                el.target = '_blank';
            } else {
                el.style.display = 'none';
            }
        }
    };

    updateLink('linkTelegram', settings.telegram_link);
    updateLink('linkFacebook', settings.facebook_link);
    updateLink('linkWhatsapp', settings.whatsapp_link);
    updateLink('linkCustomChat', settings.livechat_link);

    const footerEmail = document.getElementById('footerEmail');
    if (footerEmail && settings.support_email) {
        footerEmail.textContent = `WhatsApp: ${settings.support_email}`;
        footerEmail.style.cursor = 'pointer';
        footerEmail.onclick = () => {
            const num = settings.support_email.replace(/\D/g, '');
            window.open(`https://wa.me/${num}`, '_blank');
        };
    }
}

async function loadCarousel() {
    try {
        const { data: items } = await supabase.from('carousel_items').select('*').order('created_at', { ascending: false });
        if (items && items.length > 0) {
            const carouselContainer = document.querySelector('.carousel');
            if (!carouselContainer) return;

            // Clear existing slides and dots
            carouselContainer.innerHTML = `
                <div class="carousel-dots"></div>
            `;

            items.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
                slide.style.backgroundImage = `url('${item.image_url}')`;
                if (item.link_url) {
                    slide.style.cursor = 'pointer';
                    slide.onclick = () => window.open(item.link_url, '_blank');
                }
                carouselContainer.insertBefore(slide, carouselContainer.querySelector('.carousel-dots'));

                // Add dot
                const dot = document.createElement('div');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                document.querySelector('.carousel-dots').appendChild(dot);
            });

            // Re-initialize carousel script if needed (handled by existing JS likely, but we need to check)
            // Since we replaced the DOM, we might need to restart the interval logic.
            startCarouselInterval();
        }
    } catch (e) {
        console.error("Carousel load error:", e);
    }
}

let carouselInterval;
function startCarouselInterval() {
    if (carouselInterval) clearInterval(carouselInterval);

    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;

    if (slides.length === 0) return;

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    carouselInterval = setInterval(nextSlide, 5000);

    // Dot click handlers
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            showSlide(currentSlide);
            clearInterval(carouselInterval);
            carouselInterval = setInterval(nextSlide, 5000);
        });
    });
}


document.getElementById("depositMethod")?.addEventListener("change", function () {
    const paymentNumberInput = document.getElementById("depositMerchantNumber");
    const selectedMethod = this.value;

    if (!paymentNumberInput) return;

    // Use fetched settings or fallbacks
    const paymentNumbers = {
        bkash: siteSettings.bkash_number || "Not available",
        nagad: siteSettings.nagad_number || "Not available",
        rocket: siteSettings.rocket_number || "Not available",
        usdt: siteSettings.usdt_address || "Not available",
        crypto: siteSettings.usdt_address || "Not available"
    };

    if (selectedMethod === "") {
        paymentNumberInput.value = "";
        paymentNumberInput.placeholder = "Select a payment method above";
    } else {
        paymentNumberInput.value = paymentNumbers[selectedMethod] || "Not available";
    }
});





// the link you want to open
const targetLink = "https://www.facebook.com/profile.php?id=61583357891198";

// select all elements with class 'contact-info'
document.querySelectorAll(".live-chat").forEach(el => {
    el.addEventListener("click", () => {
        window.open(targetLink, "_blank"); // opens in new tab
    });
});






// Game data with categories, links, and names
// Games are now loaded dynamically from Supabase





// DOM elements
const gamesContainer = document.getElementById('gamesContainer');
const menuItems = document.querySelectorAll('.menu-item');
const pageContents = document.querySelectorAll('.page-content');
const navItems = document.querySelectorAll('.nav-item');

// Function to render games based on category
function renderGames(category = 'all') {
    gamesContainer.innerHTML = '';

    const filteredGames = category === 'all'
        ? games
        : games.filter(game => game.category === category);

    if (filteredGames.length === 0) {
        gamesContainer.innerHTML = '<div class="no-games">No games found in this category</div>';
        return;
    }

    filteredGames.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <div class="game-image-container">
                <img src="${game.image_url}" alt="${game.name}" class="game-image">
                <div class="game-overlay">
                    <button class="play-btn" onclick="openGame('${game.play_url}', '${game.vip_level_required || 'Bronze'}', '${game.name}')">PLAY</button>
                </div>
            </div>
            <div class="game-name">${game.name}</div>
        `;
        gamesContainer.appendChild(gameCard);
    });
}

function openGame(url, vipRequired, name) {
    console.log('Opening game:', name, 'URL:', url);

    if (!simpleAuth.isLoggedIn()) {
        createAuthModal();
        document.getElementById('authModal').style.display = 'block';
        return;
    }

    // If no URL is set for this game, show the VIP/promotional popup from admin settings
    if (!url || url.trim() === '' || url === 'null' || url === 'undefined') {
        checkVipAndPlay(vipRequired || 'Bronze', name);
        return;
    }

    const modal = document.getElementById('gamePlayModal');
    const iframe = document.getElementById('gameIframe');

    if (modal && iframe) {
        // Force the URL to be relative if it's pointing to localhost/127.0.0.1
        // to avoid cross-origin issues during local testing
        let finalUrl = url;
        if (url.includes('127.0.0.1') || url.includes('localhost')) {
            try {
                const urlObj = new URL(url);
                finalUrl = urlObj.pathname.substring(1); // Remove leading slash
            } catch (e) { console.error("URL Parse error", e); }
        }

        // --- SINGLE GAME LOCK ---
        // Generate a unique ID for this specific game instance
        const instanceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        simpleAuth.currentGameInstanceId = instanceId;

        // Update DB to notify other tabs/devices to close their games
        supabase.from('profiles')
            .update({ active_game_id: instanceId })
            .eq('id', simpleAuth.currentUser.id)
            .then(({ error }) => {
                if (error) console.error('Failed to set active_game_id:', error);
            });
        // -------------------------

        iframe.src = finalUrl;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Ensure modal is on top
        modal.style.zIndex = '999999';
    } else {
        console.error("Game Modal elements not found! Check that gamePlayModal and gameIframe exist in index.html");
    }
}

function closeGameModal() {
    console.log('Closing game modal and refreshing balance...');
    const modal = document.getElementById('gamePlayModal');
    const iframe = document.getElementById('gameIframe');

    // Clear active game ID in DB when closed manually
    if (typeof simpleAuth !== 'undefined' && simpleAuth.currentUser) {
        supabase.from('profiles')
            .update({ active_game_id: null })
            .eq('id', simpleAuth.currentUser.id)
            .then(() => {
                simpleAuth.currentGameInstanceId = null;
            });
    }

    if (modal && iframe) {
        iframe.src = '';
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // Refresh balance and profile when closing game to ensure main UI is synced
        if (typeof simpleAuth !== 'undefined' && simpleAuth.refreshUser) {
            simpleAuth.refreshUser();
        }
    }
}

// Function to show specific page - UPDATED
function showPage(pageId) {
    console.log('Showing page:', pageId);

    // Check if user is logged in for protected pages
    const protectedPages = ['referralPage', 'depositPage', 'rewardsPage', 'accountPage'];

    if (protectedPages.includes(pageId) && !simpleAuth.isLoggedIn()) {
        // Show login modal instead of protected page
        createAuthModal();
        document.getElementById('authModal').style.display = 'block';
        return;
    }

    // Hide all pages
    pageContents.forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Update active nav item
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        }
    });

    // Update page content if user is logged in
    if (simpleAuth.isLoggedIn() && simpleAuth.currentUser) {
        switch (pageId) {
            case 'accountPage':
                simpleAuth.updateAccountInfo();
                break;
            case 'referralPage':
                simpleAuth.updateReferralPage();
                break;
            case 'rewardsPage':
                simpleAuth.updateRewardsPage();
                break;
            case 'depositPage':
                simpleAuth.updateDepositPage();
                break;
        }
    }
}


// Initialize with all games
renderGames();

// Category filtering
menuItems.forEach(item => {
    item.addEventListener('click', function () {
        // Update active menu item
        menuItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');

        // Filter games
        const category = this.getAttribute('data-category');
        renderGames(category);
    });
});

// Page navigation - UPDATED
navItems.forEach(item => {
    item.addEventListener('click', function () {
        const pageId = this.getAttribute('data-page');
        showPage(pageId);
    });
});

// Carousel functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const dots = document.querySelectorAll('.dot');

function showSlide(n) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    currentSlide = (n + slides.length) % slides.length;

    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

// Auto slide change
setInterval(() => {
    showSlide(currentSlide + 1);
}, 5000);

// Add click events to dots
dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        showSlide(index);
    });
});

// Login button functionality - UPDATED
document.getElementById('headerLoginBtn').addEventListener('click', function () {
    if (simpleAuth.isLoggedIn()) {
        // User is logged in, show logout confirmation
        if (confirm('Are you sure you want to logout?')) {
            simpleAuth.logout();
        }
    } else {
        // User is not logged in, show auth modal
        createAuthModal();
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
});

// Deposit form submission
document.getElementById('depositBtn')?.addEventListener('click', async function () {
    if (!simpleAuth.isLoggedIn()) {
        alert('Please login first');
        return;
    }

    const method = document.getElementById('depositMethod').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const trxId = document.getElementById('depositTrxId').value;
    const receiptFile = document.getElementById('depositReceipt').files[0];

    if (!method || !amount || amount < 500 || !trxId) {
        alert('Minimum deposit ৳500, and check Transaction ID');
        return;
    }

    if (!receiptFile) {
        alert('Please upload a deposit receipt screenshot');
        return;
    }

    try {
        const btn = document.getElementById('depositBtn');
        const originalText = btn.textContent;
        btn.textContent = 'UPLOADING RECEIPT...';
        btn.disabled = true;

        let receiptUrl = '';
        try {
            const fileName = `${Date.now()}_${simpleAuth.currentUser.username}_receipt.${receiptFile.name.split('.').pop()}`;
            const { data, error: uploadError } = await supabase.storage
                .from('site-assets')
                .upload(`receipts/${fileName}`, receiptFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('site-assets')
                .getPublicUrl(`receipts/${fileName}`);

            receiptUrl = publicUrl;
        } catch (uploadErr) {
            console.error('File upload error:', uploadErr);
            throw new Error('Failed to upload receipt image. Please try again.');
        }

        btn.textContent = 'SUBMITTING...';
        const { error } = await supabase.from('transactions').insert([{
            user_id: simpleAuth.currentUser.id,
            type: 'deposit',
            amount: amount,
            description: `Deposit via ${method}. TrxID: ${trxId || 'N/A'}`,
            receipt_url: receiptUrl,
            status: 'pending',
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

        alert('আপনার অনুরোধ সফল হয়েছে , দয়া করে আমাদের সময় দিন আপনার ডিপোজিট প্রসেস করতে।');

        // Reset form
        document.getElementById('depositAmount').value = '';
        document.getElementById('depositTrxId').value = '';
        document.getElementById('depositReceipt').value = '';

        btn.textContent = originalText;
        btn.disabled = false;
    } catch (e) {
        alert('Submission failed: ' + e.message);
        const btn = document.getElementById('depositBtn');
        btn.textContent = 'DEPOSIT NOW';
        btn.disabled = false;
    }
});

// Withdraw form submission
document.getElementById('withdrawBtn')?.addEventListener('click', async function () {
    if (!simpleAuth.isLoggedIn()) {
        alert('Please login first');
        return;
    }

    const method = document.getElementById('withdrawMethod').value;
    const number = document.getElementById('withdrawNumber').value;
    const amount = parseFloat(document.getElementById('withdrawAmount').value);

    if (!method || !number || !amount || amount < 1000) {
        alert('Minimum withdraw ৳1000');
        return;
    }

    if (simpleAuth.currentUser.balance < amount) {
        alert('Insufficient balance!');
        return;
    }

    if (!confirm(`Are you sure you want to withdraw ৳${amount} to ${number} (${method})?`)) return;

    try {
        const btn = document.getElementById('withdrawBtn');
        const originalText = btn.textContent;
        btn.textContent = 'PROCESSING...';
        btn.disabled = true;

        // Direct deduct from balance
        const { error: balanceError } = await simpleAuth.addToBalance(-amount);
        if (balanceError) throw balanceError;

        // Create pending transaction
        const { error: txError } = await supabase.from('transactions').insert([{
            user_id: simpleAuth.currentUser.id,
            type: 'withdraw',
            amount: amount,
            description: `Withdrawal to ${number} (${method})`,
            status: 'pending',
            created_at: new Date().toISOString()
        }]);

        if (txError) throw txError;

        alert('Withdrawal request submitted! Amount deducted from balance.');

        // Reset form
        document.getElementById('withdrawNumber').value = '';
        document.getElementById('withdrawAmount').value = '';

        btn.textContent = originalText;
        btn.disabled = false;

        // Update account info display
        if (typeof simpleAuth !== 'undefined') simpleAuth.updateAccountInfo();

    } catch (e) {
        alert('Withdrawal failed: ' + e.message);
        const btn = document.getElementById('withdrawBtn');
        btn.textContent = 'Withdraw NOW';
        btn.disabled = false;
    }
});

// Global Claim Bonus Function
// Global Claim Bonus Function
async function claimBonus(bonusType, campaignId, isSilent = false) {
    if (!simpleAuth.isLoggedIn()) {
        if (!isSilent) alert('Please login first to claim your bonus!');
        return;
    }

    try {
        // ... (referral bonus logic) ...
        if (bonusType === 'referral_bonus') {
            const { data: settings } = await supabase.from('site_settings').select('referral_bonus').single();
            const refBonusAmt = settings?.referral_bonus || 0;

            // Re-fetch user detail for accurate count
            const { data: user } = await supabase.from('profiles').select('friends_referred, total_earnings').eq('id', simpleAuth.currentUser.id).single();
            const { data: allTransactions } = await supabase.from('transactions').select('description').eq('user_id', simpleAuth.currentUser.id).eq('type', 'bonus');

            const referredFriends = user?.friends_referred || 0;
            // Count successful referral bonus claims with stricter matching (same as rewards page)
            const claimedRefs = (allTransactions || []).filter(c => {
                const desc = (c.description || '');
                return desc === 'Referral Bonus Claim' ||
                    desc === 'Referral Bonus: Claimed success referral' ||
                    desc.toLowerCase() === 'referral bonus claim';
            }).length;

            const unclaimedRefs = referredFriends - claimedRefs;

            if (unclaimedRefs <= 0) {
                if (!isSilent) alert('No pending referral bonuses to claim!');
                return;
            }

            const totalClaimAmount = refBonusAmt * unclaimedRefs;

            // Process claim (Add to balance)
            const { error: balanceErr } = await simpleAuth.addToBalance(totalClaimAmount);
            if (balanceErr) throw balanceErr;

            // Update total_earnings in profile if schema allow (usually it should, if not it just ignores)
            const newTotalEarnings = (user.total_earnings || 0) + totalClaimAmount;
            await supabase.from('profiles').update({ total_earnings: newTotalEarnings }).eq('id', simpleAuth.currentUser.id);

            // Insert transitions (one per referral for clean history and correct unclaimed calculation)
            const transactions = [];
            for (let i = 0; i < unclaimedRefs; i++) {
                transactions.push({
                    user_id: simpleAuth.currentUser.id,
                    type: 'bonus',
                    amount: refBonusAmt,
                    description: 'Referral Bonus Claim',
                    status: 'completed',
                    created_at: new Date().toISOString()
                });
            }
            await supabase.from('transactions').insert(transactions);

            if (!isSilent) alert(`Congratulations! You have successfully claimed ${unclaimedRefs} referral bonus(es) total of ৳${totalClaimAmount}!`);

            // Refresh UI
            await simpleAuth.updateRewardsPage();
            simpleAuth.updateAccountInfo();
            return;
        }

        // 1. Fetch Campaign Details (for dynamic campaigns)
        const { data: camp, error: campErr } = await supabase
            .from('available_bonuses')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campErr || !camp) throw new Error('Bonus campaign not found or inactive.');

        // 2. Double-check eligibility (Manual or Auto-Unlock)
        // For Re-claims: Find the OLDEST unused eligibility record for this user/type/amount
        const [eligRes, claimsRes] = await Promise.all([
            supabase.from('user_bonus_eligibility')
                .select('*')
                .eq('user_id', simpleAuth.currentUser.id)
                .eq('bonus_type', bonusType)
                .eq('amount', camp.amount)
                .eq('is_available', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle(),
            supabase.from('transactions')
                .select('description')
                .eq('user_id', simpleAuth.currentUser.id)
                .eq('type', 'bonus')
        ]);

        const eligibility = eligRes.data;
        const allBonusClaims = claimsRes.data || [];
        const maxClaims = camp.max_claims_per_user || 1;

        // Strict count matching the rewards page logic
        const claimCount = allBonusClaims.filter(c => {
            if (!c.description) return false;
            const desc = c.description;
            return desc === `Claimed Bonus: ${camp.bonus_name}` ||
                desc === `${camp.bonus_name} Bonus Claimed` ||
                desc === camp.bonus_name;
        }).length;

        // Logic: 
        // 1. If it's manual (eligibility exists), allow claim.
        // 2. If it's auto-unlock AND claimCount < maxClaims, allow claim.
        // 3. Otherwise, reject.

        const canClaimManual = !!eligibility;
        const canClaimAuto = camp.auto_unlock && claimCount < maxClaims;

        if (!canClaimManual && !canClaimAuto) {
            const msg = camp.auto_unlock ? 'Maximum claims reached.' : 'You have already claimed your available grant. Ask an admin for a re-grant!';
            if (!isSilent) alert(msg);
            return;
        }

        // 3. Process Claim
        console.log(`Processing claim for ${camp.bonus_name}...`);

        // Add to balance
        const { error: balanceErr } = await simpleAuth.addToBalance(camp.amount);
        if (balanceErr) throw balanceErr;

        // Create transaction
        await supabase.from('transactions').insert([{
            user_id: simpleAuth.currentUser.id,
            type: 'bonus',
            amount: camp.amount,
            description: `Claimed Bonus: ${camp.bonus_name}`,
            status: 'completed',
            created_at: new Date().toISOString()
        }]);

        // Consume THIS SPECIFIC eligibility record
        if (eligibility) {
            await supabase.from('user_bonus_eligibility')
                .update({
                    is_available: false,
                    claims_used: 1
                })
                .eq('id', eligibility.id);
        }

        if (!isSilent) alert(`Congratulations! You have successfully claimed ৳${camp.amount} ${camp.bonus_name}!`);

        // 4. Refresh UI (Avoid recursion in silent mode)
        if (!isSilent) {
            simpleAuth.updateRewardsPage();
        }
        simpleAuth.updateAccountInfo();

    } catch (err) {
        console.error('Error claiming bonus:', err);
        if (!isSilent) alert('Failed to claim bonus: ' + err.message);
    }
}

// Account action buttons
document.querySelectorAll('.action-btn').forEach(button => {
    button.addEventListener('click', function () {
        const action = this.textContent.trim();
    });
});

// Auth Modal Functions
function createAuthModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('authModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="authModal" class="modal">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2 style="color: #ffcc00; text-align: center; margin-bottom: 20px;">Welcome</h2>
                <div class="auth-tabs">
                    <button class="tab-btn active" data-tab="login">Login</button>
                    <button class="tab-btn" data-tab="signup">Register</button>
                </div>
                
                <div id="loginTab" class="tab-content active">
                    <form id="loginForm">
                        <div class="form-group">
                            <label class="form-label">Username or Mobile</label>
                            <input type="text" class="form-input" id="loginUsername" required placeholder="Enter username or mobile">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-input" id="loginPassword" required placeholder="Enter password">
                        </div>
                        <button type="submit" class="submit-btn">LOGIN</button>
                    </form>
                </div>
                
                <div id="signupTab" class="tab-content">
                    <form id="signupForm">
                        <div class="form-group">
                            <label class="form-label">Username *</label>
                            <input type="text" class="form-input" id="signupUsername" required placeholder="Choose a username">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mobile Number *</label>
                            <input type="tel" class="form-input" id="signupMobile" required placeholder="Enter mobile number">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password *</label>
                            <input type="password" class="form-input" id="signupPassword" required minlength="6" placeholder="At least 6 characters">
                        </div>
                        <div class="form-group">
                            <label class="form-label">WhatsApp (Optional)</label>
                            <input type="number" class="form-input" id="signupEmail" placeholder="WhatsApp Number">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Referral Code (Optional)</label>
                            <input type="text" class="form-input" id="signupReferralCode" placeholder="Enter referral code if any">
                        </div>
                        <button type="submit" class="submit-btn">CREATE ACCOUNT</button>
                    </form>
                </div>
                
                <div id="authMessage" class="auth-message"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add modal event listeners
    const modal = document.getElementById('authModal');
    const closeBtn = modal.querySelector('.close');
    const tabBtns = modal.querySelectorAll('.tab-btn');
    const tabContents = modal.querySelectorAll('.tab-content');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // Form submissions
    document.getElementById('loginForm').addEventListener('submit', handleSimpleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSimpleSignup);

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

async function handleSimpleLogin(e) {
    e.preventDefault();
    const identifier = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('authMessage');

    try {
        messageEl.textContent = 'Logging in...';
        messageEl.className = 'auth-message info';

        const result = await simpleAuth.login(identifier, password);

        if (result.success) {
            messageEl.textContent = 'Login successful!';
            messageEl.className = 'auth-message success';

            setTimeout(() => {
                const modal = document.getElementById('authModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                messageEl.textContent = '';
                document.getElementById('loginForm').reset();
            }, 1000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.className = 'auth-message error';
    }
}

async function handleSimpleSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const mobile = document.getElementById('signupMobile').value;
    const password = document.getElementById('signupPassword').value;
    const email = document.getElementById('signupEmail').value;
    const referralCode = document.getElementById('signupReferralCode').value;
    const messageEl = document.getElementById('authMessage');

    try {
        messageEl.textContent = 'Creating account...';
        messageEl.className = 'auth-message info';

        const result = await simpleAuth.register(username, mobile, password, email, referralCode);

        if (result.success) {
            messageEl.textContent = 'Account created successfully! Welcome to Lucky Spin!';
            messageEl.className = 'auth-message success';

            setTimeout(() => {
                const modal = document.getElementById('authModal');
                if (modal) {
                    modal.style.display = 'none';
                }
                messageEl.textContent = '';
                document.getElementById('signupForm').reset();
            }, 2000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.className = 'auth-message error';
    }
}

// Temporary fix: Clear corrupted auth data
function clearAuthData() {
    const savedUser = localStorage.getItem('casino_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            if (!user.id || !user.username) {
                localStorage.removeItem('casino_user');
                console.log('Cleared corrupted auth data');
            }
        } catch (error) {
            localStorage.removeItem('casino_user');
            console.log('Cleared invalid auth data');
        }
    }
}

// Run this on page load
document.addEventListener('DOMContentLoaded', function () {
    clearAuthData();
});


// --- VIP Level Check for Game Play ---
const VIP_LEVELS = {
    'Bronze': 1,
    'Silver': 2,
    'Gold': 3,
    'Platinum': 4,
    'Diamond': 5
};

async function checkVipAndPlay(requiredVipLevel, gameName) {
    // Check if user is logged in - show Visitor Popup if not
    if (!simpleAuth.currentUser) {
        try {
            const { data: settings, error } = await supabase
                .from('site_settings')
                .select('visitor_text')
                .eq('id', 1)
                .single();

            if (error) throw error;

            showVipPopup('Visitor', settings.visitor_text || 'Please login to play games.');
        } catch (e) {
            console.error(e);
            showVipPopup('Visitor', 'Please login to play games.');
        }
        return;
    }

    // Get the appropriate message based on USER'S VIP level if logged in, otherwise use required level
    const userVipLevel = simpleAuth.currentUser ? simpleAuth.currentUser.vip_level : 'Visitor';
    const effectiveVipLevel = simpleAuth.currentUser ? userVipLevel : requiredVipLevel;

    try {
        // Fetch site settings to get VIP popup messages
        const { data: settings, error } = await supabase
            .from('site_settings')
            .select('vip_bronze_text, vip_silver_text, vip_gold_text, vip_platinum_text, vip_diamond_text, vip_popup_text')
            .eq('id', 1)
            .single();

        if (error) throw error;

        // Get the appropriate message based on the effective VIP level
        let popupMessage = settings.vip_popup_text || 'Please upgrade your VIP level to play this game.';

        switch (effectiveVipLevel) {
            case 'Bronze':
                popupMessage = settings.vip_bronze_text || popupMessage;
                break;
            case 'Silver':
                popupMessage = settings.vip_silver_text || popupMessage;
                break;
            case 'Gold':
                popupMessage = settings.vip_gold_text || popupMessage;
                break;
            case 'Platinum':
                popupMessage = settings.vip_platinum_text || popupMessage;
                break;
            case 'Diamond':
                popupMessage = settings.vip_diamond_text || popupMessage;
                break;
        }

        // Show popup with the configured message
        showVipPopup(effectiveVipLevel, popupMessage);

    } catch (error) {
        console.error('Error fetching VIP settings:', error);
        // Fallback message if settings can't be loaded
        showVipPopup(requiredVipLevel, 'অনুগ্রহ করে ডিপোজিট করুন');
    }
}

function showVipPopup(requiredLevel, message) {
    // Create popup if it doesn't exist
    let overlay = document.getElementById('vip-popup-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'vip-popup-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'vip-popup-overlay' || e.target.id === 'close-popup') {
                overlay.style.display = 'none';
            }
        });
    }

    // Determine popup styling based on VIP level
    let bgColor, titleColor, btnColor, icon;

    switch (requiredLevel.toLowerCase()) {
        case 'bronze':
            bgColor = '#fff3cd';
            titleColor = '#b87333';
            btnColor = '#b87333';
            icon = '🥉';
            requiredLevel += ' VIP';
            break;
        case 'silver':
            bgColor = '#e6e6e6';
            titleColor = 'silver';
            btnColor = '#777';
            icon = '🥈';
            requiredLevel += ' VIP';
            break;
        case 'gold':
            bgColor = '#fffbe6';
            titleColor = 'gold';
            btnColor = 'gold';
            icon = '🥇';
            requiredLevel += ' VIP';
            break;
        case 'platinum':
            bgColor = '#e5e4e2';
            titleColor = '#e5e4e2';
            btnColor = '#666';
            icon = '💎';
            requiredLevel += ' VIP';
            break;
        case 'diamond':
            bgColor = '#b9f2ff';
            titleColor = '#00bfff';
            btnColor = '#00bfff';
            icon = '💎';
            requiredLevel += ' VIP';
            break;
        case 'visitor':
            bgColor = '#fff';
            titleColor = 'black';
            btnColor = '#ff4444';
            icon = '🔒';
            requiredLevel = 'Login Required'; // Override title text
            break;
        default:
            bgColor = '#fff';
            titleColor = 'black';
            btnColor = '#ff4444';
            icon = '🎮';
    }

    // Create popup HTML with original design
    overlay.innerHTML = `
        <div id="popup-box" style="
            background: ${bgColor};
            padding: 25px 30px;
            border-radius: 12px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            line-height: 1.5;
        ">
            <h2 style="color: ${titleColor}; margin-bottom: 15px;">${icon} ${requiredLevel}</h2>
            <div id="vip-popup-message" style="
                color: #333;
                font-size: 16px;
                margin-bottom: 20px;
                white-space: pre-wrap;
            ">${message}</div>
            <button id="close-popup" style="
                background: ${btnColor};
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 15px;
            ">Close</button>
        </div>
    `;

    overlay.style.display = 'flex';
}

function closeVipPopup() {
    const overlay = document.getElementById('vip-popup-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// --- 5️⃣ Close popup ---
document.addEventListener("click", e => {
    const overlay = document.getElementById("popup-overlay");
    if (!overlay) return;

    if (e.target.id === "close-popup" || e.target.id === "popup-overlay") {
        overlay.style.display = "none";
    }
});


// --- 6️⃣ Registration Timer Popup Logic ---

// Inject Styles
const timerStyles = `
    .timer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 2000000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
    }
    .timer-modal {
        background: linear-gradient(135deg, #2c3e50, #000000);
        width: 90%;
        max-width: 450px;
        border-radius: 20px;
        position: relative;
        padding: 30px;
        box-shadow: 0 0 30px rgba(255, 204, 0, 0.3);
        border: 2px solid #ffcc00;
        text-align: center;
        animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .timer-modal-header {
        margin-bottom: 20px;
    }
    .timer-modal-icon {
        font-size: 50px;
        color: #ffcc00;
        margin-bottom: 15px;
        filter: drop-shadow(0 0 10px rgba(255, 204, 0, 0.5));
    }
    .timer-modal-title {
        font-size: 24px;
        font-weight: 800;
        color: #ffcc00;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0;
    }
    .timer-modal-body {
        margin-bottom: 25px;
    }
    .timer-modal-message {
        font-size: 16px;
        line-height: 1.6;
        color: #fff;
        font-weight: 400;
        margin: 15px 0;
    }
    .timer-modal-countdown {
        background: rgba(255, 204, 0, 0.1);
        padding: 15px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        border: 1px dashed #ffcc00;
        margin-top: 10px;
        animation: pulse 1s infinite;
    }
    .timer-modal-time {
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 28px;
        font-weight: 900;
        color: #ffcc00;
    }
    .timer-modal-close {
        position: absolute;
        top: -15px;
        right: -15px;
        width: 40px;
        height: 40px;
        background: #ffcc00;
        border: none;
        border-radius: 50%;
        color: #000;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        transition: transform 0.2s;
    }
    .timer-modal-close:hover {
        transform: scale(1.1);
    }
    @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes pulse {
        0%, 100% { 
            background: rgba(255, 204, 0, 0.1); 
            box-shadow: 0 0 5px rgba(255, 204, 0, 0.2); 
        }
        50% { 
            background: rgba(255, 204, 0, 0.3); 
            box-shadow: 0 0 20px rgba(255, 204, 0, 0.6);
            transform: scale(1.02);
        }
    }
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = timerStyles.trim();
document.head.appendChild(styleSheet);

// Make global immediately
window.initRegistrationTimer = initRegistrationTimer;
window.hideTimerPopup = hideTimerPopup;

let timerManuallyClosed = false;
let registrationTimerInterval = null;

async function initRegistrationTimer() {
    console.log("%cTimer: Initializing...", "color: #ffcc00; font-weight: bold;");
    try {
        if (typeof simpleAuth === 'undefined' || !simpleAuth) {
            console.warn("Timer: simpleAuth not found, waiting 1s...");
            setTimeout(initRegistrationTimer, 1000);
            return;
        }

        if (!simpleAuth.isLoggedIn()) {
            console.log("Timer: User not logged in. Banner will show after login/signup.");
            // We don't need to poll here, SimpleAuth will call us on login.
            return;
        }

        const user = simpleAuth.currentUser;
        if (!user) {
            console.warn("Timer: No current user profile found.");
            return;
        }

        console.log("Timer: Checking eligibility for:", user.username);

        // Fetch settings (siteSettings is global from initial load)
        let settings = siteSettings;
        if (!settings || Object.keys(settings).length === 0 || typeof settings.timer_popup_enabled === 'undefined') {
            console.log("Timer: Fetching fresh settings...");
            const { data: freshSettings } = await supabase.from('site_settings').select('*').single();
            settings = freshSettings;
            if (settings) siteSettings = settings; // Update global
        }

        if (!settings) {
            console.error("Timer: Could not load site settings.");
            return;
        }

        const isEnabled = String(settings.timer_popup_enabled) === 'true' || settings.timer_popup_enabled === true || settings.timer_popup_enabled === 1;
        if (!isEnabled) {
            console.log("Timer: Banner is DISABLED in settings. (Value:", settings.timer_popup_enabled, ")");
            return;
        }

        const creationDateStr = user.created_at || user.member_since;
        if (!creationDateStr) {
            console.log("Timer: Account creation date missing. Cannot show timer.");
            return;
        }

        // Parse date safely
        const memberSinceStr = creationDateStr.replace(' ', 'T');
        const memberSinceDate = new Date(memberSinceStr);

        if (isNaN(memberSinceDate.getTime())) {
            console.error("Timer: Invalid date format:", creationDateStr);
            return;
        }

        const memberSince = memberSinceDate.getTime();
        const durationMs = (parseFloat(settings.timer_popup_duration) || 1) * 60 * 60 * 1000;
        const expiryTime = memberSince + durationMs;
        const now = Date.now();

        const remainingMs = expiryTime - now;

        console.log("Timer: Created at:", memberSinceDate.toISOString());
        console.log("Timer: Duration:", (parseFloat(settings.timer_popup_duration) || 1), "hours");
        console.log("Timer: Current status:", remainingMs > 0 ? "Active" : "Expired");
        console.log("Timer: Time left:", Math.round(remainingMs / 1000), "seconds");

        if (remainingMs <= 0) {
            console.log("%cTimer: Time period EXPIRED. (Remaining: " + Math.round(remainingMs / 1000) + "s)", "color: #ff4444;");
            hideTimerPopup(true);
            return;
        }

        // Check if manually closed in this specific page view
        if (timerManuallyClosed) {
            console.log("Timer: Banner hidden (previously closed in this page view).");
            return;
        }

        const updateTimer = () => {
            const currentTime = Date.now();
            const remaining = expiryTime - currentTime;

            if (remaining <= 0) {
                console.log("Timer: Countdown reached 0.");
                hideTimerPopup(true);
                return;
            }

            showTimerPopup(settings, remaining);
        };

        if (registrationTimerInterval) clearInterval(registrationTimerInterval);

        updateTimer();
        registrationTimerInterval = setInterval(updateTimer, 1000);

    } catch (e) {
        console.error("Timer: Runtime error:", e);
    }
}

function showTimerPopup(settings, remainingMs) {
    if (timerManuallyClosed) return;

    let overlay = document.getElementById('registrationTimerOverlay');

    // Create the overlay and modal structure ONLY ONCE
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'registrationTimerOverlay';
        overlay.className = 'timer-overlay';
        overlay.innerHTML = `
            <div class="timer-modal">
                <button class="timer-modal-close" onclick="hideTimerPopup()" title="Close">&times;</button>
                <div class="timer-modal-header">
                    <div class="timer-modal-icon"><i class="fas fa-gift"></i></div>
                    <h2 class="timer-modal-title">${settings.timer_popup_title || 'Special Gift!'}</h2>
                </div>
                <div class="timer-modal-body">
                    <p class="timer-modal-message">${settings.timer_popup_message || 'Complete your first deposit within the time limit to claim your bonus!'}</p>
                    <div class="timer-modal-countdown">
                        <i class="fas fa-history" style="color: #ffcc00; font-size: 20px;"></i>
                        <span id="timerModalTimeDisplay" class="timer-modal-time">0:00:00</span>
                    </div>
                </div>
                <button class="submit-btn" onclick="if(window.simpleAuth) simpleAuth.showPage('depositPage'); hideTimerPopup();" style="margin-top: 10px;">DEPOSIT NOW</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';
    }

    // Update ONLY the time text every second
    const timeDisplay = document.getElementById('timerModalTimeDisplay');
    if (timeDisplay) {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timeDisplay.textContent = timeStr;
    }

    if (overlay.style.display !== 'flex') {
        overlay.style.display = 'flex';
    }
}

function hideTimerPopup(isPermanent = false) {
    const overlay = document.getElementById('registrationTimerOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    timerManuallyClosed = true;

    if (registrationTimerInterval) {
        clearInterval(registrationTimerInterval);
        registrationTimerInterval = null;
    }
}

// --- 7️⃣ PWA Installation Logic ---
let deferredPrompt;

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        });
    }
}

function initPwaInstall() {
    const installBtn = document.getElementById('pwaInstallBtn');
    if (!installBtn) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can add to home screen
        installBtn.style.display = 'flex';

        installBtn.addEventListener('click', (e) => {
            // hide our user interface that shows our A2HS button
            installBtn.style.display = 'none';
            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                deferredPrompt = null;
            });
        });
    });

    window.addEventListener('appinstalled', (evt) => {
        console.log('App was installed');
        installBtn.style.display = 'none';
    });
}



