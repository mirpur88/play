// Admin Management - Complete with Bonus Management
class AdminManager {
    constructor() {
        this.isAdmin = false;
        this.chart = null;
        this.activityLimit = 20;
        this.maxActivityLimit = 500;
        this.init();
    }

    // Timezone Utility Functions
    getCurrencyTimezoneMap() {
        return {
            '৳': 'Asia/Dhaka',      // BDT - Bangladesh
            '$': 'America/New_York', // USD - United States
            '₹': 'Asia/Kolkata',     // INR - India
            '₨': 'Asia/Karachi',     // PKR - Pakistan
            '฿': 'Asia/Bangkok',     // THB - Thailand
            '€': 'Europe/Paris',     // EUR - Europe
            '£': 'Europe/London',    // GBP - United Kingdom
            'R$': 'America/Sao_Paulo', // BRL - Brazil
            'Rp': 'Asia/Jakarta',    // IDR - Indonesia
            '₫': 'Asia/Ho_Chi_Minh', // VND - Vietnam
            'RM': 'Asia/Kuala_Lumpur', // MYR - Malaysia
            '₦': 'Africa/Lagos'      // NGN - Nigeria
        };
    }

    getConfiguredTimezone() {
        const currency = window.siteCurrency || '৳';
        const timezoneMap = this.getCurrencyTimezoneMap();
        return timezoneMap[currency] || 'Asia/Dhaka'; // Default to Asia/Dhaka
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            const timezone = this.getConfiguredTimezone();

            // Format with 24-hour time in configured timezone
            return date.toLocaleString('en-GB', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'Never';

        try {
            const date = new Date(dateString);
            const timezone = this.getConfiguredTimezone();

            // Format date only (no time) in configured timezone
            return date.toLocaleDateString('en-GB', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    async init() {
        // Ensure toast container exists
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Store active refresh intervals
        this.activeIntervals = {
            dashboard: null,
            users: null,
            members: null,
            transactions: null
        };

        this.setupMobileMenu();

        // Wait for simpleAuth to initialize
        setTimeout(() => {
            this.checkAdminStatus();
        }, 1000);
    }

    showToast(message, type = 'success') {
        const container = document.querySelector('.toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }


    setupMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const closeSidebar = document.getElementById('closeSidebar');
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (menuToggle && sidebar && overlay) {
            menuToggle.onclick = () => {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            };

            const closeMenu = () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            };

            if (closeSidebar) closeSidebar.onclick = closeMenu;
            overlay.onclick = closeMenu;

            // Close on nav link click (mobile)
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 1024) closeMenu();
                });
            });

            // History Search - Enter Key Support
            const historySearch = document.getElementById('historySearch');
            if (historySearch) {
                historySearch.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.loadGameHistory();
                });
            }
        }
    }

    setupRealtimeSubscriptions() {
        console.log('Setting up consolidated realtime subscriptions...');

        // 1. Transactions Channel - handles deposits, payments, and general refreshed
        this.transactionsChannel = supabase
            .channel('transactions-all-changes')
            .on('postgres_changes', {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'transactions'
            }, (payload) => {
                console.log('Transaction change detected:', payload.eventType, payload.new);

                // Notifications
                if (payload.eventType === 'INSERT') {
                    if (payload.new.type === 'deposit') {
                        if (window.notificationManager) {
                            window.notificationManager.addNotification(
                                'New Deposit Submitted',
                                `${payload.new.amount} ${window.siteCurrency || '৳'} deposit request received from ${payload.new.username || 'a user'}.`,
                                'deposit',
                                payload.new,
                                payload.new.id
                            );
                        }
                    } else if (payload.new.type === 'withdraw') {
                        if (window.notificationManager) {
                            window.notificationManager.addNotification(
                                'New Withdrawal Request',
                                `${payload.new.amount} ${window.siteCurrency || '৳'} withdrawal request received from ${payload.new.username || 'a user'}.`,
                                'withdraw',
                                payload.new,
                                payload.new.id
                            );
                        }
                    }
                }

                // Removed auto-refreshes to prevent interrupting the graph view
                // Only notifications will trigger in real-time
            })
            .subscribe();

        // 2. Profiles Channel - handles member joins
        this.profilesChannel = supabase
            .channel('profiles-all-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, (payload) => {
                console.log('Profile change detected:', payload.eventType, payload.new);

                // Notification for new members
                if (payload.eventType === 'INSERT') {
                    if (window.notificationManager) {
                        window.notificationManager.addNotification(
                            'New Member Joined',
                            `${payload.new.username || 'New user'} has just registered.`,
                            'member',
                            payload.new
                        );
                    }
                }

                // Removed auto-refreshes to prevent interrupting the graph view
            })
            .subscribe();

        console.log('✅ Realtime subscriptions active');
    }

    cleanupRealtimeSubscriptions() {
        if (this.transactionsChannel) {
            supabase.removeChannel(this.transactionsChannel);
            this.transactionsChannel = null;
        }
        if (this.profilesChannel) {
            supabase.removeChannel(this.profilesChannel);
            this.profilesChannel = null;
        }
        console.log('Realtime subscriptions cleaned up');
    }

    async checkAdminStatus() {
        // Wait for simpleAuth to be ready if it's not yet
        if (!simpleAuth.currentUser && localStorage.getItem('casino_user')) {
            setTimeout(() => this.checkAdminStatus(), 500);
            return;
        }

        if (simpleAuth && simpleAuth.currentUser) {
            this.isAdmin = simpleAuth.currentUser.is_admin === true;
            this.role = simpleAuth.currentUser.role || (this.isAdmin ? 'admin' : 'member');

            // If on admin.html and not admin, kick them out
            if (window.location.pathname.includes('admin.html')) {
                if (!this.isAdmin) {
                    window.location.href = 'index.html';
                    return;
                }
                this.initPage();
            }
        } else {
            // Not logged in
            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
            }
        }
    }

    initPage() {
        // Navigation Handling
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.classList.contains('logout-link')) return; // Allow normal navigation
                e.preventDefault();

                // Sidebar Active State
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Show Content
                const tabId = link.getAttribute('data-tab');

                // Track current tab for realtime updates
                this.currentTab = tabId + 'Tab';

                document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));

                const targetSection = document.getElementById(tabId + 'Tab');
                if (targetSection) {
                    targetSection.classList.add('active');
                    document.getElementById('pageTitle').textContent = link.innerText.trim();

                    // Show global refresh only on dashboard
                    const topRefresh = document.getElementById('topHeaderRefresh');
                    if (topRefresh) {
                        topRefresh.style.display = (tabId === 'dashboard') ? 'flex' : 'none';
                    }
                }

                // Mobile Setup: Close sidebar on selection
                document.querySelector('.sidebar').classList.remove('show');

                // Load Data
                if (tabId === 'dashboard') this.loadDashboardStats();
                if (tabId === 'users') this.loadUsers();
                if (tabId === 'members') this.loadMembers();
                if (tabId === 'transactions') this.loadTransactions();
                if (tabId === 'history') this.loadGameHistory();
                if (tabId === 'bonuses') this.loadBonusManagement();
                if (tabId === 'payments') this.loadPayments();
                if (tabId === 'settings') this.loadSettings();
            });
        });

        // Check for pending notifications
        this.checkPendingNotifications();

        // Setup realtime subscriptions for live updates
        this.setupRealtimeSubscriptions();
        console.log('Live updates enabled via Supabase realtime');

        // Mobile Menu Toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('show');
            });
        }

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const toggle = document.getElementById('menuToggle');
            if (window.innerWidth <= 768 &&
                sidebar.classList.contains('show') &&
                !sidebar.contains(e.target) &&
                !toggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });

        // User Profile
        if (simpleAuth && simpleAuth.currentUser) {
            const adminNameEls = document.querySelectorAll('.admin-name');
            adminNameEls.forEach(el => el.textContent = simpleAuth.currentUser.username);

            const adminRoleEl = document.getElementById('adminRole');
            if (adminRoleEl) {
                const role = simpleAuth.currentUser.role || (simpleAuth.currentUser.is_admin ? 'admin' : 'member');
                adminRoleEl.textContent = role.replace('_', ' ');
            }

            const avatarEl = document.querySelector('.avatar');
            if (avatarEl) avatarEl.textContent = simpleAuth.currentUser.username.charAt(0).toUpperCase();
        }

        // Load More Recent Activity
        const loadMoreBtn = document.getElementById('loadMoreActivityBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadRecentActivity(true);
            });
        }

        // Action Buttons
        this.setupActionButtons();

        // Initial Data Load
        this.loadDashboardStats();

        // Apply Role Restrictions
        this.applyRoleRestrictions();

        // Also preload others if needed or just wait for click
        this.loadUsersForBonus(); // Still needed for bonus dropdown

        // NEW: Initialize Charts
        this.initDashboardChart();
    }

    applyRoleRestrictions() {
        if (!simpleAuth.currentUser) return;

        // Use live role from simpleAuth, normalized to lowercase
        const rawRole = simpleAuth.currentUser.role || (simpleAuth.currentUser.is_admin ? 'admin' : 'member');
        this.role = rawRole.toLowerCase();
        const role = this.role;

        console.log('Applying restrictions for role:', role);

        const restrictedTabs = ['users', 'bonuses', 'settings'];

        document.querySelectorAll('.nav-link').forEach(link => {
            const tabId = link.getAttribute('data-tab');
            if (restrictedTabs.includes(tabId)) {
                // If role is exactly 'admin', hide. If 'super_admin' or anything else, show.
                if (role === 'admin') {
                    link.style.display = 'none';
                } else {
                    link.style.display = 'flex';
                }
            }
        });

        // If user is exactly 'admin' and currently on a hidden tab, redirect to dashboard
        if (role === 'admin') {
            const activeLink = document.querySelector('.nav-link.active');
            const currentTabId = activeLink ? activeLink.getAttribute('data-tab') : null;

            if (restrictedTabs.includes(currentTabId)) {
                const dashboardLink = document.querySelector('.nav-link[data-tab="dashboard"]');
                if (dashboardLink) dashboardLink.click();
            }
        }
    }


    // Settings Methods
    setupActionButtons() {
        // Refresh buttons
        const refreshUsersBtn = document.getElementById('refreshUsers'); // Old existing one?
        if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', () => this.loadUsers());

        // New Refresh Buttons & Auto-Refresh Logic
        const setupAutoRefresh = (btnId, selectId, loadFn, intervalKey) => {
            const btn = document.getElementById(btnId);
            const select = document.getElementById(selectId);

            // Manual Refresh
            if (btn) {
                btn.addEventListener('click', () => {
                    loadFn.call(this);
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-spin');
                        setTimeout(() => icon.classList.remove('fa-spin'), 1000);
                    }
                });
            }

            // Auto Refresh
            if (select) {
                select.addEventListener('change', (e) => {
                    const ms = parseInt(e.target.value);

                    // Clear existing
                    if (this.activeIntervals[intervalKey]) {
                        clearInterval(this.activeIntervals[intervalKey]);
                        this.activeIntervals[intervalKey] = null;
                    }

                    if (ms > 0) {
                        console.log(`Starting auto-refresh for ${intervalKey} every ${ms}ms`);
                        loadFn.call(this); // Load immediately once
                        this.activeIntervals[intervalKey] = setInterval(() => {
                            console.log(`Auto-refreshing ${intervalKey}...`);
                            loadFn.call(this);

                            // Visual feedback
                            if (btn) {
                                const icon = btn.querySelector('i');
                                if (icon && !icon.classList.contains('fa-spin')) {
                                    icon.classList.add('fa-spin');
                                    setTimeout(() => icon.classList.remove('fa-spin'), 1000);
                                }
                            }
                        }, ms);
                    } else {
                        console.log(`Stopped auto-refresh for ${intervalKey}`);
                    }
                });
            }
        };

        setupAutoRefresh('refreshDashboardBtn', 'dashboardAutoRefresh', this.loadDashboardStats, 'dashboard');
        setupAutoRefresh('refreshUsersBtn2', 'usersAutoRefresh', this.loadUsers, 'users');
        setupAutoRefresh('refreshMembersBtn', 'membersAutoRefresh', this.loadMembers, 'members');
        setupAutoRefresh('refreshTransactionsBtn', 'txAutoRefresh', this.loadTransactions, 'transactions');

        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.addEventListener('click', () => this.addUser());

        const refreshBonusesBtn = document.getElementById('refreshBonuses');
        if (refreshBonusesBtn) refreshBonusesBtn.addEventListener('click', () => this.loadBonusManagement());

        // Payment Form Submission
        const paymentApprovalForm = document.getElementById('paymentApprovalForm');
        if (paymentApprovalForm) {
            paymentApprovalForm.addEventListener('submit', (e) => this.savePaymentApproval(e));
        }

        const rejectPaymentBtn = document.getElementById('rejectPaymentBtn');
        if (rejectPaymentBtn) {
            rejectPaymentBtn.addEventListener('click', () => this.rejectPayment());
        }

        const refreshTxBtn = document.getElementById('refreshTransactions');
        if (refreshTxBtn) refreshTxBtn.addEventListener('click', () => this.loadTransactions());

        // Helper for Search (Debounced)
        const setupSearch = (inputId, loadFn) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            let timeout;
            input.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => loadFn.call(this, e.target.value), 500);
            });
        };

        setupSearch('userSearch', this.loadUsers);
        setupSearch('txSearch', this.loadTransactions);
        setupSearch('memberSearch', this.loadMembers);
        setupSearch('paySearch', this.loadPayments);

        const editVIPForm = document.getElementById('editVIPForm');
        if (editVIPForm) editVIPForm.addEventListener('submit', (e) => this.saveVIP(e));

        const grantBonusForm = document.getElementById('grantBonusForm');
        if (grantBonusForm) grantBonusForm.addEventListener('submit', (e) => this.saveGrantBonus(e));

        // Bonus Actions
        const addNewBonusBtn = document.getElementById('addNewBonus');
        if (addNewBonusBtn) addNewBonusBtn.addEventListener('click', () => this.showBonusForm());

        const bonusForm = document.getElementById('bonusForm');
        if (bonusForm) bonusForm.addEventListener('submit', (e) => this.saveBonus(e));

        const addBonusBtn = document.getElementById('addBonusBtn');
        if (addBonusBtn) addBonusBtn.addEventListener('click', () => this.addBonus());

        // Settings Buttons
        const addCarouselBtn = document.getElementById('addCarouselBtn');
        if (addCarouselBtn) addCarouselBtn.addEventListener('click', () => this.showCarouselForm()); // Changed to modal

        const carouselForm = document.getElementById('carouselForm');
        if (carouselForm) carouselForm.addEventListener('submit', (e) => this.saveCarouselItem(e));

        const addGameBtn = document.getElementById('addGameBtn');
        if (addGameBtn) addGameBtn.addEventListener('click', () => this.showGameForm());

        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => this.showCategoryForm());

        const saveWalletBtn = document.getElementById('saveWalletBtn');
        if (saveWalletBtn) saveWalletBtn.addEventListener('click', (e) => { e.preventDefault(); this.saveWalletSettings(); });

        const saveGeneralBtn = document.getElementById('saveGeneralBtn');
        if (saveGeneralBtn) saveGeneralBtn.addEventListener('click', (e) => { e.preventDefault(); this.saveGeneralSettings(); });

        // Game Forms
        const gameForm = document.getElementById('gameForm');
        if (gameForm) gameForm.addEventListener('submit', (e) => this.saveGame(e));

        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) categoryForm.addEventListener('submit', (e) => this.saveCategory(e));

        // File Upload Handlers
        this.setupFileUpload('gameImageFile', 'gameImage');
        this.setupFileUpload('carouselImageFile', 'carouselImageUrl');

        // New Filters Handlers
        this.initAdvancedFilters();
    }

    initAdvancedFilters() {
        // User Filters
        const userDateFilter = document.getElementById('userDateFilter');
        if (userDateFilter) {
            userDateFilter.addEventListener('change', (e) => {
                document.getElementById('userCustomDates').style.display = e.target.value === 'custom' ? 'flex' : 'none';
                this.loadUsers();
            });
        }
        ['userStartDate', 'userEndDate', 'userVipFilter', 'userSort'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.loadUsers());
            if (el && el.tagName === 'INPUT') el.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.loadUsers();
            });
        });

        // Transaction Filters
        const txDateFilter = document.getElementById('txDateFilter');
        if (txDateFilter) {
            txDateFilter.addEventListener('change', (e) => {
                document.getElementById('txCustomDates').style.display = e.target.value === 'custom' ? 'flex' : 'none';
                this.loadTransactions();
            });
        }
        ['txStartDate', 'txEndDate', 'txStatusFilter', 'txTypeFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.loadTransactions());
        });

        // Payment Filters
        const payDateFilter = document.getElementById('payDateFilter');
        if (payDateFilter) {
            payDateFilter.addEventListener('change', (e) => {
                document.getElementById('payCustomDates').style.display = e.target.value === 'custom' ? 'flex' : 'none';
                this.loadPayments();
            });
        }
        ['payStartDate', 'payEndDate', 'payStatusFilter', 'payTypeFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.loadPayments());
        });

        // Member Filters
        const memberDateFilter = document.getElementById('memberDateFilter');
        if (memberDateFilter) {
            memberDateFilter.addEventListener('change', (e) => {
                const customDiv = document.getElementById('memberCustomDates');
                if (customDiv) customDiv.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                this.loadMembers();
            });
        }
        ['memberStartDate', 'memberEndDate', 'memberVipFilter', 'memberSort'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.loadMembers());
            if (el && el.tagName === 'INPUT') el.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') this.loadMembers();
            });
        });
    }

    getDateRange(filterType, startId, endId) {
        const timezone = this.getConfiguredTimezone();
        const now = new Date();

        // Helper to get offset-adjusted midnight in UTC for a given date
        const getTzMidnight = (d) => {
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
            const tzWall = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
            const utcWall = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
            const offset = tzWall.getTime() - utcWall.getTime();
            const midnightWall = new Date(dateStr + 'T00:00:00Z').getTime();
            return new Date(midnightWall - offset);
        };

        // Offset between local wall clock and target timezone wall clock
        const currentTzOffset = (new Date(now.toLocaleString('en-US', { timeZone: timezone }))).getTime() - (new Date(now.toLocaleString('en-US'))).getTime();

        let start = null;
        let end = new Date();

        if (filterType === 'today') {
            start = getTzMidnight(now);
        } else if (filterType === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            start = getTzMidnight(yesterday);
            end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
        } else if (filterType === 'week') {
            const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            tzNow.setDate(tzNow.getDate() - tzNow.getDay());
            const startOfWeekStr = tzNow.toLocaleDateString('en-CA', { timeZone: timezone });
            const tzWall = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            const utcWall = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const offset = tzWall.getTime() - utcWall.getTime();
            start = new Date(new Date(startOfWeekStr + 'T00:00:00Z').getTime() - offset);
        } else if (filterType === 'month') {
            const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            tzNow.setDate(1);
            const startOfMonthStr = tzNow.toLocaleDateString('en-CA', { timeZone: timezone });
            const tzWall = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            const utcWall = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const offset = tzWall.getTime() - utcWall.getTime();
            start = new Date(new Date(startOfMonthStr + 'T00:00:00Z').getTime() - offset);
        } else if (filterType === 'year') {
            const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            tzNow.setMonth(0, 1);
            const startOfYearStr = tzNow.toLocaleDateString('en-CA', { timeZone: timezone });
            const tzWall = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            const utcWall = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
            const offset = tzWall.getTime() - utcWall.getTime();
            start = new Date(new Date(startOfYearStr + 'T00:00:00Z').getTime() - offset);
        } else if (filterType === 'custom') {
            const s = document.getElementById(startId).value;
            const e = document.getElementById(endId).value;
            if (s) {
                // Assume s is the date in the local zone, adjust to target zone midnight
                const d = new Date(s + 'T00:00:00');
                const tzWall = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
                const utcWall = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
                const offset = tzWall.getTime() - utcWall.getTime();
                start = new Date(d.getTime() - offset);
            }
            if (e) {
                const d = new Date(e + 'T23:59:59.999');
                const tzWall = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
                const utcWall = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
                const offset = tzWall.getTime() - utcWall.getTime();
                end = new Date(d.getTime() - offset);
            }
        }
        return { start, end };
    }

    setupFileUpload(fileInputId, urlInputId) {
        const fileInput = document.getElementById(fileInputId);
        const urlInput = document.getElementById(urlInputId);
        if (fileInput && urlInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    urlInput.value = 'Uploading...';
                    urlInput.disabled = true;
                    const url = await this.uploadImage(file);
                    urlInput.value = url;
                } catch (err) {
                    console.error(err);
                    alert('Upload failed: ' + err.message);
                    urlInput.value = '';
                } finally {
                    urlInput.disabled = false;
                }
            });
        }
    }

    async uploadImage(file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Ensure bucket exists or handle error (Assuming 'site-assets' exists as per instructions)
        const { data, error } = await supabase.storage
            .from('site-assets')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('site-assets')
            .getPublicUrl(filePath);

        return publicUrl;
    }

    async checkPendingNotifications() {
        if (!window.notificationManager) return;

        try {
            const { data: pending, error } = await supabase
                .from('transactions')
                .select('*, profiles(username)')
                .in('type', ['deposit', 'withdraw'])
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching pending notifications:', error);
                return;
            }

            if (pending && pending.length > 0) {
                console.log(`Syncing ${pending.length} pending notifications...`);

                pending.forEach(tx => {
                    const typeLabel = tx.type === 'deposit' ? 'Deposit' : 'Withdrawal';
                    const title = `New ${typeLabel} Request`;
                    const username = tx.profiles?.username || 'user';
                    const currency = window.siteCurrency || '৳';
                    const message = `${tx.amount} ${currency} ${tx.type} request received from ${username}.`;

                    window.notificationManager.addNotification(
                        title,
                        message,
                        tx.type,
                        tx,
                        tx.id, // Use transaction ID for deduplication
                        false  // Don't play sound for initial sync
                    );
                });
            }
        } catch (e) {
            console.error('Error in checkPendingNotifications:', e);
        }
    }

    async loadDashboardStats() {
        try {
            // Parallel requests for stats
            const [usersRes, depositsRes, bonusesRes] = await Promise.all([
                supabase.from('profiles').select('created_at', { count: 'exact' }),
                supabase.from('transactions').select('amount').eq('type', 'deposit').eq('status', 'completed'),
                supabase.from('transactions').select('amount').eq('type', 'bonus') // Status might not be 'completed' for all bonuses depending on schema
            ]);

            const totalUsers = usersRes.count || 0;
            const deposits = depositsRes.data || [];
            const bonuses = bonusesRes.data || [];

            // Calculate Sums
            const totalDeposits = deposits.reduce((sum, tx) => sum + (tx.amount || 0), 0);
            const totalBonuses = bonuses.reduce((sum, tx) => sum + (tx.amount || 0), 0);

            // New Today - Use same timezone logic as chart for perfect sync
            const timezone = this.getConfiguredTimezone();
            const now = new Date();
            const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

            const newToday = usersRes.data.filter(u => {
                const userDate = new Date(u.created_at);
                const userDateStr = userDate.toLocaleDateString('en-CA', { timeZone: timezone });
                return userDateStr === todayDateStr; // Compare date strings instead of timestamps
            }).length;

            // Update UI
            if (document.getElementById('totalUsersCount'))
                document.getElementById('totalUsersCount').textContent = totalUsers;

            if (document.getElementById('totalDepositsAmount'))
                document.getElementById('totalDepositsAmount').textContent = `${window.siteCurrency || '৳'}${totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

            if (document.getElementById('totalBonusesAmount'))
                document.getElementById('totalBonusesAmount').textContent = `${window.siteCurrency || '৳'}${totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

            if (document.getElementById('newUsersToday'))
                document.getElementById('newUsersToday').textContent = newToday;

            // Load Recent Activity
            this.loadRecentActivity();

            // Refresh Chart
            this.updateDashboardChart();
        } catch (error) {
            console.error('Error in loadDashboardStats:', error);
        }
    }

    // --- ANALYTICS CHART METHODS ---

    initDashboardChart() {
        const timeRangeSelect = document.getElementById('chartTimeRange');
        const metricSelect = document.getElementById('chartMetric');
        const customDateInputs = document.getElementById('customDateInputs');
        const startDateInput = document.getElementById('chartStartDate');
        const endDateInput = document.getElementById('chartEndDate');

        if (!timeRangeSelect) return;

        // Toggle custom date inputs
        timeRangeSelect.addEventListener('change', () => {
            if (timeRangeSelect.value === 'custom') {
                customDateInputs.style.display = 'flex';
            } else {
                customDateInputs.style.display = 'none';
                this.updateDashboardChart();
            }
        });

        metricSelect.addEventListener('change', () => this.updateDashboardChart());
        startDateInput.addEventListener('change', () => this.updateDashboardChart());
        endDateInput.addEventListener('change', () => this.updateDashboardChart());
    }

    async updateDashboardChart() {
        const metric = document.getElementById('chartMetric').value;
        const timeRange = document.getElementById('chartTimeRange').value;
        const startDateVal = document.getElementById('chartStartDate').value;
        const endDateVal = document.getElementById('chartEndDate').value;

        let start, end = new Date();

        if (timeRange === '7days') {
            start = new Date();
            start.setDate(end.getDate() - 7);
        } else if (timeRange === 'month') {
            start = new Date();
            start.setMonth(end.getMonth() - 1);
        } else if (timeRange === 'year') {
            start = new Date();
            start.setFullYear(end.getFullYear() - 1);
        } else if (timeRange === 'custom') {
            if (!startDateVal || !endDateVal) return;
            start = new Date(startDateVal);
            end = new Date(endDateVal);
        }

        try {
            let labels = [];
            let dataPoints = [];
            let table = metric === 'new_members' ? 'profiles' : 'transactions';
            let dateColumn = 'created_at';

            // Fix: Profiles table doesn't have an 'amount' column
            let selectCols = metric === 'new_members' ? dateColumn : `amount, ${dateColumn}`;

            let query = supabase.from(table).select(selectCols)
                .order(dateColumn);

            if (metric === 'new_members') {
                query = query.gte(dateColumn, start.toISOString()).lte(dateColumn, end.toISOString());
            } else {
                query = query.gte(dateColumn, start.toISOString()).lte(dateColumn, end.toISOString())
                    .eq('status', 'completed');

                if (metric === 'deposits') query = query.eq('type', 'deposit');
                if (metric === 'bonuses') query = query.eq('type', 'bonus');
            }

            const { data, error } = await query;
            if (error) throw error;

            // Process data for chart - Group by date in configured timezone
            const timezone = this.getConfiguredTimezone();
            const pointsByDay = {};

            // Initialize all days in range using configured timezone
            let curr = new Date(start);
            while (curr <= end) {
                // Convert to timezone-aware date string
                const dateStr = curr.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD
                pointsByDay[dateStr] = 0;
                curr.setDate(curr.getDate() + 1);
            }

            data.forEach(item => {
                // Convert item date to configured timezone's date
                const itemDate = new Date(item[dateColumn]);
                const dateStr = itemDate.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD

                if (pointsByDay[dateStr] !== undefined) {
                    if (metric === 'new_members') {
                        pointsByDay[dateStr]++;
                    } else {
                        pointsByDay[dateStr] += (item.amount || 0);
                    }
                }
            });

            labels = Object.keys(pointsByDay).sort(); // Sort for chronological order
            dataPoints = labels.map(label => pointsByDay[label]); // Map in sorted order

            this.renderChart(labels, dataPoints, metric);

        } catch (e) {
            console.error('Chart update error:', e);
        }
    }

    renderChart(labels, data, metric) {
        const ctx = document.getElementById('dashboardChart').getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const labelMap = {
            'new_members': 'New Members',
            'deposits': 'Deposits (৳)',
            'bonuses': 'Bonuses Given (৳)'
        };

        const colorMap = {
            'new_members': '#4CAF50',
            'deposits': '#2196F3',
            'bonuses': '#ff9800'
        };

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelMap[metric],
                    data: data,
                    borderColor: colorMap[metric],
                    backgroundColor: colorMap[metric] + '20',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: colorMap[metric],
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1a1a1a',
                        titleColor: '#fff',
                        bodyColor: '#aaa',
                        borderColor: '#333',
                        borderWidth: 1,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#777'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#777',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }

    async loadRecentActivity(loadMore = false) {
        try {
            if (loadMore) {
                this.activityLimit = Math.min(this.activityLimit + 50, this.maxActivityLimit);
            }

            const { data: recents, error } = await supabase
                .from('transactions')
                .select('*, profiles(username)')
                .order('created_at', { ascending: false })
                .limit(this.activityLimit);

            if (recents) {
                const tbody = document.getElementById('recentActivityBody');
                if (!tbody) return;

                if (recents.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center">No activity found</td></tr>';
                } else {
                    tbody.innerHTML = recents.map(tx => `
                        <tr>
                            <td>
                                <div style="font-weight: 500;">
                                    ${tx.profiles?.username || 'Unknown'}
                                    ${tx.receipt_url ? `<a href="${tx.receipt_url}" target="_blank" style="margin-left: 5px; color: var(--accent-color);" title="View Receipt"><i class="fas fa-image"></i></a>` : ''}
                                </div>
                                <div style="font-size: 12px; color: #888;">${tx.type.toUpperCase()}</div>
                            </td>
                            <td>${tx.description || '-'}</td>
                            <td style="color: ${(tx.type === 'deposit' || tx.type === 'game_win') ? '#4CAF50' : (tx.type === 'game_bet' ? '#ff5252' : '#ffcc00')}">
                                ${(tx.type === 'deposit' || tx.type === 'game_win') ? '+' : (tx.type === 'game_bet' || tx.type === 'withdraw' ? '-' : '')}${window.siteCurrency || '৳'}${tx.amount}
                            </td>
                            <td style="font-size: 13px; color: #888;">${this.formatDateTime(tx.created_at)}</td>
                        </tr>
                    `).join('');
                }

                // Update Load More button state
                const loadMoreBtn = document.getElementById('loadMoreActivityBtn');
                if (loadMoreBtn) {
                    if (recents.length < this.activityLimit || this.activityLimit >= this.maxActivityLimit) {
                        loadMoreBtn.style.display = 'none';
                    } else {
                        loadMoreBtn.style.display = 'inline-block';
                        loadMoreBtn.innerHTML = `<i class="fas fa-plus"></i> Load More (${recents.length}/${this.maxActivityLimit})`;
                    }
                }
            }
        } catch (e) { console.error(e); }
    }

    // Settings Methods
    async loadSettings() {
        try {
            // General Settings from Supabase
            const {
                data: settings,
                error
            } = await supabase.from('site_settings').select('*').single();

            if (settings) {
                const siteName = settings.site_logo_text || 'Khelun ar jitun';
                document.getElementById('settingLogoText').value = siteName;
                document.title = siteName + " - Admin Dashboard";
                document.getElementById('settingLogoUrl').value = settings.site_logo_url || '';
                document.getElementById('settingWelcomeBalance').value = settings.welcome_bonus || '0';
                document.getElementById('settingReferralBonus').value = settings.referral_bonus || '0';
                document.getElementById('settingVipBronze').value = settings.vip_bronze_text || '';
                document.getElementById('settingVipSilver').value = settings.vip_silver_text || '';
                document.getElementById('settingVipGold').value = settings.vip_gold_text || '';
                document.getElementById('settingVipPlatinum').value = settings.vip_platinum_text || '';
                document.getElementById('settingVipDiamond').value = settings.vip_diamond_text || '';
                if (document.getElementById('settingVisitorText')) {
                    document.getElementById('settingVisitorText').value = settings.visitor_text || '';
                }

                if (document.getElementById('settingTelegram')) {
                    document.getElementById('settingTelegram').value = settings.telegram_link || '';
                }
                if (document.getElementById('settingWhatsapp')) {
                    document.getElementById('settingWhatsapp').value = settings.whatsapp_link || '';
                }
                if (document.getElementById('settingFacebook')) {
                    document.getElementById('settingFacebook').value = settings.facebook_link || '';
                }
                if (document.getElementById('settingLiveChat')) {
                    document.getElementById('settingLiveChat').value = settings.livechat_link || '';
                }
                if (document.getElementById('settingSupportEmail')) {
                    document.getElementById('settingSupportEmail').value = settings.support_email || '';
                }

                // Timer Popup Settings
                if (document.getElementById('settingTimerEnabled')) {
                    document.getElementById('settingTimerEnabled').checked = settings.timer_popup_enabled || false;
                }
                if (document.getElementById('settingTimerDuration')) {
                    document.getElementById('settingTimerDuration').value = settings.timer_popup_duration || 1;
                }
                if (document.getElementById('settingTimerTitle')) {
                    document.getElementById('settingTimerTitle').value = settings.timer_popup_title || '';
                }
                if (document.getElementById('settingTimerMessage')) {
                    document.getElementById('settingTimerMessage').value = settings.timer_popup_message || '';
                }

                // Wallets
                document.getElementById('walletBkash').value = settings.bkash_number || '';
                document.getElementById('walletNagad').value = settings.nagad_number || '';
                document.getElementById('walletRocket').value = settings.rocket_number || '';
                document.getElementById('walletUsdt').value = settings.usdt_address || '';

                if (document.getElementById('settingCurrency')) {
                    document.getElementById('settingCurrency').value = settings.currency_symbol || '৳';
                }

                // Store globally for display
                window.siteCurrency = settings.currency_symbol || '৳';
            } else {
                console.log("No settings found, creating default...");
            }

            // Load Tables
            this.loadGames();
            this.loadCarousel();

        } catch (e) {
            console.error(e);
        }
    }

    async saveGeneralSettings() {
        const settings = {
            site_logo_text: document.getElementById('settingLogoText').value,
            site_logo_url: document.getElementById('settingLogoUrl').value,
            welcome_bonus: parseFloat(document.getElementById('settingWelcomeBalance').value),
            referral_bonus: parseFloat(document.getElementById('settingReferralBonus').value),
            vip_bronze_text: document.getElementById('settingVipBronze').value,
            vip_silver_text: document.getElementById('settingVipSilver').value,
            vip_gold_text: document.getElementById('settingVipGold').value,
            vip_platinum_text: document.getElementById('settingVipPlatinum').value,
            vip_diamond_text: document.getElementById('settingVipDiamond').value,
            visitor_text: document.getElementById('settingVisitorText')?.value || '',
            telegram_link: document.getElementById('settingTelegram')?.value || '',
            whatsapp_link: document.getElementById('settingWhatsapp')?.value || '',
            facebook_link: document.getElementById('settingFacebook')?.value || '',
            livechat_link: document.getElementById('settingLiveChat')?.value || '',
            support_email: document.getElementById('settingSupportEmail')?.value || '',
            currency_symbol: document.getElementById('settingCurrency').value,
            timer_popup_enabled: document.getElementById('settingTimerEnabled')?.checked || false,
            timer_popup_duration: parseInt(document.getElementById('settingTimerDuration')?.value) || 1,
            timer_popup_title: document.getElementById('settingTimerTitle')?.value || '',
            timer_popup_message: document.getElementById('settingTimerMessage')?.value || '',
            updated_at: new Date().toISOString()
        };

        try {
            const {
                error
            } = await supabase
                .from('site_settings')
                .update(settings)
                .eq('id', 1); // Assuming single row with ID 1

            if (error) throw error;

            alert('General settings saved!');
            // location.reload(); // Optional
        } catch (e) {
            console.error(e);
            alert('Error saving settings: ' + e.message);
        }
    }

    async saveWalletSettings() {
        const wallets = {
            bkash_number: document.getElementById('walletBkash').value,
            nagad_number: document.getElementById('walletNagad').value,
            rocket_number: document.getElementById('walletRocket').value,
            usdt_address: document.getElementById('walletUsdt').value,
            updated_at: new Date().toISOString()
        };

        try {
            const {
                error
            } = await supabase
                .from('site_settings')
                .update(wallets)
                .eq('id', 1);

            if (error) throw error;

            alert('Wallet settings saved!');
        } catch (e) {
            console.error(e);
            alert('Error saving wallets: ' + e.message);
        }
    }


    // Deprecated for index.html but kept to avoid errors if referenced
    initAdminPanel() { }

    async loadUsers(searchTerm = null) {
        try {
            const dateFilter = document.getElementById('userDateFilter')?.value || 'all';
            const { start, end } = this.getDateRange(dateFilter, 'userStartDate', 'userEndDate');
            const search = searchTerm || document.getElementById('userSearch')?.value;
            const vipFilter = document.getElementById('userVipFilter')?.value || 'all';

            let query = supabase.from('profiles').select('*');

            if (search) {
                query = query.or(`username.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
            }
            if (start) query = query.gte('created_at', start.toISOString());
            if (end) query = query.lte('created_at', end.toISOString());
            if (vipFilter !== 'all') query = query.eq('vip_level', vipFilter);

            const sortVal = document.getElementById('userSort')?.value || 'created_desc';
            if (sortVal === 'created_desc') query = query.order('created_at', { ascending: false });
            else if (sortVal === 'created_asc') query = query.order('created_at', { ascending: true });
            else if (sortVal === 'balance_desc') query = query.order('balance', { ascending: false });
            else if (sortVal === 'balance_asc') query = query.order('balance', { ascending: true });
            else query = query.order('created_at', { ascending: false }); // default

            const { data: users, error } = await query;

            if (error) {
                console.error('Error loading users:', error);
                return;
            }

            this.currentUsers = users; // Store for export

            // Fetch Additional Stats
            const userIds = users.map(u => u.id);
            const stats = await this.getUserStats(userIds);
            this.currentUserStats = stats;

            // Handle Post-Fetch Sorting for Calculated Fields
            if (sortVal === 'deposit_desc') {
                users.sort((a, b) => (stats[b.id]?.totalDep || 0) - (stats[a.id]?.totalDep || 0));
            } else if (sortVal === 'withdraw_desc') {
                users.sort((a, b) => (stats[b.id]?.totalWith || 0) - (stats[a.id]?.totalWith || 0));
            } else if (sortVal === 'bonus_desc') {
                users.sort((a, b) => (stats[b.id]?.totalBonus || 0) - (stats[a.id]?.totalBonus || 0));
            }

            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';

            const selectAllCheckbox = document.getElementById('selectAllUsersMain');
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            this.updateSelectedCount();

            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No users found</td></tr>';
                return;
            }

            users.forEach(user => {
                const s = stats[user.id] || { totalDep: 0, totalWith: 0, totalBonus: 0, lastDep: null, lastWith: null };
                const isSuspended = user.status === 'suspended';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="checkbox" class="user-checkbox" value="${user.id}" onchange="adminManager.updateSelectedCount()"></td>
                    <td>
                        <div style="font-weight: bold;">${user.username || 'N/A'}</div>
                        <div style="font-size: 0.8em; color: #888;">ID: ${user.id ? user.id.substring(0, 8) : 'N/A'}</div>
                        ${user.is_admin ? `<span style="color: #ffcc00; font-size: 10px; text-transform: uppercase;">[${user.role || 'admin'}]</span>` : ''}
                    </td>
                    <td>
                        <div>${user.mobile || 'N/A'}</div>
                        <div style="font-size: 0.8em; color: #888;">${user.email || 'No WhatsApp'}</div>
                    </td>
                    <td>
                        <div style="color: #4CAF50; font-weight: bold;">Bal: ${window.siteCurrency || '৳'}${user.balance?.toFixed(2) || '0.00'}</div>
                        <div style="font-size: 0.8em; color: #aaa;">Dep: ${window.siteCurrency || '৳'}${s.totalDep.toFixed(2)}</div>
                        <div style="font-size: 0.8em; color: #f44336;">With: ${window.siteCurrency || '৳'}${s.totalWith.toFixed(2)}</div>
                        <div style="font-size: 0.8em; color: #2196F3;">Bonus: ${window.siteCurrency || '৳'}${s.totalBonus.toFixed(2)}</div>
                    </td>
                    <td>
                        <div style="font-size: 0.85em;">Dep: ${s.lastDep ? this.formatDateTime(s.lastDep) : 'Never'}</div>
                        <div style="font-size: 0.85em;">With: ${s.lastWith ? this.formatDateTime(s.lastWith) : 'Never'}</div>
                        <div style="font-size: 0.85em; color: #888;">Join: ${this.formatDateTime(user.created_at)}</div>
                    </td>
                    <td>
                        <div class="badge" style="background: #333; padding: 4px 8px; border-radius: 4px; display:inline-block; margin-bottom: 5px;">${user.vip_level || 'Bronze'}</div>
                        <div style="font-size: 0.85em; color: var(--accent-color);">Refs: ${user.friends_referred || 0}</div>
                    </td>
                    <td>
                        <span class="status-badge" style="background: ${isSuspended ? '#f44336' : '#4CAF50'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em;">
                            ${isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="edit-btn" onclick="adminManager.editUser('${user.id}')" title="Edit User"><i class="fas fa-edit"></i></button>
                            <button class="action-btn" onclick="adminManager.toggleUserStatus('${user.id}', '${user.status || 'active'}')" 
                                style="background: ${isSuspended ? '#4CAF50' : '#ff9800'}; color: white; padding: 5px 8px; font-size: 10px;" title="${isSuspended ? 'Re-open' : 'Suspend'}">
                                <i class="fas ${isSuspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                            </button>
                            <button class="delete-btn" onclick="adminManager.deleteUser('${user.id}')" title="Delete User"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    toggleAllUsers(mainCheckbox) {
        document.querySelectorAll('.user-checkbox').forEach(cb => {
            cb.checked = mainCheckbox.checked;
        });
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const selected = document.querySelectorAll('.user-checkbox:checked');
        const bulkActions = document.getElementById('userBulkActions');
        const countSpan = document.getElementById('selectedCount');

        if (selected.length > 0) {
            bulkActions.style.display = 'flex';
            countSpan.textContent = `${selected.length} Selected`;
        } else {
            bulkActions.style.display = 'none';
        }
    }

    async bulkDeleteUsers() {
        const selected = Array.from(document.querySelectorAll('.user-checkbox:checked')).map(cb => cb.value);
        if (!confirm(`Are you sure you want to delete ${selected.length} users? Their financial records will be anonymized but preserved.`)) return;

        try {
            // 1. Unlink referrals
            await supabase.from('profiles')
                .update({ referrer_id: null })
                .in('referrer_id', selected);

            // 2. Delete bonus rights (future claims)
            await supabase.from('user_bonus_eligibility')
                .delete()
                .in('user_id', selected);

            // 3. Keep history (anonymize)
            await supabase.from('user_bonuses')
                .update({ user_id: null })
                .in('user_id', selected);

            await supabase.from('transactions')
                .update({ user_id: null })
                .in('user_id', selected);

            // 4. Finally delete profiles
            const { error } = await supabase.from('profiles').delete().in('id', selected);

            if (error) throw error;
            alert(`Successfully deleted ${selected.length} users (history preserved).`);
            this.loadUsers();
        } catch (e) {
            alert('Bulk delete failed: ' + e.message);
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? Their history (transactions) will be anonymized but preserved.')) return;

        try {
            const selected = [userId];

            // 1. Unlink referrals
            await supabase.from('profiles')
                .update({ referrer_id: null })
                .in('referrer_id', selected);

            // 2. Delete eligibility (future/state)
            await supabase.from('user_bonus_eligibility')
                .delete()
                .in('user_id', selected);

            // 3. Keep history (anonymize)
            await supabase.from('user_bonuses')
                .update({ user_id: null })
                .in('user_id', selected);

            await supabase.from('transactions')
                .update({ user_id: null })
                .in('user_id', selected);

            // 4. Finally delete profiles
            const { error } = await supabase.from('profiles').delete().in('id', selected);

            if (error) throw error;
            alert('User deleted successfully (history preserved).');
            this.loadUsers();
        } catch (e) {
            alert('Delete failed: ' + e.message);
        }
    }

    showBulkEditModal() {
        const selectedCount = document.querySelectorAll('.user-checkbox:checked').length;
        const modalHTML = `
            <div id="bulkEditModal" class="modal">
                <div class="modal-content" style="max-width: 400px;">
                    <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    <h2 style="color: #ffcc00; margin-bottom: 20px;">Bulk Edit (${selectedCount} users)</h2>
                    <p style="font-size: 0.9em; color: #888; margin-bottom: 20px;">Leave fields empty to keep current values.</p>
                    
                    <div class="form-group">
                        <label class="form-label">Add to Balance (৳)</label>
                        <input type="number" id="bulkAddBalance" class="form-input" placeholder="e.g. 100">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Update VIP Level</label>
                        <select id="bulkVipLevel" class="form-input">
                            <option value="">No Change</option>
                            <option value="Bronze">Bronze</option>
                            <option value="Silver">Silver</option>
                            <option value="Gold">Gold</option>
                            <option value="Platinum">Platinum</option>
                            <option value="Diamond">Diamond</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Loyalty Points</label>
                        <input type="number" id="bulkLoyalty" class="form-input" placeholder="e.g. 500">
                    </div>

                    <button onclick="adminManager.executeBulkUpdate()" class="submit-btn" style="width: 100%; margin-top: 20px; background: #ffcc00; color: black; font-weight: bold;">
                        Apply to All Selected
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('bulkEditModal').style.display = 'block';
    }

    async executeBulkUpdate() {
        const selectedIds = Array.from(document.querySelectorAll('.user-checkbox:checked')).map(cb => cb.value);
        const addBalance = parseFloat(document.getElementById('bulkAddBalance').value);
        const vipLevel = document.getElementById('bulkVipLevel').value;
        const loyalty = document.getElementById('bulkLoyalty').value;

        if (isNaN(addBalance) && !vipLevel && !loyalty) {
            alert('Please specify at least one change');
            return;
        }

        try {
            const updates = [];
            for (const id of selectedIds) {
                let updateData = {};
                if (vipLevel) updateData.vip_level = vipLevel;
                if (loyalty) updateData.loyalty_points = parseInt(loyalty);

                // For balance addition, we need to fetch individual balances or use a SQL increment if possible.
                // Supabase doesn't have an easy "add X to current value" without a function, so we fetch & update.
                if (!isNaN(addBalance)) {
                    const { data: user } = await supabase.from('profiles').select('balance').eq('id', id).single();
                    updateData.balance = (user.balance || 0) + addBalance;
                }

                if (Object.keys(updateData).length > 0) {
                    updates.push(supabase.from('profiles').update(updateData).eq('id', id));
                }
            }

            await Promise.all(updates);
            alert('Bulk update completed successfully!');
            document.getElementById('bulkEditModal').remove();
            this.loadUsers();
        } catch (e) {
            alert('Bulk update error: ' + e.message);
        }
    }

    async loadTransactions(search = null) {
        try {
            const dateFilter = document.getElementById('txDateFilter')?.value || 'all';
            const typeFilter = document.getElementById('txTypeFilter')?.value || 'all';
            const statusFilter = document.getElementById('txStatusFilter')?.value || 'all';
            const { start, end } = this.getDateRange(dateFilter, 'txStartDate', 'txEndDate');
            const searchTerm = search || document.getElementById('txSearch')?.value;

            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    profiles (email, username)
                `)
                .not('description', 'ilike', '%Bet on%')
                .not('description', 'ilike', '%Win on%');

            if (searchTerm) {
                // Find user IDs that match the search term from profiles
                const { data: matchedUsers } = await supabase.from('profiles').select('id').ilike('username', `%${searchTerm}%`);
                const matchedIds = matchedUsers ? matchedUsers.map(u => u.id) : [];

                if (matchedIds.length > 0) {
                    // Search by description OR match the user IDs found in profiles
                    query = query.or(`description.ilike.%${searchTerm}%,user_id.in.(${matchedIds.map(id => `"${id}"`).join(',')})`);
                } else {
                    query = query.ilike('description', `%${searchTerm}%`);
                }
            }
            if (typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            }
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (start) query = query.gte('created_at', start.toISOString());
            if (end) query = query.lte('created_at', end.toISOString());

            const { data: transactions, error } = await query
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error loading transactions:', error);
                return;
            }
            this.currentTransactions = transactions; // Save for export

            const tbody = document.getElementById('transactionsTableBody');
            tbody.innerHTML = '';

            if (transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transactions found</td></tr>';
                return;
            }

            transactions.forEach(tx => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${tx.id ? tx.id.substring(0, 8) + '...' : 'N/A'}</td>
                    <td>${tx.profiles?.email || tx.profiles?.username || 'N/A'}</td>
                    <td>
                            ${tx.type || 'N/A'}
                        </span>
                    </td>
                    <td>${window.siteCurrency || '৳'}${tx.amount?.toFixed(2) || '0.00'}</td>
                    <td>${tx.description || 'N/A'}</td>
                    <td>
                        <span style="color: ${tx.status === 'completed' ? '#4CAF50' : '#ff9800'}">
                            ${tx.status || 'completed'}
                        </span>
                    </td>
                    <td>${this.formatDateTime(tx.created_at)}</td>
                    <td>
                        ${tx.receipt_url ? `
                            <a href="${tx.receipt_url}" target="_blank" title="View Receipt">
                                <i class="fas fa-image" style="font-size: 1.2em; color: var(--accent-color);"></i>
                            </a>
                        ` : '<span style="color: #666;">No Receipt</span>'}
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    async loadPayments(search = null) {
        try {
            const dateFilter = document.getElementById('payDateFilter')?.value || 'all';
            const typeFilter = document.getElementById('payTypeFilter')?.value || 'all';
            const statusFilter = document.getElementById('payStatusFilter')?.value || 'all';
            const { start, end } = this.getDateRange(dateFilter, 'payStartDate', 'payEndDate');
            const searchTerm = search || document.getElementById('paySearch')?.value;

            const tbody = document.getElementById('paymentsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading payments...</td></tr>';

            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    profiles (id, email, username, balance)
                `);

            // Apply Filters
            if (searchTerm) {
                // Find user IDs that match from profiles
                const { data: matchedUsers } = await supabase.from('profiles').select('id').ilike('username', `%${searchTerm}%`);
                const matchedIds = matchedUsers ? matchedUsers.map(u => u.id) : [];

                if (matchedIds.length > 0) {
                    query = query.or(`description.ilike.%${searchTerm}%,user_id.in.(${matchedIds.map(id => `"${id}"`).join(',')})`);
                } else {
                    query = query.ilike('description', `%${searchTerm}%`);
                }
            }
            if (typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            } else {
                query = query.in('type', ['deposit', 'withdraw']);
            }
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (start) query = query.gte('created_at', start.toISOString());
            if (end) query = query.lte('created_at', end.toISOString());

            const { data: payments, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            this.currentPayments = payments; // Save for export

            tbody.innerHTML = '';

            if (!payments || payments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No pending payments found</td></tr>';
                return;
            }

            payments.forEach(tx => {
                const row = document.createElement('tr');
                const isDeposit = tx.type === 'deposit';

                row.innerHTML = `
                    <td>
                        <div style="font-weight: bold;">${tx.profiles?.username || 'Unknown'}</div>
                        <div style="font-size: 0.8em; color: #888;">${tx.profiles?.email || ''}</div>
                    </td>
                    <td>
                        <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.85em; background: ${isDeposit ? 'rgba(76, 175, 80, 0.1)' : 'rgba(33, 150, 243, 0.1)'}; color: ${isDeposit ? '#4CAF50' : '#2196F3'}; text-transform: uppercase;">
                            ${tx.type}
                        </span>
                    </td>
                    <td style="font-weight: bold; color: ${isDeposit ? '#4CAF50' : '#f44336'}">
                        ${window.siteCurrency || '৳'}${tx.amount?.toFixed(2)}
                    </td>
                    <td>
                        <div style="font-size: 0.9em;">${tx.description || 'No details'}</div>
                    </td>
                    <td>${this.formatDateTime(tx.created_at)}</td>
                    <td>
                        <span class="status-badge" style="background: ${tx.status === 'completed' ? '#4CAF50' : (tx.status === 'rejected' ? '#f44336' : '#ff9800')}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em;">
                            ${tx.status?.toUpperCase() || 'PENDING'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            ${tx.status === 'pending' ? `
                                <button onclick="adminManager.openPaymentApproval('${tx.id}')" class="action-btn" style="background: var(--accent-color); color: #000; padding: 5px 10px; font-size: 0.85em;">
                                    <i class="fas fa-check"></i> Manage
                                </button>
                            ` : `<span style="color: #666; font-size: 0.8em;">Processed</span>`}
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading payments:', error);
            alert('Error loading payments: ' + error.message);
        }
    }

    async openPaymentApproval(txId) {
        try {
            const { data: tx, error } = await supabase
                .from('transactions')
                .select(`*, profiles(username, balance)`)
                .eq('id', txId)
                .single();

            if (error) throw error;

            const modal = document.getElementById('paymentApprovalModal');
            document.getElementById('approvalTxId').value = tx.id;
            document.getElementById('approvalUserId').value = tx.user_id;
            document.getElementById('approvalType').value = tx.type;
            document.getElementById('approvalTypeDisplay').textContent = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
            document.getElementById('approvalAmount').value = tx.amount;
            document.getElementById('approvalNote').value = tx.description || '';

            // Handle Receipt Image Display
            const receiptSection = document.getElementById('approvalReceiptSection');
            const receiptImg = document.getElementById('approvalReceiptImg');
            const receiptLink = document.getElementById('approvalReceiptLink');

            if (tx.receipt_url && tx.type === 'deposit') {
                receiptImg.src = tx.receipt_url;
                receiptLink.href = tx.receipt_url;
                receiptSection.style.display = 'block';
            } else {
                receiptSection.style.display = 'none';
                receiptImg.src = '';
            }

            const amountLabel = document.getElementById('approvalAmountLabel');
            if (tx.type === 'withdraw') {
                amountLabel.textContent = `Amount to Deduct (৳) - User Bal: ৳${tx.profiles?.balance?.toFixed(2)}`;
            } else {
                amountLabel.textContent = `Amount to Add to Balance (৳)`;
            }

            modal.style.display = 'flex';
        } catch (error) {
            alert('Error fetching transaction details: ' + error.message);
        }
    }

    async savePaymentApproval(e) {
        e.preventDefault();
        const txId = document.getElementById('approvalTxId').value;
        const userId = document.getElementById('approvalUserId').value;
        const type = document.getElementById('approvalType').value;
        const amount = parseFloat(document.getElementById('approvalAmount').value);
        const note = document.getElementById('approvalNote').value;

        try {
            if (type === 'deposit') {
                // For deposit approval: Add amount to user balance
                const { data: user, error: userError } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', userId)
                    .single();

                if (userError) throw userError;

                const newBalance = (user.balance || 0) + amount;
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ balance: newBalance })
                    .eq('id', userId);

                if (updateError) throw updateError;
            }

            // Update transaction status
            const { error: txError } = await supabase
                .from('transactions')
                .update({
                    status: 'completed',
                    amount: amount,
                    description: note,
                    updated_at: new Date().toISOString()
                })
                .eq('id', txId);

            if (txError) throw txError;

            // alert('Payment approved successfully!');
            this.showToast('Payment approved successfully!');
            document.getElementById('paymentApprovalModal').style.display = 'none';
            this.loadPayments();
            this.loadDashboardStats();

        } catch (error) {
            console.error('Approval error:', error);
            alert('Failed to approve payment: ' + error.message);
        }
    }

    async rejectPayment() {
        const txId = document.getElementById('approvalTxId').value;
        const userId = document.getElementById('approvalUserId').value;
        const type = document.getElementById('approvalType').value;
        const amount = parseFloat(document.getElementById('approvalAmount').value);
        const note = document.getElementById('approvalNote').value;

        // if (!confirm('Are you sure you want to REJECT this payment?')) return;

        try {
            if (type === 'withdraw') {
                // If rejecting a withdrawal, REFUND the amount to the user
                const { data: user, error: userError } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', userId)
                    .single();

                if (userError) throw userError;

                const newBalance = (user.balance || 0) + amount;
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ balance: newBalance })
                    .eq('id', userId);

                if (updateError) throw updateError;
            }

            // Update transaction status to rejected
            const { error: txError } = await supabase
                .from('transactions')
                .update({
                    status: 'rejected',
                    description: note + ' (REJECTED BY ADMIN)',
                    updated_at: new Date().toISOString()
                })
                .eq('id', txId);

            if (txError) throw txError;

            // alert('Payment rejected and status updated.');
            this.showToast('Payment rejected successfully', 'error');
            document.getElementById('paymentApprovalModal').style.display = 'none';
            this.loadPayments();

        } catch (error) {
            console.error('Rejection error:', error);
            alert('Failed to reject payment: ' + error.message);
        }
    }

    async loadUsersForBonus() {
        try {
            const { data: users, error } = await supabase
                .from('profiles')
                .select('id, email, username, balance')
                .order('username');

            if (error) {
                console.error('Error loading users:', error);
                return;
            }

            // Populate Select Dropdown
            const select = document.getElementById('bonusUserSelect');
            if (select) {
                select.innerHTML = '<option value="">Select User</option>';
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.username} (${user.email}) - $${(user.balance || 0).toFixed(2)}`;
                    select.appendChild(option);
                });
            }

            // Populate Checklist
            const checklist = document.getElementById('userChecklist');
            if (checklist) {
                checklist.innerHTML = users.map(user => `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 5px; background: #333; border-radius: 4px; border: 1px solid #444; font-size: 0.85em; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <input type="checkbox" class="bulk-user-checkbox" value="${user.id}">
                        <span title="${user.username} (${user.email})">${user.username} ($${(user.balance || 0).toFixed(0)})</span>
                    </label>
                `).join('');
            }

            // Setup search functionality AFTER users are loaded
            this.setupUserSearch();

        } catch (error) {
            console.error('Error loading users for bonus:', error);
        }
    }

    setupUserSearch() {
        // Single user search
        const singleSearch = document.getElementById('userSearchSingle');
        if (singleSearch) {
            // Remove old listener if exists
            const newSingleSearch = singleSearch.cloneNode(true);
            singleSearch.parentNode.replaceChild(newSingleSearch, singleSearch);

            newSingleSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const options = document.getElementById('bonusUserSelect').options;
                for (let i = 1; i < options.length; i++) {
                    const txt = options[i].text.toLowerCase();
                    options[i].style.display = txt.includes(term) ? '' : 'none';
                }
            });
        }

        // Bulk user search
        const bulkSearch = document.getElementById('userSearchBulk');
        if (bulkSearch) {
            // Remove old listener if exists
            const newBulkSearch = bulkSearch.cloneNode(true);
            bulkSearch.parentNode.replaceChild(newBulkSearch, bulkSearch);

            newBulkSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const labels = document.querySelectorAll('#userChecklist label');
                labels.forEach(lbl => {
                    const txt = lbl.textContent.toLowerCase();
                    lbl.style.display = txt.includes(term) ? 'flex' : 'none';
                });
            });
        }
    }

    // BONUS MANAGEMENT FUNCTIONS
    async loadBonusManagement() {
        try {
            const { data: bonuses, error } = await supabase
                .from('available_bonuses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.displayBonusManagement(bonuses);
        } catch (error) {
            console.error('Error loading bonuses:', error);
        }
    }

    displayBonusManagement(bonuses) {
        const bonusesTab = document.getElementById('bonusesTab');
        if (!bonusesTab) return;

        const activeCampaigns = bonuses ? bonuses.filter(b => b.is_active) : [];
        const bonusOptions = activeCampaigns.map(b => `<option value="${b.bonus_type}">${b.bonus_name} (৳${b.amount})</option>`).join('');

        bonusesTab.innerHTML = `
            <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">Bonus Management</h3>
                <button id="addNewBonus" class="action-btn primary"><i class="fas fa-plus"></i> Add New Campaign</button>
            </div>
            
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Bonus Name</th>
                            <th>Type</th>
                            <th>Pre-Bonus Amount</th>
                            <th>Max Claims</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bonusesTableBody">
                        ${bonuses && bonuses.length > 0 ? bonuses.map(bonus => `
                            <tr>
                                <td>${bonus.bonus_name}</td>
                                <td><code style="background: #222; padding: 2px 5px; border-radius: 4px;">${bonus.bonus_type}</code></td>
                                <td style="color: #ffcc00; font-weight: bold;">৳${bonus.amount}</td>
                                <td>${bonus.max_claims_per_user || 1}</td>
                                <td>
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <span style="color: ${bonus.is_active ? '#4CAF50' : '#f44336'}">
                                            ${bonus.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        ${(bonus.auto_unlock === true || String(bonus.auto_unlock) === 'true') ? '<span style="font-size: 0.75em; background: #2196F3; color: white; padding: 1px 4px; border-radius: 3px; width: fit-content;">Auto</span>' : ''}
                                    </div>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="action-btn" style="color: #2196F3; border-color: #2196F3;" onclick="adminManager.editBonus('${bonus.id}')"><i class="fas fa-edit"></i> Edit</button>
                                        <button class="action-btn" style="color: ${bonus.is_active ? '#f44336' : '#4CAF50'}; border-color: ${bonus.is_active ? '#f44336' : '#4CAF50'};" 
                                            onclick="adminManager.toggleBonus('${bonus.id}', ${!bonus.is_active})">
                                            <i class="fas fa-${bonus.is_active ? 'times-circle' : 'check-circle'}"></i> 
                                            ${bonus.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="6" style="text-align: center; padding: 20px;">No bonuses found</td></tr>`}
                    </tbody>
                </table>
            </div>

            <!-- Grant Bonus Eligibility Section -->
            <div class="card-container full-width" style="margin-top: 30px; background: #1e1e1e; padding: 25px; border-radius: 12px; border: 1px solid #333; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;"><i class="fas fa-paper-plane" style="color: #ffcc00; margin-right: 10px;"></i> Grant Bonus / Eligibility</h3>
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; background: #333; padding: 5px 15px; border-radius: 20px; font-size: 0.9em;">
                        <input type="checkbox" id="bulkModeToggle" style="margin: 0;"> 
                        <span>Bulk Mode</span>
                    </label>
                </div>

                <div class="form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    <!-- User Selection Area -->
                    <div class="form-group" id="userSelectContainer">
                        <label style="display: block; margin-bottom: 8px; color: #a0a0a0;">Select User</label>
                        <div style="position: relative;">
                            <input type="text" id="userSearchSingle" placeholder="Search user..." style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: white; border-radius: 8px 8px 0 0; font-size: 0.9em; box-sizing: border-box;">
                            <select id="bonusUserSelect" class="modern-input" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; border-top: none; color: white; border-radius: 0 0 8px 8px; box-sizing: border-box;">
                                <option value="">Loading users...</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" id="bulkUserContainer" style="display: none; grid-column: 1 / -1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="flex: 1; margin-right: 20px;">
                                <label style="display: block; margin-bottom: 5px; color: #a0a0a0;">Search & Select Users</label>
                                <input type="text" id="userSearchBulk" placeholder="Type to search users..." style="width: 100%; padding: 8px 12px; background: #333; border: 1px solid #444; color: white; border-radius: 6px; font-size: 0.9em;">
                            </div>
                            <div style="display: flex; gap: 10px; align-items: flex-end;">
                                <button type="button" id="selectAllUsers" style="background: #444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Select All</button>
                                <button type="button" id="deselectAllUsers" style="background: #444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Deselect All</button>
                            </div>
                        </div>
                        <div id="userChecklist" style="max-height: 200px; overflow-y: auto; background: #2a2a2a; border: 1px solid #444; border-radius: 8px; padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                            <!-- Checkboxes populated via JS -->
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; color: #a0a0a0;">Bonus Type</label>
                        <select id="bonusTypeDirect" class="modern-input" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; color: white; border-radius: 8px;">
                            ${bonusOptions}
                            <option value="custom">Custom Amount (Direct Balance)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="display: block; margin-bottom: 8px; color: #a0a0a0;">Amount (${window.siteCurrency || '৳'})</label>
                        <input type="number" class="modern-input" id="bonusAmountDirect" placeholder="0.00" style="width: 100%; padding: 12px; background: #2a2a2a; border: 1px solid #444; color: white; border-radius: 8px;">
                    </div>

                    <div class="form-group" style="display: flex; align-items: flex-end;">
                        <button id="addBonusBtn" class="action-btn primary" style="width: 100%; padding: 12px; background: #ffcc00; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1.1em; transition: 0.2s;">GRANT BONUS NOW</button>
                    </div>
                </div>

                <p style="margin-top: 20px; font-size: 0.85em; color: #777; line-height: 1.5;">
                    <i class="fas fa-info-circle"></i> <b>Bulk Mode</b> allows you to grant bonuses to many users at once.<br>
                    <i class="fas fa-magic"></i> <b>Tip</b>: Selecting a Bonus Type will auto-fill the amount if you've set a "Pre-Bonus Amount" above.
                </p>
            </div>
            
        `;

        // Store bonuses for auto-fill logic
        this.currentCampaigns = bonuses;

        // Add event listeners (Static ones as innerHTML clears old elements)
        const addBtn = document.getElementById('addNewBonus');
        if (addBtn) addBtn.onclick = () => this.showBonusForm();

        const grantBtn = document.getElementById('addBonusBtn');
        if (grantBtn) grantBtn.onclick = () => this.addBonus();

        // Bulk Toggle Logic
        const bulkToggle = document.getElementById('bulkModeToggle');
        bulkToggle.addEventListener('change', (e) => {
            const isBulk = e.target.checked;
            document.getElementById('userSelectContainer').style.display = isBulk ? 'none' : 'block';
            document.getElementById('bulkUserContainer').style.display = isBulk ? 'block' : 'none';
        });

        // Select All / Deselect All
        document.getElementById('selectAllUsers').addEventListener('click', () => {
            document.querySelectorAll('.bulk-user-checkbox').forEach(cb => cb.checked = true);
        });
        document.getElementById('deselectAllUsers').addEventListener('click', () => {
            document.querySelectorAll('.bulk-user-checkbox').forEach(cb => cb.checked = false);
        });

        // Auto-fill amount logic
        const typeSelect = document.getElementById('bonusTypeDirect');
        typeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            const campaign = this.currentCampaigns.find(c => c.bonus_type === type);
            if (campaign) {
                document.getElementById('bonusAmountDirect').value = campaign.amount;
            } else if (type === 'welcome' && typeof siteSettings !== 'undefined') {
                document.getElementById('bonusAmountDirect').value = siteSettings.welcome_bonus || '';
            }
        });

        // Load users to populate both
        this.loadUsersForBonus();
    }

    showBonusForm(bonus = null) {
        const modal = document.getElementById('bonusFormModal');
        const form = document.getElementById('bonusForm');

        if (bonus) {
            document.getElementById('bonusFormTitle').textContent = 'Edit Bonus';
            document.getElementById('bonusId').value = bonus.id;
            document.getElementById('bonusName').value = bonus.bonus_name;
            document.getElementById('bonusType').value = bonus.bonus_type;
            document.getElementById('bonusAmount').value = bonus.amount;
            document.getElementById('bonusDescription').value = bonus.description || '';
            document.getElementById('bonusMaxClaims').value = bonus.max_claims_per_user || 1;
            document.getElementById('bonusAutoUnlock').checked = (bonus.auto_unlock === true || String(bonus.auto_unlock) === 'true');
            document.getElementById('bonusIsActive').checked = (bonus.is_active === true || String(bonus.is_active) === 'true');
        } else {
            document.getElementById('bonusFormTitle').textContent = 'Add New Bonus';
            form.reset();
            document.getElementById('bonusId').value = ''; // Explicitly clear to prevent overwrites
            document.getElementById('bonusMaxClaims').value = 1;
            document.getElementById('bonusAutoUnlock').checked = false;
            document.getElementById('bonusIsActive').checked = true;
        }

        modal.style.display = 'flex';
    }

    async saveBonus(e) {
        e.preventDefault();

        try {
            const formData = {
                bonus_name: document.getElementById('bonusName').value,
                bonus_type: document.getElementById('bonusType').value,
                amount: parseFloat(document.getElementById('bonusAmount').value),
                description: document.getElementById('bonusDescription').value,
                max_claims_per_user: parseInt(document.getElementById('bonusMaxClaims').value) || 1,
                auto_unlock: !!document.getElementById('bonusAutoUnlock').checked,
                is_active: !!document.getElementById('bonusIsActive').checked,
                updated_at: new Date().toISOString()
            };

            const bonusId = document.getElementById('bonusId').value;
            let error;

            if (bonusId) {
                // Update existing bonus
                ({ error } = await supabase
                    .from('available_bonuses')
                    .update(formData)
                    .eq('id', bonusId));
            } else {
                // Insert new bonus
                ({ error } = await supabase
                    .from('available_bonuses')
                    .insert([formData]));
            }

            if (error) throw error;

            alert('Bonus saved successfully!');
            document.getElementById('bonusFormModal').style.display = 'none';
            this.loadBonusManagement();

        } catch (error) {
            console.error('Error saving bonus:', error);
            alert('Failed to save bonus: ' + error.message);
        }
    }

    async editBonus(bonusId) {
        try {
            const { data: bonus, error } = await supabase
                .from('available_bonuses')
                .select('*')
                .eq('id', bonusId)
                .single();

            if (error) throw error;

            this.showBonusForm(bonus);

        } catch (error) {
            console.error('Error loading bonus:', error);
            alert('Failed to load bonus: ' + error.message);
        }
    }

    async toggleBonus(bonusId, isActive) {
        try {
            const { error } = await supabase
                .from('available_bonuses')
                .update({ is_active: isActive })
                .eq('id', bonusId);

            if (error) throw error;

            alert(`Bonus ${isActive ? 'enabled' : 'disabled'} successfully!`);
            this.loadBonusManagement();

        } catch (error) {
            console.error('Error toggling bonus:', error);
            alert('Failed to update bonus: ' + error.message);
        }
    }

    async deleteBonus(bonusId) {
        if (!confirm('Are you sure you want to delete this bonus? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('available_bonuses')
                .delete()
                .eq('id', bonusId);

            if (error) throw error;

            alert('Bonus deleted successfully!');
            this.loadBonusManagement();

        } catch (error) {
            console.error('Error deleting bonus:', error);
            alert('Failed to delete bonus: ' + error.message);
        }
    }

    // ADD NEW USER
    addUser() {
        const modalHTML = `
            <div id="addUserModal" class="modal-overlay">
                <div class="modal-card">
                    <div class="modal-header">
                        <h3 style="color: var(--accent-color);">Add New User</h3>
                        <button class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form class="user-form" id="addUserForm">
                            <div class="form-group">
                                <label class="form-label">Username</label>
                                <input type="text" class="modern-input" id="newUsername" placeholder="Enter username" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Password</label>
                                <input type="text" class="modern-input" id="newPassword" placeholder="Enter password" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Mobile</label>
                                <input type="text" class="modern-input" id="newMobile" placeholder="Enter mobile number" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">WhatsApp (Optional)</label>
                                <input type="text" class="modern-input" id="newEmail" placeholder="Enter WhatsApp number">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Initial Balance (${window.siteCurrency || '৳'})</label>
                                <input type="number" class="modern-input" id="newBalance" value="0" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">User Role</label>
                                <select class="modern-input" id="newUserRole">
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">VIP Level</label>
                                <select class="modern-input" id="newVipLevel">
                                    <option value="Bronze">Bronze</option>
                                    <option value="Silver">Silver</option>
                                    <option value="Gold">Gold</option>
                                    <option value="Platinum">Platinum</option>
                                    <option value="Diamond">Diamond</option>
                                </select>
                            </div>
                            <button type="submit" class="action-btn primary full-width">
                                <i class="fas fa-plus-circle"></i> Create User
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('addUserModal');
        modal.style.display = 'flex';

        document.getElementById('addUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveNewUser();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async saveNewUser() {
        try {
            const username = document.getElementById('newUsername').value.trim();
            const password = document.getElementById('newPassword').value;
            const mobile = document.getElementById('newMobile').value.trim();
            const email = document.getElementById('newEmail').value.trim();
            const balance = parseFloat(document.getElementById('newBalance').value || 0);
            const role = document.getElementById('newUserRole').value;
            const vip_level = document.getElementById('newVipLevel').value;

            // Simple validation
            if (!username || !password || !mobile) {
                alert('Please fill in all required fields');
                return;
            }

            const btn = document.querySelector('#addUserForm .submit-btn');
            btn.disabled = true;
            btn.textContent = 'Creating...';

            const userData = {
                username,
                password,
                mobile,
                email: email || null,
                balance,
                vip_level,
                is_admin: role === 'admin' || role === 'super_admin',
                role: role,
                member_since: new Date().toISOString(),
                referral_code: 'R' + Math.random().toString(36).substr(2, 3).toUpperCase(),
                loyalty_points: 100
            };

            const { error } = await supabase
                .from('profiles')
                .insert([userData]);

            if (error) throw error;

            alert('User created successfully!');
            document.getElementById('addUserModal').remove();
            this.loadUsers();

        } catch (error) {
            console.error('Error creating user:', error);
            alert('Failed to create user: ' + error.message);
        } finally {
            const btn = document.querySelector('#addUserForm .submit-btn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Create User';
            }
        }
    }

    // EXISTING USER MANAGEMENT FUNCTIONS
    async editUser(userId) {
        console.log('Opening edit modal for user:', userId);
        try {
            const { data: user, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                alert('Error loading user: ' + error.message);
                return;
            }

            const modalHTML = `
                <div id="editUserModal" class="modal-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <h3 style="color: var(--accent-color);">Edit User: ${user.username}</h3>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="editUserForm">
                                <div class="form-group">
                                    <label class="form-label">Username</label>
                                    <input type="text" class="modern-input" id="editUsername" value="${user.username}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Password</label>
                                    <input type="text" class="modern-input" id="editPassword" value="${user.password || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">WhatsApp</label>
                                    <input type="text" class="modern-input" id="editEmail" value="${user.email || ''}" placeholder="WhatsApp Number">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Mobile</label>
                                    <input type="text" class="modern-input" id="editMobile" value="${user.mobile || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Balance</label>
                                    <input type="number" class="modern-input" id="editBalance" value="${user.balance || 0}" step="0.01" min="0" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">VIP Level</label>
                                    <select class="modern-input" id="editVipLevel">
                                        <option value="Bronze" ${user.vip_level === 'Bronze' ? 'selected' : ''}>Bronze</option>
                                        <option value="Silver" ${user.vip_level === 'Silver' ? 'selected' : ''}>Silver</option>
                                        <option value="Gold" ${user.vip_level === 'Gold' ? 'selected' : ''}>Gold</option>
                                        <option value="Platinum" ${user.vip_level === 'Platinum' ? 'selected' : ''}>Platinum</option>
                                        <option value="Diamond" ${user.vip_level === 'Diamond' ? 'selected' : ''}>Diamond</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Loyalty Points</label>
                                    <input type="number" class="modern-input" id="editLoyaltyPoints" value="${user.loyalty_points || 0}" min="0" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">User Role</label>
                                    <select class="modern-input" id="editUserRole">
                                        <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                        <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                                    </select>
                                </div>
                                <button type="submit" class="action-btn primary full-width">
                                    <i class="fas fa-save"></i> Update User
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const modal = document.getElementById('editUserModal');
            modal.style.display = 'flex';

            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.remove();
            });

            document.getElementById('editUserForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateUser(userId);
            });

            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

        } catch (error) {
            console.error('Error loading user for edit:', error);
            alert('Failed to load user: ' + error.message);
        }
    }

    async updateUser(userId) {
        try {
            const role = document.getElementById('editUserRole').value;
            const formData = {
                username: document.getElementById('editUsername').value,
                password: document.getElementById('editPassword').value,
                email: document.getElementById('editEmail').value,
                mobile: document.getElementById('editMobile').value,
                balance: parseFloat(document.getElementById('editBalance').value),
                vip_level: document.getElementById('editVipLevel').value,
                loyalty_points: parseInt(document.getElementById('editLoyaltyPoints').value),
                is_admin: role === 'admin' || role === 'super_admin',
                role: role
            };

            const { error } = await supabase
                .from('profiles')
                .update(formData)
                .eq('id', userId);

            if (error) throw error;

            alert('User updated successfully!');
            document.getElementById('editUserModal').remove();
            this.loadUsers();

            // If current user updated their own profile, refresh
            if (simpleAuth.currentUser && simpleAuth.currentUser.id === userId) {
                simpleAuth.currentUser = { ...simpleAuth.currentUser, ...formData };
                localStorage.setItem('casino_user', JSON.stringify(simpleAuth.currentUser));
                simpleAuth.updateAllUserSections();
                // Re-apply admin panel restrictions immediately
                this.applyRoleRestrictions();
            }

        } catch (error) {
            console.error('Error updating user:', error);
            alert('Failed to update user: ' + error.message);
        }
    }



    async addBonus() {
        const isBulk = document.getElementById('bulkModeToggle').checked;
        let selectedUserIds = [];

        if (isBulk) {
            const checkboxes = document.querySelectorAll('.bulk-user-checkbox:checked');
            selectedUserIds = Array.from(checkboxes).map(cb => cb.value);
        } else {
            const userId = document.getElementById('bonusUserSelect').value;
            if (userId) selectedUserIds = [userId];
        }

        if (selectedUserIds.length === 0) {
            alert('Please select at least one user');
            return;
        }

        const amount = parseFloat(document.getElementById('bonusAmountDirect').value || 0);
        const bonusType = document.getElementById('bonusTypeDirect').value;

        if (!amount || amount <= 0) {
            alert('Please enter a valid bonus amount');
            return;
        }

        try {
            const btn = document.getElementById('addBonusBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;

            if (bonusType === 'custom') {
                // Bulk Direct Balance Addition
                for (const userId of selectedUserIds) {
                    const { data: user, error: userError } = await supabase
                        .from('profiles')
                        .select('balance, username')
                        .eq('id', userId)
                        .single();

                    if (!userError) {
                        const newBalance = (user.balance || 0) + amount;
                        await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId);

                        await supabase.from('transactions').insert([{
                            user_id: userId,
                            type: 'bonus',
                            amount: amount,
                            description: `Admin Bulk Bonus`,
                            status: 'completed'
                        }]);
                    }
                }
                alert(`Successfully added ${window.siteCurrency || '৳'}${amount} to ${selectedUserIds.length} users!`);
            } else {
                // Bulk Eligibility Grant (NOW ALLOWS INFINITE REGRANTS)
                const eligibilityRecords = selectedUserIds.map(userId => ({
                    user_id: userId,
                    bonus_type: bonusType,
                    amount: amount,
                    is_available: true,
                    created_at: new Date().toISOString()
                }));

                // Instead of upsert which overwrites, we just INSERT. 
                // Each grant creates a new "row" so if a user has 10 grants, they can claim 10 times.
                const { error: eligError } = await supabase
                    .from('user_bonus_eligibility')
                    .insert(eligibilityRecords);

                if (eligError) throw eligError;
                alert(`Success! ${selectedUserIds.length} users are now eligible for the ${window.siteCurrency || '৳'}${amount} ${bonusType} bonus. If they claimed it before, they can now claim it again!`);
            }

            // Cleanup
            document.getElementById('bonusAmountDirect').value = '';
            document.querySelectorAll('.bulk-user-checkbox').forEach(cb => cb.checked = false);
            btn.textContent = originalText;
            btn.disabled = false;

            // Refresh data
            this.loadUsers();
            this.loadUsersForBonus();

        } catch (error) {
            console.error('Error in addBonus:', error);
            alert('Failed: ' + error.message);
            const btn = document.getElementById('addBonusBtn');
            btn.textContent = 'GRANT BONUS NOW';
            btn.disabled = false;
        }
    }

    // --- GAME MANAGEMENT ---

    async loadGames() {
        const tbody = document.getElementById('gamesTableBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

        try {
            // Try Supabase
            let { data: games, error } = await supabase.from('games').select('*').order('created_at', { ascending: false });

            if (error) throw error;

            if (!games || games.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No games found</td></tr>';
                return;
            }

            tbody.innerHTML = games.map(game => `
                <tr>
                    <td><img src="${game.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;"></td>
                    <td>${game.name}</td>
                    <td>${game.category}</td>
                    <td><span style="font-size: 12px; padding: 2px 6px; background: #333; border-radius: 4px;">${game.vip_level_required || 'None'}</span></td>
                    <td><span style="color: ${game.is_active ? '#4CAF50' : '#f44336'}">${game.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="edit-btn" onclick="adminManager.showGameForm('${game.id}')"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" onclick="adminManager.deleteGame('${game.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');

        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading games: ' + e.message + '</td></tr>';
        }
    }

    async showGameForm(gameId = null) {
        const modal = document.getElementById('gameFormModal');
        const form = document.getElementById('gameForm');
        document.getElementById('gameFormTitle').textContent = gameId ? 'Edit Game' : 'Add Game';
        form.reset();

        // Clear file input manually
        const fileInput = document.getElementById('gameImageFile');
        if (fileInput) fileInput.value = '';

        if (gameId) {
            // Load game data
            const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();

            if (game) {
                document.getElementById('gameId').value = game.id;
                document.getElementById('gameName').value = game.name;
                document.getElementById('gameCategory').value = game.category;
                document.getElementById('gameImage').value = game.image_url;
                document.getElementById('gamePlayUrl').value = game.play_url || '';
                // document.getElementById('gameVipLevel').value = game.vip_level_required || 'Bronze'; // Removed by user request
                document.getElementById('gameIsActive').checked = game.is_active;
            }
        } else {
            document.getElementById('gameId').value = '';
        }

        modal.style.display = 'flex';
    }

    async saveGame(e) {
        e.preventDefault();
        const id = document.getElementById('gameId').value;
        const gameData = {
            name: document.getElementById('gameName').value,
            category: document.getElementById('gameCategory').value,
            image_url: document.getElementById('gameImage').value,
            play_url: document.getElementById('gamePlayUrl').value,
            play_url: document.getElementById('gamePlayUrl').value,
            // vip_level_required: document.getElementById('gameVipLevel').value, // Removed
            vip_level_required: 'Bronze', // Defaulting since column still exists in DB but not used
            is_active: document.getElementById('gameIsActive').checked,
            // If new, add created_at
            ...(id ? {} : { created_at: new Date().toISOString() })
        };

        try {
            // Supabase upsert
            const { error } = id
                ? await supabase.from('games').update(gameData).eq('id', id)
                : await supabase.from('games').insert([gameData]);

            if (error) throw error;

            alert('Game saved!');
            document.getElementById('gameFormModal').style.display = 'none';
            this.loadGames();
        } catch (e) {
            console.error('Save failed', e);
            alert('Failed to save game: ' + e.message);
        }
    }

    async deleteGame(gameId) {
        if (!confirm('Delete this game?')) return;

        try {
            const { error } = await supabase.from('games').delete().eq('id', gameId);
            if (error) throw error;
            this.loadGames();
        } catch (e) {
            console.error('DB Delete failed', e);
            alert('Failed to delete game');
        }
    }

    showCategoryForm() {
        document.getElementById('categoryFormModal').style.display = 'flex';
    }

    async saveCategory(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value;
        // Just mock this for now since we don't have a categories table structure defined by user
        alert(`Category "${name}" added! (Mock)`);
        document.getElementById('categoryFormModal').style.display = 'none';
    }

    // --- CAROUSEL ---
    // --- CAROUSEL ---
    async loadCarousel() {
        const tbody = document.getElementById('carouselTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';

        try {
            const { data: items, error } = await supabase.from('carousel_items').select('*').order('created_at', { ascending: false });

            if (error) throw error;

            tbody.innerHTML = '';
            if (!items || items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2">No carousel items</td></tr>';
                return;
            }

            items.forEach((item) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <img src="${item.image_url}" style="height: 50px; border-radius: 4px;">
                        ${item.link_url ? '<br><small><a href="' + item.link_url + '" target="_blank">Link</a></small>' : ''}
                    </td>
                    <td><button class="delete-btn" onclick="adminManager.deleteCarouselItem('${item.id}')"><i class="fas fa-trash"></i></button></td>
                `;
                tbody.appendChild(row);
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="2">Error loading carousel</td></tr>';
        }
    }

    showCarouselForm() {
        document.getElementById('carouselFormModal').style.display = 'flex';
        document.getElementById('carouselForm').reset();
    }

    async saveCarouselItem(e) {
        e.preventDefault();
        const imageUrl = document.getElementById('carouselImageUrl').value;
        const linkUrl = document.getElementById('carouselLinkUrl').value;

        try {
            const { error } = await supabase.from('carousel_items').insert([{
                image_url: imageUrl,
                link_url: linkUrl
            }]);

            if (error) throw error;

            alert('Carousel item added!');
            document.getElementById('carouselFormModal').style.display = 'none';
            this.loadCarousel();
        } catch (e) {
            console.error(e);
            alert('Failed: ' + e.message);
        }
    }

    async deleteCarouselItem(id) {
        if (!confirm('Delete this item?')) return;
        try {
            const { error } = await supabase.from('carousel_items').delete().eq('id', id);
            if (error) throw error;
            this.loadCarousel();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    // --- EXPORT TOOLS ---
    exportToExcel(data, filename) {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    exportUsersToExcel() {
        if (!this.currentUsers) return;
        const stats = this.currentUserStats || {};
        const exportData = this.currentUsers.map(u => {
            const s = stats[u.id] || { totalDep: 0, totalWith: 0, totalBonus: 0, lastDep: null, lastWith: null };
            return {
                'ID': u.id,
                'Username': u.username,
                'Mobile': u.mobile,
                'WhatsApp': u.email,
                'Role': u.role || 'member',
                'VIP Level': u.vip_level,
                'Status': u.status || 'active',
                'Current Balance': u.balance || 0,
                'Pending Bonus': u.pending_bonus || 0,
                'Loyalty Points': u.loyalty_points || 0,
                'Referral Code': u.referral_code || 'N/A',
                'Total Referrals': u.friends_referred || 0,
                'Total Deposits': s.totalDep,
                'Total Withdrawals': s.totalWith,
                'Total Bonus': s.totalBonus,
                'Last Deposit': s.lastDep ? s.lastDep.toISOString() : 'Never',
                'Last Withdrawal': s.lastWith ? s.lastWith.toISOString() : 'Never',
                'Joined Date': u.member_since || u.created_at
            };
        });
        this.exportToExcel(exportData, 'Users_Detailed_Report');
    }

    exportTransactionsToExcel() {
        if (!this.currentTransactions) return;
        const exportData = this.currentTransactions.map(tx => ({
            'TX ID': tx.id,
            'User': tx.profiles?.username || tx.profiles?.email || 'N/A',
            'Type': tx.type,
            'Amount': tx.amount,
            'Status': tx.status,
            'Description': tx.description,
            'Date': tx.created_at
        }));
        this.exportToExcel(exportData, 'Transactions_Report');
    }

    exportPaymentsToExcel() {
        if (!this.currentPayments) return;
        const exportData = this.currentPayments.map(p => ({
            'TX ID': p.id,
            'User': p.profiles?.username || p.profiles?.email || 'N/A',
            'Type': p.type,
            'Amount': p.amount,
            'Status': p.status,
            'Method Details': p.description,
            'Date': p.created_at
        }));
        this.exportToExcel(exportData, 'Payment_Requests_Report');
    }

    exportMembersToExcel() {
        if (!this.currentMembers) return;
        const stats = this.currentMemberStats || {};
        const exportData = this.currentMembers.map(u => {
            const s = stats[u.id] || { totalDep: 0, totalWith: 0, totalBonus: 0, lastDep: null, lastWith: null };
            return {
                'ID': u.id,
                'Username': u.username,
                'Mobile': u.mobile,
                'WhatsApp': u.email,
                'Role': u.role || 'member',
                'VIP Level': u.vip_level,
                'Status': u.status || 'active',
                'Current Balance': u.balance || 0,
                'Pending Bonus': u.pending_bonus || 0,
                'Loyalty Points': u.loyalty_points || 0,
                'Referral Code': u.referral_code || 'N/A',
                'Total Referrals': u.friends_referred || 0,
                'Total Deposits': s.totalDep,
                'Total Withdrawals': s.totalWith,
                'Total Bonus': s.totalBonus,
                'Last Deposit': s.lastDep ? s.lastDep.toISOString() : 'Never',
                'Last Withdrawal': s.lastWith ? s.lastWith.toISOString() : 'Never',
                'Joined Date': u.member_since || u.created_at
            };
        });
        this.exportToExcel(exportData, 'Members_Detailed_Report');
    }
    // --- MEMBER MANAGEMENT ---
    async loadMembers(search = null) {
        try {
            const dateFilter = document.getElementById('memberDateFilter')?.value || 'all';
            const { start, end } = this.getDateRange(dateFilter, 'memberStartDate', 'memberEndDate');
            const searchTerm = search || document.getElementById('memberSearch')?.value;
            const vipFilter = document.getElementById('memberVipFilter')?.value || 'all';

            let query = supabase.from('profiles').select('*');

            if (searchTerm) {
                query = query.or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`);
            }
            if (start) query = query.gte('created_at', start.toISOString());
            if (end) query = query.lte('created_at', end.toISOString());
            if (vipFilter !== 'all') query = query.eq('vip_level', vipFilter);

            const sortVal = document.getElementById('memberSort')?.value || 'created_desc';
            if (sortVal === 'created_desc') query = query.order('created_at', { ascending: false });
            else if (sortVal === 'created_asc') query = query.order('created_at', { ascending: true });
            else if (sortVal === 'balance_desc') query = query.order('balance', { ascending: false });
            else if (sortVal === 'balance_asc') query = query.order('balance', { ascending: true });
            else query = query.order('created_at', { ascending: false });

            const { data: users, error } = await query;

            if (error) throw error;

            // Fetch Additional Stats
            const userIds = users.map(u => u.id);
            const stats = await this.getUserStats(userIds);
            this.currentMemberStats = stats;

            // Post-Fetch Sorting
            if (sortVal === 'deposit_desc') {
                users.sort((a, b) => (stats[b.id]?.totalDep || 0) - (stats[a.id]?.totalDep || 0));
            } else if (sortVal === 'withdraw_desc') {
                users.sort((a, b) => (stats[b.id]?.totalWith || 0) - (stats[a.id]?.totalWith || 0));
            } else if (sortVal === 'bonus_desc') {
                users.sort((a, b) => (stats[b.id]?.totalBonus || 0) - (stats[a.id]?.totalBonus || 0));
            }

            this.currentMembers = users;
            const tbody = document.getElementById('membersTableBody');
            tbody.innerHTML = '';

            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No members found</td></tr>';
                return;
            }

            users.forEach(user => {
                const s = stats[user.id] || { totalDep: 0, totalWith: 0, totalBonus: 0, lastDep: null, lastWith: null };
                const isSuspended = user.status === 'suspended';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: bold;">${user.username || 'No Name'}</div>
                        <div style="font-size: 0.8em; color: #888;">ID: ${user.id ? user.id.substring(0, 8) : 'N/A'}</div>
                    </td>
                    <td>
                        <div>${user.mobile || 'N/A'}</div>
                        <div style="font-size: 0.8em; color: #888;">${user.email || 'No WhatsApp'}</div>
                    </td>
                    <td>
                        <div style="color: #4CAF50; font-weight: bold;">Bal: ${window.siteCurrency || '৳'}${user.balance?.toFixed(2) || '0.00'}</div>
                        <div style="font-size: 0.8em; color: #aaa;">Dep: ${window.siteCurrency || '৳'}${s.totalDep.toFixed(2)}</div>
                        <div style="font-size: 0.8em; color: #f44336;">With: ${window.siteCurrency || '৳'}${s.totalWith.toFixed(2)}</div>
                        <div style="font-size: 0.8em; color: #2196F3;">Bonus: ${window.siteCurrency || '৳'}${s.totalBonus.toFixed(2)}</div>
                    </td>
                    <td>
                        <div style="font-size: 0.85em;">Dep: ${s.lastDep ? this.formatDateTime(s.lastDep) : 'Never'}</div>
                        <div style="font-size: 0.85em;">With: ${s.lastWith ? this.formatDateTime(s.lastWith) : 'Never'}</div>
                        <div style="font-size: 0.85em; color: #888;">Join: ${this.formatDateTime(user.created_at)}</div>
                    </td>
                    <td>
                        <div class="badge" style="background: #333; padding: 4px 8px; border-radius: 4px; display:inline-block; margin-bottom: 5px;">${user.vip_level || 'Bronze'}</div>
                        <div style="font-size: 0.85em; color: var(--accent-color);">Refs: ${user.friends_referred || 0}</div>
                    </td>
                    <td>
                        <span class="status-badge" style="background: ${isSuspended ? '#f44336' : '#4CAF50'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em;">
                            ${isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="adminManager.openEditVIP('${user.id}', '${user.vip_level || 'Bronze'}')" class="action-btn" style="background:#2196F3; padding:5px 10px; font-size:12px; color: white;">Edit VIP</button>
                            <button onclick="adminManager.openGrantBonus('${user.id}')" class="action-btn" style="background:#ff9800; padding:5px 10px; font-size:12px; color: white;">Bonus</button>
                            <button class="action-btn" onclick="adminManager.toggleUserStatus('${user.id}', '${user.status || 'active'}')" 
                                style="background: ${isSuspended ? '#4CAF50' : '#ff9800'}; color: white; padding: 5px 8px; font-size: 10px;" title="${isSuspended ? 'Re-open' : 'Suspend'}">
                                <i class="fas ${isSuspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading members:', err);
        }
    }


    // --- MEMBER ACTIONS ---
    openEditVIP(userId, currentVIP) {
        document.getElementById('editVIPUserId').value = userId;
        document.getElementById('editVIPLevel').value = currentVIP;
        document.getElementById('editVIPModal').style.display = 'flex';
    }

    async saveVIP(e) {
        e.preventDefault();
        const userId = document.getElementById('editVIPUserId').value;
        const newLevel = document.getElementById('editVIPLevel').value;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ vip_level: newLevel })
                .eq('id', userId);

            if (error) throw error;

            document.getElementById('editVIPModal').style.display = 'none';
            alert('VIP Level updated successfully!');
            this.loadMembers();
        } catch (err) {
            alert('Error updating VIP: ' + err.message);
        }
    }

    async openGrantBonus(userId) {
        document.getElementById('grantBonusUserId').value = userId;
        document.getElementById('grantBonusDesc').value = '';
        document.getElementById('grantBonusManualAmount').value = '';
        const select = document.getElementById('grantBonusSelect');
        select.innerHTML = '<option value="">Loading bonuses...</option>';
        document.getElementById('grantBonusModal').style.display = 'flex';

        try {
            const { data: bonuses, error } = await supabase
                .from('available_bonuses')
                .select('*')
                .eq('is_active', true)
                .order('bonus_name');

            if (error) throw error;
            this.availableBonusCampaigns = bonuses;

            select.innerHTML = '<option value="">Select a bonus...</option>';
            bonuses.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.bonus_name} (${window.siteCurrency || '৳'}${b.amount})`;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading bonuses:', err);
            select.innerHTML = '<option value="">Error loading</option>';
        }
    }

    async saveGrantBonus(e) {
        e.preventDefault();
        const userId = document.getElementById('grantBonusUserId').value;
        const bonusId = document.getElementById('grantBonusSelect').value;
        const manualAmount = parseFloat(document.getElementById('grantBonusManualAmount').value);
        const desc = document.getElementById('grantBonusDesc').value;

        if (!bonusId && isNaN(manualAmount)) {
            alert('Please select a bonus campaign OR enter a manual amount');
            return;
        }

        try {
            // Priority: Manual Amount (Direct Balance Update)
            if (!isNaN(manualAmount) && manualAmount > 0) {
                // 1. Get current balance
                const { data: user, error: userError } = await supabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', userId)
                    .single();

                if (userError) throw userError;

                // 2. Update balance
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ balance: (user.balance || 0) + manualAmount })
                    .eq('id', userId);

                if (updateError) throw updateError;

                // 3. Record transaction
                await supabase.from('transactions').insert({
                    user_id: userId,
                    type: 'bonus',
                    amount: manualAmount,
                    description: `Manual Bonus Granted: ${desc || 'No note'}`,
                    status: 'completed'
                });

                alert(`Successfully added ${window.siteCurrency || '৳'}${manualAmount} to user balance!`);
            }
            // Secondary: Campaign Eligibility (Standard Flow)
            else if (bonusId) {
                const bonus = (this.availableBonusCampaigns || []).find(b => b.id === bonusId);
                if (!bonus) return;

                // Grant eligibility based on existing campaign
                const { error: eligError } = await supabase
                    .from('user_bonus_eligibility')
                    .insert({
                        user_id: userId,
                        bonus_type: bonus.bonus_type,
                        amount: bonus.amount,
                        is_available: true
                    });

                if (eligError) throw eligError;

                // Log activity in transactions for audit trail
                await supabase.from('transactions').insert({
                    user_id: userId,
                    type: 'bonus',
                    amount: bonus.amount,
                    description: `Admin Granted Eligibility: ${bonus.bonus_name}. Note: ${desc}`,
                    status: 'pending'
                });

                alert(`Member is now eligible for "${bonus.bonus_name}"!`);
            }

            document.getElementById('grantBonusModal').style.display = 'none';
            this.loadMembers();

        } catch (err) {
            console.error('Error granting bonus:', err);
            alert('Error: ' + err.message);
        }
    }
    async getUserStats(userIds) {
        if (!userIds || userIds.length === 0) return {};

        try {
            const { data: txs, error } = await supabase
                .from('transactions')
                .select('user_id, type, amount, status, created_at')
                .in('user_id', userIds)
                .eq('status', 'completed');

            if (error) throw error;

            const stats = {};
            userIds.forEach(id => {
                stats[id] = { totalDep: 0, totalWith: 0, totalBonus: 0, lastDep: null, lastWith: null };
            });

            txs.forEach(tx => {
                const s = stats[tx.user_id];
                if (!s) return;

                const date = new Date(tx.created_at);
                if (tx.type === 'deposit') {
                    s.totalDep += tx.amount;
                    if (!s.lastDep || date > s.lastDep) s.lastDep = date;
                } else if (tx.type === 'withdraw') {
                    s.totalWith += tx.amount;
                    if (!s.lastWith || date > s.lastWith) s.lastWith = date;
                } else if (tx.type === 'bonus') {
                    s.totalBonus += tx.amount;
                }
            });
            return stats;
        } catch (err) {
            console.error('Error fetching stats:', err);
            return {};
        }
    }

    async toggleUserStatus(userId, currentStatus) {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        const action = newStatus === 'suspended' ? 'SUSPEND' : 'RE-OPEN';

        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;

            alert(`User has been ${newStatus} successfully.`);

            // Reload both if possible, or just the current one
            if (this.currentTab === 'usersTab') this.loadUsers();
            if (this.currentTab === 'membersTab') this.loadMembers();
        } catch (err) {
            alert('Error updating user status: ' + err.message);
        }
    }

    async loadGameHistory(username = null) {
        try {
            const searchTerm = username || document.getElementById('historySearch')?.value;
            const tbody = document.getElementById('historyTableBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading history...</td></tr>';

            if (!searchTerm) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Please enter a username to search</td></tr>';
                return;
            }

            // 1. Find user by username
            const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('id, username, balance')
                .ilike('username', searchTerm)
                .single();

            if (userError || !user) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">User not found</td></tr>';
                return;
            }

            // 2. Load game transactions (bets and wins)
            const { data: history, error: historyError } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(200);

            if (historyError) throw historyError;


            this.currentHistoryUser = user; // Store context
            tbody.innerHTML = '';

            if (!history || history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No history found for this user</td></tr>';
                return;
            }

            // Calculate historical balances dynamically if missing
            let runningBalance = user.balance || 0;
            const historyWithBalances = history.map(tx => {
                const balAfter = tx.balance_after !== undefined && tx.balance_after !== null
                    ? tx.balance_after
                    : runningBalance;

                // Update running balance for the NEXT (older) transaction
                // Only account for transactions that actually changed the balance
                const isCompleted = tx.status === 'completed';
                const isWithdraw = tx.type === 'withdraw' || tx.type === 'game_bet';

                if (isCompleted || isWithdraw) {
                    const desc = (tx.description || '').toLowerCase();
                    const amount = tx.amount || 0;
                    const isDeduction = desc.includes('bet') || desc.includes('loss') || tx.type === 'withdraw' || tx.type === 'game_bet';

                    if (isDeduction) {
                        runningBalance += amount;
                    } else {
                        runningBalance -= amount;
                    }
                }

                return { ...tx, displayBalanceAfter: balAfter };
            });

            this.currentHistory = historyWithBalances; // Store for export

            historyWithBalances.forEach(tx => {
                const row = document.createElement('tr');
                const desc = tx.description || 'Game Activity';
                const isLoss = desc.toLowerCase().includes('bet') || desc.toLowerCase().includes('loss') || tx.type === 'withdraw' || tx.type === 'game_bet';
                const amountColor = isLoss ? '#ff5252' : '#4CAF50';

                row.innerHTML = `
                    <td>${this.formatDateTime(tx.created_at)}</td>
                    <td>${desc}</td>
                    <td style="color: ${amountColor}; font-weight: bold;">
                        ${isLoss ? '-' : '+'}${window.siteCurrency || '৳'}${tx.amount?.toFixed(2) || '0.00'}
                    </td>
                    <td><span style="text-transform: capitalize;">${tx.type || 'N/A'}</span></td>
                    <td style="font-weight: 500; color: #eee;">${window.siteCurrency || '৳'}${tx.displayBalanceAfter.toFixed(2)}</td>
                `;
                tbody.appendChild(row);
            });

        } catch (error) {
            console.error('Error loading history:', error);
            // Non-critical alert
        }
    }

    exportHistoryToExcel() {
        if (!this.currentHistory || !this.currentHistoryUser) {
            alert("No history loaded to export. Please search for a user first.");
            return;
        }
        const exportData = this.currentHistory.map(tx => {
            const desc = tx.description || 'Game Activity';
            const isLoss = desc.toLowerCase().includes('bet') || desc.toLowerCase().includes('loss') || tx.type === 'withdraw';
            return {
                'Time': this.formatDateTime(tx.created_at),
                'Action / Game': desc,
                'Amount': (isLoss ? '-' : '+') + (tx.amount?.toFixed(2) || '0.00'),
                'Type': tx.type || 'N/A',
                'Balance After': tx.displayBalanceAfter?.toFixed(2) || 'N/A'
            };
        });
        const filename = `History_${this.currentHistoryUser.username}`;
        this.exportToExcel(exportData, filename);
    }
}

// Initialize admin manager
window.adminManager = new AdminManager();
