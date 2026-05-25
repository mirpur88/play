// Simple Auth System - Complete Version with All Sections
class SimpleAuth {
    constructor() {
        this.currentUser = null;
        this.profileSubscription = null;
        this.lastManualUpdate = 0;
        this.sessionId = localStorage.getItem('active_session_id') || this.generateSessionId();
        localStorage.setItem('active_session_id', this.sessionId);
        this.init();
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    async init() {
        try {
            // Check if user is logged in from localStorage
            const savedUser = localStorage.getItem('casino_user');
            if (savedUser) {
                const userData = JSON.parse(savedUser);

                // Verify the user still exists in database
                const { data: user, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userData.id)
                    .single();

                if (error || !user) {
                    // User doesn't exist in database anymore
                    localStorage.removeItem('casino_user');
                    this.currentUser = null;
                    this.updateUIForLoggedOutUser();
                } else if (user.status === 'suspended') {
                    console.warn('Suspended user detected on init');
                    localStorage.removeItem('casino_user');
                    this.currentUser = null;
                    this.updateUIForLoggedOutUser();
                } else {
                    this.currentUser = user;
                    this.updateUIForLoggedInUser();
                    this.setupRealtimeListener();
                    console.log('User restored from storage:', user.username);

                    // Trigger timer if ready (with small delay to ensure js.js loaded)
                    setTimeout(() => {
                        if (window.initRegistrationTimer) {
                            console.log('Auth: Triggering timer from storage restoration');
                            window.initRegistrationTimer();
                        } else {
                            console.warn('Auth: initRegistrationTimer not found during restoration');
                        }
                    }, 1000);
                }
            } else {
                this.updateUIForLoggedOutUser();
            }
        } catch (error) {
            console.error('Init error:', error);
            this.updateUIForLoggedOutUser();
        }
    }

    async register(username, mobile, password, email = null, referralCode = null) {
        try {
            console.log('Registration started for:', username);

            // Fetch site settings first to get welcome bonus
            let welcomeBonus = 0;
            // Assuming siteSettings is globally available from js/js.js
            // If running standalone, we might need to fetch it.
            if (typeof siteSettings !== 'undefined' && siteSettings.welcome_bonus) {
                welcomeBonus = parseFloat(siteSettings.welcome_bonus);
            } else {
                // Fallback fetch if global not ready
                const { data: settings } = await supabase.from('site_settings').select('welcome_bonus').single();
                if (settings) welcomeBonus = settings.welcome_bonus || 0;
            }

            // Basic validation
            if (!username || username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            if (!mobile || mobile.length < 10) {
                throw new Error('Please enter a valid mobile number');
            }

            if (!password || password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            // Check if username exists
            const { data: existingUsername, error: usernameError } = await supabase
                .from('profiles')
                .select('username')
                .ilike('username', username)
                .maybeSingle();

            if (usernameError) throw new Error('Error checking username availability');
            if (existingUsername) throw new Error('Username already taken');

            // Check if mobile exists
            const { data: existingMobile, error: mobileError } = await supabase
                .from('profiles')
                .select('mobile')
                .eq('mobile', mobile)
                .maybeSingle();

            if (mobileError) throw new Error('Error checking mobile number');
            if (existingMobile) throw new Error('Mobile number already registered');

            // Handle Referral Code
            let referrerId = null;
            if (referralCode && referralCode.trim() !== '') {
                const cleanCode = referralCode.trim().toUpperCase();
                const { data: referrer, error: refError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('referral_code', cleanCode)
                    .single();

                if (!refError && referrer) {
                    referrerId = referrer.id;
                    console.log('Referrer found:', referrerId);
                } else {
                    console.warn('Invalid referral code:', cleanCode);
                    // Decide if we should block registration or just ignore invalid code. usually ignore.
                }
            }

            // Create user data
            const userData = {
                username: username.trim(),
                mobile: mobile.trim(),
                password: password, // Store as plain text requested
                email: email ? email.trim() : null,
                balance: welcomeBonus, // Use dynamic welcome bonus
                vip_level: 'Bronze',
                member_since: new Date().toISOString(),
                referral_code: this.generateReferralCode(),
                loyalty_points: 100,
                is_admin: false,
                role: 'member',
                referrer_id: referrerId // Save referrer ID
            };

            console.log('Creating user with data:', userData);

            // Insert user
            const { data, error } = await supabase
                .from('profiles')
                .insert([{ ...userData, last_session_id: this.sessionId }])
                .select()
                .single();

            if (error) throw new Error('Failed to create account: ' + error.message);

            console.log('User created successfully:', data.username);

            // Reward Referrer (Increment friends_referred)
            if (referrerId) {
                console.log('Incrementing referral count for referrer:', referrerId);
                // Fetch current count first
                const { data: refProfile } = await supabase
                    .from('profiles')
                    .select('friends_referred')
                    .eq('id', referrerId)
                    .single();

                if (refProfile) {
                    const newCount = (refProfile.friends_referred || 0) + 1;
                    await supabase
                        .from('profiles')
                        .update({ friends_referred: newCount })
                        .eq('id', referrerId);
                    console.log('Referrer count updated to:', newCount);
                }
            }

            // Create welcome transaction if bonus > 0
            if (welcomeBonus > 0) {
                await this.createWelcomeTransaction(data.id, welcomeBonus);
            }

            // Auto-login
            this.currentUser = data;
            localStorage.setItem('casino_user', JSON.stringify(this.currentUser));
            this.updateUIForLoggedInUser();
            this.setupRealtimeListener();

            if (window.initRegistrationTimer) {
                window.initRegistrationTimer();
            }

            return { success: true, user: data };

        } catch (error) {
            console.error('Registration failed:', error);
            return { success: false, error: error.message };
        }
    }

    async login(identifier, password) {
        try {
            console.log('Login attempt for:', identifier);

            if (!identifier || !password) {
                throw new Error('Please enter username/mobile and password');
            }

            // Search by username or mobile (case-insensitive for username)
            const { data: user, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`username.ilike.${identifier},mobile.eq.${identifier}`)
                .single();

            if (error) {
                console.error('Login query error:', error);
                if (error.code === 'PGRST116') {
                    throw new Error('User not found');
                }
                // Check if it is a network error
                if (error.message && error.message.includes("Failed to fetch")) {
                    throw new Error('Server unreachable. Please check your internet connection or if the Supabase project is active.');
                }
                throw new Error('Login failed: ' + error.message);
            }

            if (!user) {
                throw new Error('Invalid username/mobile or password');
            }

            console.log('User found:', user.username);

            // Check password (Plain text as requested)
            console.log('Password check:', password, 'vs', user.password);

            if (user.password !== password && user.password !== this.hashPassword(password)) {
                throw new Error('Invalid password');
            }

            if (user.status === 'suspended') {
                throw new Error('This username not found. please create an account');
            }

            // Login successful
            // Generate NEW session ID on every fresh manual login
            this.sessionId = this.generateSessionId();
            localStorage.setItem('active_session_id', this.sessionId);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ last_session_id: this.sessionId })
                .eq('id', user.id);

            this.currentUser = user;
            localStorage.setItem('casino_user', JSON.stringify(user));
            this.updateUIForLoggedInUser();
            this.setupRealtimeListener();

            console.log('Login successful:', user.username);

            if (window.initRegistrationTimer) {
                window.initRegistrationTimer();
            }

            return { success: true, user: user };

        } catch (error) {
            console.error('Login failed:', error);
            // Enhance error message for network issues if not already handled
            if (error.message && error.message.includes("Failed to fetch")) {
                return { success: false, error: 'Server unreachable. Please check your internet connection or if the Supabase project is active.' };
            }
            return { success: false, error: error.message };
        }
    }

    logout() {
        if (this.profileSubscription) {
            supabase.removeChannel(this.profileSubscription);
            this.profileSubscription = null;
        }
        this.currentUser = null;
        localStorage.removeItem('casino_user');
        this.updateUIForLoggedOutUser();
        // Redirect to home if on admin page or reload
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'index.html';
        } else {
            window.location.reload();
        }
    }

    hashPassword(password) {
        // User requested simple text passwords
        return password;
    }

    setupRealtimeListener() {
        if (!this.currentUser || !this.currentUser.id) return;

        // Clear existing intervals or subscriptions
        if (this.profileSubscription) {
            supabase.removeChannel(this.profileSubscription);
        }
        if (this.balancePollInterval) {
            clearInterval(this.balancePollInterval);
        }

        console.log('Setting up real-time listener for user:', this.currentUser.id);

        // 1. REAL-TIME SUBSCRIPTION
        this.profileSubscription = supabase
            .channel(`user-updates-${this.currentUser.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${this.currentUser.id}`
            }, payload => {
                // Check for Multiple Sessions (Device Kick)
                if (payload.new.last_session_id && payload.new.last_session_id !== this.sessionId) {
                    alert('Session Terminated: You have logged in from another device or browser.');
                    this.logout();
                    return;
                }

                // Check for Multiple Games (Game Kick)
                if (payload.new.active_game_id && payload.new.active_game_id !== this.currentGameInstanceId) {
                    if (document.getElementById('gamePlayModal')?.style.display === 'block') {
                        console.warn('Another game was started elsewhere. Closing current game.');
                        if (typeof closeGameModal === 'function') closeGameModal();
                        alert('Game Session Ended: Another game has been started in a different window.');
                    }
                }

                // Handle Suspension
                if (payload.new.status === 'suspended') {
                    alert('Session Terminated: Your account has been suspended.');
                    this.logout();
                    return;
                }

                // Merge new data
                this.currentUser = { ...this.currentUser, ...payload.new };
                localStorage.setItem('casino_user', JSON.stringify(this.currentUser));
                this.updateAllUserSections();
            })
            .subscribe((status) => {
                console.log('Real-time status:', status);
                if (status === 'CHANNEL_ERROR') {
                    console.warn('Real-time failed. Falling back to polling.');
                }
            });

        // 2. POLLING FALLBACK (Every 30 seconds)
        // This ensures balance updates even if Realtime is disabled or fails
        this.balancePollInterval = setInterval(async () => {
            if (!this.currentUser) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('balance, pending_bonus, status')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && data) {
                // If status changed to suspended, logout
                if (data.status === 'suspended') {
                    this.logout();
                    clearInterval(this.balancePollInterval);
                    return;
                }

                // If balance changed, and it's not a stale update (older than our last manual push)
                const now = Date.now();
                if (now - this.lastManualUpdate > 5000) { // Only trust poll if no manual update in last 5 seconds
                    if (data.balance !== this.currentUser.balance || data.pending_bonus !== this.currentUser.pending_bonus) {
                        console.log('Polling detected balance change:', data.balance);
                        this.currentUser.balance = data.balance;
                        this.currentUser.pending_bonus = data.pending_bonus;
                        localStorage.setItem('casino_user', JSON.stringify(this.currentUser));
                        this.updateAllUserSections();
                    }
                } else {
                    console.log('Skipping poll result to prevent overwriting recent manual update');
                }
            }
        }, 30000);
    }
    generateReferralCode() {
        return 'R' + Math.random().toString(36).substr(2, 3).toUpperCase();
    }

    async createWelcomeTransaction(userId, amount) {
        try {
            const { data: userProfile } = await supabase.from('profiles').select('username').eq('id', userId).single();
            const username = userProfile?.username || 'New User';

            const { error } = await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: userId,
                        type: 'bonus',
                        amount: amount,
                        description: 'Welcome Bonus',
                        status: 'completed'
                    }
                ]);
            if (error) throw error;
            console.log('Welcome transaction created for user:', userId);
        } catch (error) {
            console.error('Error creating welcome transaction:', error);
        }
    }

    // ========== NEW METHODS ADDED HERE ==========

    updateAllUserSections() {
        if (!this.currentUser) return;

        console.log('Updating all user sections for:', this.currentUser.username);

        // Update Account Page
        this.updateAccountInfo();

        // Update Referral Page
        this.updateReferralPage();

        // Update Rewards Page
        this.updateRewardsPage();

        // Update Deposit Page (if needed)
        this.updateDepositPage();

        // Update Header Balance
        this.updateHeaderBalance();
    }

    updateHeaderBalance() {
        const loginBtn = document.getElementById('headerLoginBtn');
        if (loginBtn && this.currentUser) {
            const currency = (typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳';
            const balance = (this.currentUser.balance || 0).toFixed(2);

            loginBtn.innerHTML = `<i class="fas fa-wallet"></i> ${currency}${balance}`;
            loginBtn.style.background = '#4CAF50';

            // Override click behavior to show deposit page instead of login/logout
            if (!this.balanceClickHandler) {
                this.balanceClickHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    this.showPage('accountPage'); // User said "account section has logout", so maybe account page is better? User said "i need my current account balance in log out place". It usually links to wallet or account. Let's send to accountPage.
                };
                loginBtn.addEventListener('click', this.balanceClickHandler, true);
            }
        }
    }

    updateAccountInfo() {
        if (!this.currentUser) {
            console.error('No current user for account info');
            return;
        }

        console.log('Updating account info for:', this.currentUser.username);

        const accountDetails = document.querySelector('.account-info');
        if (accountDetails) {
            let emailHtml = '';
            if (this.currentUser.email) {
                emailHtml = `
                    <div class="account-detail">
                        <span>WhatsApp:</span>
                        <span>${this.currentUser.email}</span>
                    </div>
                `;
            }

            accountDetails.innerHTML = `
                <div class="account-detail">
                    <span>Username:</span>
                    <span>${this.currentUser.username}</span>
                </div>
                <div class="account-detail">
                    <span>Mobile:</span>
                    <span>${this.currentUser.mobile}</span>
                </div>
                ${emailHtml}
                <div class="account-detail">
                    <span>Member Since:</span>
                    <span>${new Date(this.currentUser.member_since).toLocaleDateString()}</span>
                </div>
                <div class="account-detail">
                    <span>VIP Level:</span>
                    <span style="color: #ffcc00;">${this.currentUser.vip_level}</span>
                </div>
                <div class="account-detail">
                    <span>Balance:</span>
                    <span style="color: #4CAF50;">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${(this.currentUser.balance || 0).toFixed(2)}</span>
                </div>
                <div class="account-detail">
                    <span>Bonus Balance:</span>
                    <span style="color: #ffcc00;">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${(this.currentUser.pending_bonus || 0).toFixed(2)}</span>
                </div>
            `;
            console.log('Account info updated');
        }
    }

    async updateReferralPage() {
        if (!this.currentUser) return;

        console.log('Updating referral page for:', this.currentUser.username);

        // Update referral code
        const referralCodeNode = document.querySelector('.referral-code .code');
        if (referralCodeNode) {
            referralCodeNode.textContent = this.currentUser.referral_code || 'LUCKY123';
        }

        // Update referral stats
        const referralStats = document.querySelector('.referral-stats');
        if (referralStats) {
            referralStats.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${this.currentUser.friends_referred || 0}</div>
                    <div class="stat-label">Friends Referred</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${this.currentUser.total_earnings || 0}</div>
                    <div class="stat-label">Total Earnings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.currentUser.active_friends || 0}</div>
                    <div class="stat-label">Active Friends</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${this.currentUser.pending_bonus || 0}</div>
                    <div class="stat-label">Pending Bonus</div>
                </div>
            `;
        }

        // Update referral description text
        const refBonusAmt = (typeof siteSettings !== 'undefined' && siteSettings.referral_bonus) ? siteSettings.referral_bonus : 25;
        const currency = ((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳');
        const referralDesc = document.querySelector('.referral-code p:last-child');
        if (referralDesc) {
            referralDesc.textContent = `Share code "${this.currentUser.referral_code}" with friends and earn ${currency}${refBonusAmt} when they join!`;
        }

        // Fetch and Render Referrals List
        const referralListNode = document.getElementById('referralList');
        if (referralListNode) {
            try {
                const { data: referrals, error } = await supabase
                    .from('profiles')
                    .select('username, member_since')
                    .eq('referrer_id', this.currentUser.id)
                    .order('member_since', { ascending: false });

                if (error) throw error;

                if (referrals && referrals.length > 0) {
                    referralListNode.innerHTML = referrals.map(ref => `
                        <div class="referral-item">
                            <div class="ref-user">
                                <i class="fas fa-user-circle"></i>
                                <span>${ref.username}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span class="ref-date">${new Date(ref.member_since).toLocaleDateString()}</span>
                                <span class="ref-status">Successful</span>
                            </div>
                        </div>
                    `).join('');
                } else {
                    referralListNode.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No referrals yet. Share your code to start earning!</div>';
                }
            } catch (err) {
                console.error('Error fetching referrals:', err);
                referralListNode.innerHTML = '<div style="text-align: center; color: #f44336; padding: 20px;">Failed to load referrals.</div>';
            }
        }
    }

    async updateRewardsPage() {
        if (!this.currentUser) return;

        console.log('Updating rewards page with dynamic campaigns...');

        // 1. Update loyalty/VIP stats
        const rewardsGrid = document.querySelector('.rewards-grid');
        if (rewardsGrid) {
            const loyaltyProgress = Math.min(((this.currentUser.loyalty_points || 0) / 2000) * 100, 100);
            rewardsGrid.innerHTML = `
                <div class="reward-card">
                    <i class="fas fa-coins reward-icon"></i>
                    <div class="stat-value">${this.currentUser.loyalty_points || 0}</div>
                    <div class="stat-label">Loyalty Points</div>
                    <div class="progress-bar"><div class="progress" style="width: ${loyaltyProgress}%"></div></div>
                    <div class="stat-label">Next: 2000 pts</div>
                </div>
                <div class="reward-card">
                    <i class="fas fa-trophy reward-icon"></i>
                    <div class="stat-value">${this.currentUser.vip_level || 'Bronze'}</div>
                    <div class="stat-label">VIP Level</div>
                    <div class="progress-bar"><div class="progress" style="width: 40%"></div></div>
                    <div class="stat-label">Next: Silver</div>
                </div>
            `;
        }

        if (!this.currentUser || !this.currentUser.id) {
            console.error('No current user id for rewards page update');
            return;
        }

        // 2. Fetch Data: Campaigns, Manual Eligibilities, History, Site Settings and FRESH Profile
        const [eligRes, campRes, claimsRes, settingsRes, profileRes] = await Promise.all([
            supabase.from('user_bonus_eligibility').select('*').eq('user_id', this.currentUser.id).eq('is_available', true),
            supabase.from('available_bonuses').select('*').eq('is_active', true),
            supabase.from('transactions').select('description, amount').eq('user_id', this.currentUser.id).eq('type', 'bonus'),
            supabase.from('site_settings').select('referral_bonus').single(),
            supabase.from('profiles').select('*').eq('id', this.currentUser.id).single()
        ]);

        if (profileRes.data) {
            this.currentUser = { ...this.currentUser, ...profileRes.data };
            localStorage.setItem('casino_user', JSON.stringify(this.currentUser));
        }

        const eligibilities = eligRes.data || [];
        const campaigns = campRes.data || [];
        const claims = claimsRes.data || [];
        const settings = settingsRes.data || { referral_bonus: 0 };

        console.log(`REWARDS DEBUG: Found ${campaigns.length} campaigns and ${claims.length} previous bonus claims for user.`);
        if (claims.length > 0) console.table(claims);

        // 3. Render Campaigns
        const bonusSections = document.querySelectorAll('.rewards-grid');
        if (bonusSections.length > 1) {
            const bonusSection = bonusSections[1];
            bonusSection.innerHTML = ''; // Clear existing

            // Render Dynamic Campaigns
            campaigns.forEach(camp => {
                // Check for exact claim description (from js.js)
                const claimCount = claims.filter(c => {
                    if (!c.description) return false;
                    const desc = c.description;
                    const exactMatch = `Claimed Bonus: ${camp.bonus_name}`;
                    const legacyMatch = `${camp.bonus_name} Bonus Claimed`;
                    const simpleMatch = camp.bonus_name;
                    return desc === exactMatch || desc === legacyMatch || desc === simpleMatch;
                }).length;

                const maxClaims = camp.max_claims_per_user || 1;

                // RE-CLAIM LOGIC: Find any eligibility record that HAS NOT BEEN USED yet
                const unusedElig = eligibilities.filter(e =>
                    e.bonus_type === camp.bonus_type &&
                    parseFloat(e.amount) === parseFloat(camp.amount) &&
                    e.is_available !== false
                );
                const canClaimManual = unusedElig.length > 0;

                // STRICT BOOLEAN CHECK: Prevent "false" string from being truthy
                const isAutoUnlockSet = (camp.auto_unlock === true || String(camp.auto_unlock) === 'true');
                const isAutoUnlocked = isAutoUnlockSet && claimCount < maxClaims;

                const isAvailable = canClaimManual || isAutoUnlocked;

                console.log(`- Campaign: ${camp.bonus_name}, AutoUnlock: ${isAutoUnlockSet}, ManualElig: ${canClaimManual}, Claims: ${claimCount}, Available: ${isAvailable}`);

                const card = document.createElement('div');
                const isAlreadyClaimed = claimCount >= maxClaims && !canClaimManual;
                card.className = `reward-card ${!isAvailable && !isAlreadyClaimed ? 'locked' : ''}`;

                let iconClass = 'fa-gift';
                if (camp.bonus_type.includes('birthday')) iconClass = 'fa-birthday-cake';
                if (camp.bonus_type.includes('weekly')) iconClass = 'fa-calendar';
                if (camp.bonus_type.includes('daily')) iconClass = 'fa-sun';

                let buttonHtml = '';
                if (isAlreadyClaimed) {
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 8px 15px; background: #4CAF50; color: white; cursor: not-allowed; opacity: 1;" disabled>CLAIMED</button>`;
                } else if (isAvailable) {
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 8px 15px;" onclick="claimBonus('${camp.bonus_type}', '${camp.id}')">CLAIM</button>`;
                } else {
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 8px 15px; opacity: 0.5; cursor: not-allowed;" disabled>PENDING</button>`;
                }

                card.innerHTML = `
                    <i class="fas ${iconClass} reward-icon" style="${!isAvailable && !isAlreadyClaimed ? 'opacity: 0.5' : ''}"></i>
                    <div class="stat-value">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${camp.amount}</div>
                    <div class="stat-label">${camp.bonus_name}</div>
                    ${buttonHtml}
                `;
                bonusSection.appendChild(card);
            });

            // 4. Append Referral Bonus Card (if configured)
            if (settings.referral_bonus > 0) {
                // Calculate unclaimed referrals
                const referredFriends = parseInt(this.currentUser.friends_referred) || 0;

                // Count successful referral bonus claims with stricter matching
                const claimedRefs = claims.filter(c => {
                    const desc = (c.description || '');
                    // Be specific to our known claim descriptions
                    return desc === 'Referral Bonus Claim' ||
                        desc === 'Referral Bonus: Claimed success referral' ||
                        desc.toLowerCase() === 'referral bonus claim';
                }).length;

                const unclaimedRefs = Math.max(0, referredFriends - claimedRefs);

                console.log(`REFERRAL DEBUG: Total Referred=${referredFriends}, Previously Claimed=${claimedRefs}, Net Unclaimed=${unclaimedRefs}`);

                const refCard = document.createElement('div');
                refCard.className = 'reward-card';

                let buttonHtml = '';
                if (unclaimedRefs > 0) {
                    // Show CLAIM button if there are referrals that haven't been claimed yet
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 10px 20px; background: #ffcc00; color: #000; font-weight: bold;" onclick="claimBonus('referral_bonus', 'site_setting')">CLAIM (${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${settings.referral_bonus * unclaimedRefs})</button>`;
                } else if (referredFriends > 0 && claimedRefs >= referredFriends) {
                    // Show CLAIMED ONLY if we strictly have enough claim transactions
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 8px 15px; background: #4CAF50; color: white; cursor: not-allowed; opacity: 1;" disabled>CLAIMED</button>`;
                } else {
                    // Otherwise show VIEW REFS to encourage more referrals
                    buttonHtml = `<button class="play-btn" style="margin-top: 10px; padding: 8px 15px;" onclick="simpleAuth.showPage('referralPage')">VIEW REFS</button>`;
                }

                refCard.innerHTML = `
                    <i class="fas fa-user-plus reward-icon"></i>
                    <div class="stat-value">${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${settings.referral_bonus}</div>
                    <div class="stat-label"></div>
                    <p style="font-size: 0.9em; color: #aaa; margin-top: 5px;">
                        ${referredFriends > 0 ? `<b>Total Referrals: ${referredFriends}</b>` : 'Invite friends to earn ' + ((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳') + settings.referral_bonus + ' each!'}
                    </p>
                    ${buttonHtml}
                `;
                bonusSection.appendChild(refCard);
            }

            if (campaigns.length === 0 && settings.referral_bonus <= 0) {
                bonusSection.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888;">No active bonus campaigns at the moment.</div>';
            }
        }
    }

    updateDepositPage() {
        if (!this.currentUser) return;

        console.log('Updating deposit page for:', this.currentUser.username);

        let depositBalance = document.querySelector('.deposit-balance');

        if (!depositBalance) {
            const depositForm = document.querySelector('.deposit-form');
            if (depositForm) {
                const balanceHtml = `
                <div class="form-group deposit-balance" style="text-align: center; margin-bottom: 20px;">
                    <div style="color: #ffcc00; font-size: 18px; font-weight: bold;">
                        Current Balance: ${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${(this.currentUser.balance || 0).toFixed(2)}
                    </div>
                </div>
            `;
                depositForm.insertAdjacentHTML('afterbegin', balanceHtml);
                depositBalance = document.querySelector('.deposit-balance');
            }
        }

        if (depositBalance) {
            depositBalance.textContent = `Current Balance: ${((typeof siteSettings !== 'undefined' && siteSettings.currency_symbol) || '৳')}${(this.currentUser.balance || 0).toFixed(2)}`;
        }
    }


    // ========== END OF NEW METHODS ==========

    updateUIForLoggedInUser() {
        console.log('Updating UI for logged in user');

        if (!this.currentUser) {
            console.error('No current user for logged in UI');
            return;
        }

        // Update login button
        // Update login button (balance handled by updateHeaderBalance)
        const loginBtn = document.getElementById('headerLoginBtn');
        if (loginBtn) {
            console.log('Login button updated to Balance display');
        }

        // Show ALL navigation buttons
        document.querySelectorAll('.nav-item').forEach(item => {
            item.style.display = 'flex';
        });

        // Update ALL user sections with current data
        this.updateAllUserSections();

        // Redirect admin to admin.html if applicable
        if (this.currentUser.is_admin && !window.location.pathname.includes('admin.html')) {
            window.location.href = 'admin.html';
            return;
        }

        // Show home page by default for non-admins
        this.showPage('homePage');

        console.log('UI fully updated for logged in user');
    }

    updateUIForLoggedOutUser() {
        console.log('Updating UI for logged out user');

        // Update login button
        const loginBtn = document.getElementById('headerLoginBtn');
        if (loginBtn) {
            loginBtn.textContent = 'LOGIN';
            loginBtn.style.background = 'linear-gradient(to right, #ffcc00, #ff9900)';

            // Remove override handler
            if (this.balanceClickHandler) {
                loginBtn.removeEventListener('click', this.balanceClickHandler, true);
                this.balanceClickHandler = null;
            }

            console.log('Login button updated to LOGIN');
        }

        // Reset to home page
        this.showPage('homePage');

        // Show only Home button for logged-out users
        document.querySelectorAll('.nav-item').forEach(item => {
            const pageId = item.getAttribute('data-page');
            if (pageId !== 'homePage') {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });

        // Hide admin button
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }

        console.log('UI updated for logged out state');
    }

    showPage(pageId) {
        console.log('Showing page:', pageId);

        // Hide all pages
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            console.log('Page activated:', pageId);

            // Update the specific page data when navigated to
            if (this.currentUser) {
                switch (pageId) {
                    case 'accountPage':
                        this.updateAccountInfo();
                        break;
                    case 'referralPage':
                        this.updateReferralPage();
                        break;
                    case 'rewardsPage':
                        this.updateRewardsPage();
                        break;
                    case 'depositPage':
                        this.updateDepositPage();
                        break;
                }
            }
        } else {
            console.error('Page not found:', pageId);
        }

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
                console.log('Nav item activated for:', pageId);
            }
        });
    }

    async updateBalance(amount) {
        if (!this.currentUser) return;
        this.lastManualUpdate = Date.now(); // Mark time of update to prevent poll overwrites

        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ balance: amount })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;

            console.log('Balance successfully updated in DB:', amount);
            this.currentUser.balance = amount;
            localStorage.setItem('casino_user', JSON.stringify(this.currentUser));

            // Force immediate UI update
            this.updateAllUserSections();

            // Dispatch a global event so other scripts know balance changed
            window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: amount }));

            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    async refreshUser() {
        if (!this.currentUser || !this.currentUser.id) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            if (data) {
                this.currentUser = data;
                localStorage.setItem('casino_user', JSON.stringify(this.currentUser));
                this.updateAllUserSections();
                console.log('User profile refreshed successfully:', data.balance);
            }
        } catch (err) {
            console.error('Error refreshing user profile:', err);
        }
    }

    async addToBalance(amount) {
        const newBalance = (this.currentUser.balance || 0) + amount;
        return await this.updateBalance(newBalance);
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getUser() {
        return this.currentUser;
    }
}

// Initialize auth system
window.simpleAuth = new SimpleAuth();


