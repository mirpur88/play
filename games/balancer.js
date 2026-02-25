/**
 * Game Balance Bridge - Optimized for Iframe Integration
 * Ensures balance is always synced with the main site database.
 */

const GameBridge = {

    // Attempt to find the auth system in the parent or opener window
    getAuth: function () {
        try {
            if (window.parent && window.parent !== window && window.parent.simpleAuth) {
                return window.parent.simpleAuth;
            }
            if (window.opener && window.opener.simpleAuth) {
                return window.opener.simpleAuth;
            }
        } catch (e) {
            console.warn("[GameBridge] Security blocked parent access.");
        }
        return null;
    },

    // Get the parent Supabase client
    getSupabase: function () {
        try {
            if (window.parent && window.parent !== window && window.parent.supabase) {
                return window.parent.supabase;
            }
            if (window.opener && window.opener.supabase) {
                return window.opener.supabase;
            }
        } catch (e) { }
        return null;
    },

    // Always get the LATEST balance from the auth system
    getBalance: function () {
        const auth = this.getAuth();
        if (auth && auth.currentUser) {
            return parseFloat(auth.currentUser.balance) || 0;
        }
        // Fallback: localStorage
        try {
            const savedUser = localStorage.getItem('casino_user');
            if (savedUser) return parseFloat(JSON.parse(savedUser).balance) || 0;
        } catch (e) { }
        return 0;
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

        // --- Method 1: Use parent auth system ---
        if (auth && auth.currentUser && typeof auth.updateBalance === 'function') {
            try {
                console.log("[GameBridge] Using Method 1 (Auth System)");
                const result = await auth.updateBalance(newTotal);

                if (result && result.error) {
                    console.error('[GameBridge] Auth method error:', result.error);
                    // Fall through to Method 2
                } else {
                    console.log("[GameBridge] Auth update success");
                    // Try to log transaction (silent failure)
                    if (supabase && Math.abs(change) > 0) {
                        try {
                            const txData = {
                                user_id: auth.currentUser.id,
                                type: change > 0 ? 'game_win' : 'game_bet', // Distinct types for game activity
                                amount: Math.abs(change),
                                description: description || 'Game Activity',
                                status: 'completed'
                            };
                            await supabase.from('transactions').insert([txData]);
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

        // --- Method 2: Direct Supabase update (fallback) ---
        if (supabase) {
            try {
                console.log("[GameBridge] Using Method 2 (Direct Supabase)");
                let userId = auth && auth.currentUser ? auth.currentUser.id : null;
                let username = auth && auth.currentUser ? auth.currentUser.username : null;

                if (!userId) {
                    const saved = localStorage.getItem('casino_user');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        userId = parsed.id;
                        username = parsed.username;
                    }
                }

                if (!userId) {
                    console.error("[GameBridge] No user ID for direct update");
                    return { error: "No user ID" };
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .update({ balance: newTotal })
                    .eq('id', userId)
                    .select()
                    .maybeSingle();

                if (error) {
                    console.error("[GameBridge] Direct update failed:", error);
                    return { error: error.message };
                }

                // Log transaction
                if (Math.abs(change) > 0) {
                    try {
                        await supabase.from('transactions').insert([{
                            user_id: userId,
                            type: change > 0 ? 'game_win' : 'game_bet',
                            amount: Math.abs(change),
                            description: description || 'Game Activity',
                            status: 'completed'
                        }]);
                    } catch (txErr) { console.warn("[GameBridge] Direct Tx log failed:", txErr); }
                }

                // Sync local if possible
                if (auth && auth.currentUser) auth.currentUser.balance = newTotal;

                return { data, error: null };
            } catch (e) {
                console.error("[GameBridge] Method 2 exception:", e);
                return { error: e.message };
            }
        }

        console.error("[GameBridge] CRITICAL: No connection found");
        return { error: "No connection available" };
    },

    isLoggedIn: function () {
        const auth = this.getAuth();
        if (auth && typeof auth.isLoggedIn === 'function' && auth.isLoggedIn()) return true;
        if (auth && auth.currentUser) return true;
        // Fallback
        return localStorage.getItem('casino_user') !== null;
    },

    goHome: function () {
        try {
            if (window.parent && window.parent !== window && typeof window.parent.closeGameModal === 'function') {
                window.parent.closeGameModal();
            } else {
                window.location.href = '../../index.html';
            }
        } catch (e) {
            window.location.href = '../../index.html';
        }
    }
};

window.GameBridge = GameBridge;
