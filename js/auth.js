// auth.js - Giriş/çıkış yönetimi

const Auth = {
    HASH_KEY: 'sp_password_hash',

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + '_vardiya_planner_salt');
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    isFirstTime() {
        return !localStorage.getItem(this.HASH_KEY);
    },

    async setup(password, confirm) {
        if (password.length < 4) return { ok: false, msg: 'Şifre en az 4 karakter olmalı' };
        if (password !== confirm) return { ok: false, msg: 'Şifreler eşleşmiyor' };
        const hash = await this.hashPassword(password);
        localStorage.setItem(this.HASH_KEY, hash);
        sessionStorage.setItem('sp_auth', 'true');
        return { ok: true };
    },

    async login(password) {
        const hash = await this.hashPassword(password);
        const stored = localStorage.getItem(this.HASH_KEY);
        if (hash === stored) {
            sessionStorage.setItem('sp_auth', 'true');
            return { ok: true };
        }
        return { ok: false, msg: 'Şifre hatalı' };
    },

    isLoggedIn() {
        return sessionStorage.getItem('sp_auth') === 'true';
    },

    logout() {
        sessionStorage.removeItem('sp_auth');
        window.location.href = 'index.html';
    }
};

// Login page logic
document.addEventListener('DOMContentLoaded', () => {
    // If already on app.html, just check auth
    if (window.location.pathname.includes('app.html')) {
        if (!Auth.isLoggedIn()) window.location.href = 'index.html';
        return;
    }

    // If logged in, redirect to app
    if (Auth.isLoggedIn()) {
        window.location.href = 'app.html';
        return;
    }

    const setupSection = document.getElementById('setupSection');
    const loginSection = document.getElementById('loginSection');
    const alertBox = document.getElementById('alertBox');

    function showAlert(msg, type) {
        alertBox.className = `alert mt-3 alert-${type}`;
        alertBox.textContent = msg;
        alertBox.classList.remove('d-none');
    }

    if (Auth.isFirstTime()) {
        setupSection.classList.remove('d-none');
    } else {
        loginSection.classList.remove('d-none');
    }

    document.getElementById('btnSetup')?.addEventListener('click', async () => {
        const result = await Auth.setup(
            document.getElementById('newPassword').value,
            document.getElementById('confirmPassword').value
        );
        if (result.ok) {
            window.location.href = 'app.html';
        } else {
            showAlert(result.msg, 'danger');
        }
    });

    document.getElementById('btnLogin')?.addEventListener('click', async () => {
        const result = await Auth.login(document.getElementById('loginPassword').value);
        if (result.ok) {
            window.location.href = 'app.html';
        } else {
            showAlert(result.msg, 'danger');
        }
    });

    // Enter key support
    document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btnLogin').click();
    });
    document.getElementById('confirmPassword')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btnSetup').click();
    });
});
