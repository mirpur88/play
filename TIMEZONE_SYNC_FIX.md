## Quick Fix for Timezone Sync Issue

The "New Today" stat (20) and chart (15) are out of sync because they use different timezone logic.

### The Problem
- **Stat**: Uses complex UTC conversion that's unreliable
- **Chart**: Uses simple date string comparison in configured timezone

### The Solution
Replace lines 542-556 in `admin.js` with:

```javascript
            // New Today - Use same timezone logic as chart for perfect sync
            const timezone = this.getConfiguredTimezone();
            const now = new Date();
            const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
            
            const newToday = usersRes.data.filter(u => {
                const userDate = new Date(u.created_at);
                const userDateStr = userDate.toLocaleDateString('en-CA', { timeZone: timezone });
                return userDateStr === todayDateStr;
            }).length;
```

This makes the stat use EXACTLY the same logic as the chart - both now convert dates to YYYY-MM-DD strings in the configured timezone and compare them directly.

### Why This Works
1. Gets today's date as a string (e.g. "2026-02-14") in the configured timezone
2. For each user, converts their created_at date to a string in the same timezone
3. Compares the strings directly - if they match, the user joined "today"

This is simpler and matches the chart logic exactly, so both will always show the same number.
