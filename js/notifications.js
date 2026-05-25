class NotificationManager {
    constructor() {
        this.notifications = this.loadNotifications();
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.maxNotifications = 50;
    }

    initDOM() {
        this.badge = document.getElementById('notificationBadge');
        this.list = document.getElementById('notificationList');
        this.dropdown = document.getElementById('notificationDropdown');
        this.wrapper = document.getElementById('notificationWrapper');
        this.clearBtn = document.getElementById('clearNotifications');
        this.sound = document.getElementById('notificationSound');

        // Setup listeners if elements exist
        this.setupEventListeners();

        // Initial render
        this.updateBadge();
        this.renderList();
    }

    setupEventListeners() {
        // Toggle dropdown
        if (this.wrapper && this.dropdown) {
            this.wrapper.addEventListener('click', (e) => {
                // If the click is on the clear button or inside the list, 
                // we handle those specifically or let them bubble with control
                if (e.target.closest('#notificationDropdown')) return;

                e.stopPropagation();
                this.dropdown.classList.toggle('active');
                if (this.dropdown.classList.contains('active')) {
                    this.markAllAsRead();
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.dropdown && this.dropdown.classList.contains('active')) {
                if (!this.wrapper.contains(e.target)) {
                    this.dropdown.classList.remove('active');
                }
            }
        });

        // Clear all
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearAll();
            });
        }
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('admin_notifications');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading notifications', e);
            return [];
        }
    }

    saveNotifications() {
        try {
            localStorage.setItem('admin_notifications', JSON.stringify(this.notifications.slice(0, this.maxNotifications)));
        } catch (e) {
            console.error('Error saving notifications', e);
        }
    }

    addNotification(title, message, type, data = {}, customId = null, playSound = true) {
        const id = customId || Date.now();

        // Prevent duplicates if ID is provided
        if (customId && this.notifications.some(n => n.id === customId)) {
            return;
        }

        const notification = {
            id: id,
            title,
            message,
            type, // 'member', 'deposit', 'withdraw'
            data,
            time: new Date().toISOString(),
            read: false
        };

        this.notifications.unshift(notification);
        this.unreadCount++;
        this.saveNotifications();
        this.updateBadge();
        this.renderList();

        // Play sound
        if (playSound) this.playSound();

        // Show toast using AdminManager's method if available
        if (window.adminManager && window.adminManager.showToast) {
            window.adminManager.showToast(`${title}: ${message}`, type === 'deposit' ? 'success' : 'info');
        }
    }

    updateBadge() {
        if (!this.badge) return;
        if (this.unreadCount > 0) {
            this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            this.badge.style.display = 'flex';
        } else {
            this.badge.style.display = 'none';
        }
    }

    markAllAsRead() {
        let hasChanges = false;
        this.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            this.unreadCount = 0;
            this.saveNotifications();
            this.updateBadge();
            this.renderList();
        }
    }

    clearAll() {
        this.notifications = [];
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateBadge();
        this.renderList();
        if (this.dropdown) this.dropdown.classList.remove('active');
    }

    playSound() {
        if (this.sound) {
            // Reset to beginning in case it's already playing
            this.sound.currentTime = 0;
            const playPromise = this.sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("Audio play failed. Browser might be blocking auto-play until user interaction.", error);
                });
            }
        }
    }

    renderList() {
        if (!this.list) return;

        if (this.notifications.length === 0) {
            this.list.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No new notifications</p>
                </div>
            `;
            return;
        }

        this.list.innerHTML = this.notifications.map(n => `
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="window.notificationManager.handleItemClick('${n.id}')">
                <div class="item-icon" style="background: ${this.getTypeColor(n.type)}20; color: ${this.getTypeColor(n.type)}">
                    <i class="fas ${this.getTypeIcon(n.type)}"></i>
                </div>
                <div class="item-content">
                    <div class="item-title">${n.title}</div>
                    <div class="item-desc">${n.message}</div>
                    <div class="item-time">${this.formatTime(n.time)}</div>
                </div>
            </div>
        `).join('');
    }

    getTypeColor(type) {
        switch (type) {
            case 'deposit': return '#4CAF50';
            case 'withdraw': return '#f44336';
            case 'member': return '#2196F3';
            default: return '#ffcc00';
        }
    }

    getTypeIcon(type) {
        switch (type) {
            case 'deposit': return 'fa-wallet';
            case 'withdraw': return 'fa-money-bill-wave';
            case 'member': return 'fa-user-plus';
            default: return 'fa-bell';
        }
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + 'm ago';
        if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + 'h ago';
        return date.toLocaleDateString();
    }

    handleItemClick(id) {
        // Use loose equality to match string ID from HTML with potentially number/string ID in object
        const n = this.notifications.find(notif => notif.id == id);
        if (!n) return;

        // Mark as read
        n.read = true;
        this.unreadCount = this.notifications.filter(notif => !notif.read).length;
        this.saveNotifications();
        this.updateBadge();
        this.renderList();

        // Navigate to relevant section
        if (n.type === 'deposit' || n.type === 'withdraw') {
            const paymentsLink = document.querySelector('.nav-link[data-tab="payments"]');
            if (paymentsLink) paymentsLink.click();
        } else if (n.type === 'member') {
            const usersLink = document.querySelector('.nav-link[data-tab="users"]');
            if (usersLink) usersLink.click();
        }

        if (this.dropdown) this.dropdown.classList.remove('active');
    }
}

// Initialize immediately so window.notificationManager is available
window.notificationManager = new NotificationManager();

// Setup DOM elements when they are ready
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager.initDOM();
});
