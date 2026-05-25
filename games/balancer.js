/**
 * Game Balance Bridge - PostMessage Based
 * Works across origins (GitHub Pages iframe -> main site)
 * Uses postMessage for secure cross-origin communication.
 */

const GameBridge = {

    _pendingRequests: {},
    _requestId: 0,
    _initialized: false,

    init: function () {
        if (this._initialized) return;
        this._initialized = true;

        // Listen for responses from parent
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || data.source !== 'game-parent') return;

            if (data.type === 'balance-response' && data.requestId) {
                const resolve = this._pendingRequests[data.requestId];
                if (resolve) {
                    resolve(data.balance);
                    delete this._pendingRequests[data.requestId];
                }
            }

            if (data.type === 'update-response' && data.requestId) {
                const resolve = this._pendingRequests[data.requestId];
                if (resolve) {
                    resolve(data.result);
                    delete this._pendingRequests[data.requestId];
                }
            }
        });
    },

    // Send a message to parent and wait for response
    _sendAndWait: function (message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const requestId = ++this._requestId;
            message.requestId = requestId;
            message.source = 'game-iframe';

            this._pendingRequests[requestId] = resolve;

            // Timeout fallback
            setTimeout(() => {
                if (this._pendingRequests[requestId]) {
                    delete this._pendingRequests[requestId];
                    reject(new Error('[GameBridge] Parent did not respond in time'));
                }
            }, timeout);

            window.parent.postMessage(message, '*');
        });
    },

    // Try direct access first (same-origin), fall back to postMessage
    getAuth: function () {
        try {
            if (window.parent && window.parent !== window && window.parent.simpleAuth) {
                return window.parent.simpleAuth;
            }
        } catch (e) {
            // Cross-origin - expected, will use postMessage
        }
        return null;
    },

    getSupabase: function () {
        try {
            if (window.parent && window.parent !== window && window.parent.supabase) {
                return window.parent.supabase;
            }
        } catch (e) { }
        return null;
    },

    // Get balance - tries direct access, then postMessage
    getBalance: function () {
        // Try direct access (same-origin)
        const auth = this.getAuth();
        if (auth && auth.currentUser) {
            return parseFloat(auth.currentUser.balance) || 0;
        }

        // Fallback: localStorage (only works same-origin)
        try {
            const savedUser = localStorage.getItem('casino_user');
            if (savedUser) return parseFloat(JSON.parse(savedUser).balance) || 0;
        } catch (e) { }

        return 0;
    },

    // Async version that uses postMessage for cross-origin
    getBalanceAsync: async function () {
        // Try direct first
        const auth = this.getAuth();
        if (auth && auth.currentUser) {
            return parseFloat(auth.currentUser.balance) || 0;
        }

        // Use postMessage
        try {
            const balance = await this._sendAndWait({ type: 'get-balance' });
            return parseFloat(balance) || 0;
        } catch (e) {
            console.warn('[GameBridge] getBalanceAsync failed:', e.message);
            return 0;
        }
    },

    /**
     * Updates the balance in the database.
     * @param {number} newTotal - The new total balance after win/loss.
     * @param {number} change - The amount of change (+ for win, - for loss).
     * @param {string} description - Transaction description.
     * @returns {object} result or { error }
     */
    updateBalance: async function (newTotal, change, description) {
        if (isNaN(newTotal)) {
            console.error("[GameBridge] Refusing to sync NaN balance");
            return { error: "Invalid balance value" };
        }
        console.log(`[GameBridge] Syncing balance: change=${change}, newTotal=${newTotal}, desc=${description}`);

        const auth = this.getAuth();
        const supabase = this.getSupabase();

        // --- Method 1: Direct parent access (same-origin only) ---
        if (auth && auth.currentUser && typeof auth.updateBalance === 'function') {
            try {
                console.log("[GameBridge] Using Method 1 (Direct Auth)");
                const result = await auth.updateBalance(newTotal);

                if (result && result.error) {
                    console.error('[GameBridge] Auth method error:', result.error);
                } else {
                    console.log("[GameBridge] Auth update success");
                    if (supabase && Math.abs(change) > 0) {
                        try {
                            await supabase.from('transactions').insert([{
                                user_id: auth.currentUser.id,
                                type: change > 0 ? 'game_win' : 'game_bet',
                                amount: Math.abs(change),
                                description: description || 'Game Activity',
                                status: 'completed'
                            }]);
                        } catch (txErr) {
                            console.warn("[GameBridge] Tx log failed:", txErr);
                        }
                    }
                    if (auth.currentUser) auth.currentUser.balance = newTotal;
                    return { data: result ? result.data : null, error: null };
                }
            } catch (e) {
                console.error("[GameBridge] Method 1 exception:", e);
            }
        }

        // --- Method 2: PostMessage to parent (cross-origin) ---
        try {
            console.log("[GameBridge] Using Method 2 (PostMessage)");
            const result = await this._sendAndWait({
                type: 'update-balance',
                newTotal: newTotal,
                change: change,
                description: description || 'Game Activity'
            });

            if (result && result.error) {
                console.error('[GameBridge] PostMessage update error:', result.error);
                return { error: result.error };
            }

            console.log("[GameBridge] PostMessage update success");
            return { data: result ? result.data : null, error: null };
        } catch (e) {
            console.error("[GameBridge] Method 2 exception:", e);
            return { error: e.message };
        }
    },

    isLoggedIn: function () {
        const auth = this.getAuth();
        if (auth && typeof auth.isLoggedIn === 'function' && auth.isLoggedIn()) return true;
        if (auth && auth.currentUser) return true;

        // Try postMessage (fire and forget check)
        // For sync check, use localStorage fallback
        try {
            return localStorage.getItem('casino_user') !== null;
        } catch (e) { }

        return false;
    },

    // Async version for cross-origin
    isLoggedInAsync: async function () {
        const auth = this.getAuth();
        if (auth && auth.currentUser) return true;

        try {
            const balance = await this._sendAndWait({ type: 'get-balance' }, 2000);
            return balance !== null && balance !== undefined;
        } catch (e) {
            return false;
        }
    },

    goHome: function () {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ source: 'game-iframe', type: 'close-game' }, '*');
            }
        } catch (e) {
            window.location.href = '../../index.html';
        }
    }
};

// Auto-initialize
GameBridge.init();
window.GameBridge = GameBridge;
