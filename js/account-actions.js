// Account Action Functions
function showTransactionHistory() {
    const modal = document.getElementById('transactionHistoryModal');
    if (!modal) {
        console.error('Transaction history modal not found');
        return;
    }

    // Load transactions
    loadTransactionHistory();
    modal.style.display = 'flex';
}

async function loadTransactionHistory() {
    const tbody = document.getElementById('transactionHistoryBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', simpleAuth.currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(tx => {
            const date = new Date(tx.created_at).toLocaleString();
            const statusColor = tx.status === 'completed' ? '#4CAF50' :
                tx.status === 'pending' ? '#ffcc00' : '#f44336';

            return `
                <tr>
                    <td>${date}</td>
                    <td style="text-transform: capitalize;">${tx.type}</td>
                    <td>${window.siteCurrency || '৳'}${tx.amount}</td>
                    <td>${tx.description || '-'}</td>
                    <td><span style="color: ${statusColor}; text-transform: capitalize;">${tx.status}</span></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading transactions:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f44336;">Error loading transactions</td></tr>';
    }
}

function showEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) {
        console.error('Edit profile modal not found');
        return;
    }

    // Pre-fill current data
    if (simpleAuth.currentUser) {
        document.getElementById('editProfileUsername').value = simpleAuth.currentUser.username || '';
        document.getElementById('editProfileMobile').value = simpleAuth.currentUser.mobile || '';
        document.getElementById('editProfileEmail').value = simpleAuth.currentUser.email || '';
    }

    modal.style.display = 'flex';
}

async function saveProfile(e) {
    e.preventDefault();

    const username = document.getElementById('editProfileUsername').value;
    const mobile = document.getElementById('editProfileMobile').value;
    const email = document.getElementById('editProfileEmail').value;

    if (!username || !mobile) {
        alert('Username and mobile are required');
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                username: username,
                mobile: mobile,
                email: email
            })
            .eq('id', simpleAuth.currentUser.id);

        if (error) throw error;

        // Update local user data
        simpleAuth.currentUser.username = username;
        simpleAuth.currentUser.mobile = mobile;
        simpleAuth.currentUser.email = email;
        localStorage.setItem('casino_user', JSON.stringify(simpleAuth.currentUser));

        alert('Profile updated successfully!');
        document.getElementById('editProfileModal').style.display = 'none';
        simpleAuth.updateAccountInfo();

    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

function showChangePassword() {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) {
        console.error('Change password modal not found');
        return;
    }

    // Clear form
    document.getElementById('changePasswordForm').reset();
    modal.style.display = 'flex';
}

async function changePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('All fields are required');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }

    try {
        // Verify current password
        const { data: user } = await supabase
            .from('profiles')
            .select('password')
            .eq('id', simpleAuth.currentUser.id)
            .single();

        if (user.password !== currentPassword) {
            alert('Current password is incorrect');
            return;
        }

        // Update password
        const { error } = await supabase
            .from('profiles')
            .update({ password: newPassword })
            .eq('id', simpleAuth.currentUser.id);

        if (error) throw error;

        alert('Password changed successfully!');
        document.getElementById('changePasswordModal').style.display = 'none';
        document.getElementById('changePasswordForm').reset();

    } catch (error) {
        console.error('Error changing password:', error);
        alert('Failed to change password: ' + error.message);
    }
}

function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        simpleAuth.logout();
    }
}

// Close modals when clicking outside or on close button
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
    if (e.target.classList.contains('close')) {
        e.target.closest('.modal').style.display = 'none';
    }
});

// Setup form submit handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', saveProfile);
    }

    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', changePassword);
    }
});
