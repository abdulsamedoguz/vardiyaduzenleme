// auth.js - Giriş/çıkış yönetimi

const Auth = {
    HASH_KEY: 'sp_password_hash',

    async hashPassword(password) {
        const str = password + '_vardiya_planner_salt';
        // crypto.subtle sadece güvenli bağlamlarda (HTTPS/localhost) çalışır.
        // file:// ile açıldığında fallback hash kullanılır.
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(str);
                const hash = await crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                // fallback
            }
        }
        // Basit hash (file:// ortamları için)
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash |= 0;
        }
        return 'h_' + Math.abs(hash).toString(16);
    },

    async ensureDefaultPassword() {
        // Şifreyi her zaman 06042026 olarak ayarla
        const hash = await this.hashPassword('06042026');
        localStorage.setItem(this.HASH_KEY, hash);
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
document.addEventListener('DOMContentLoaded', async () => {
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

    const loginSection = document.getElementById('loginSection');
    const alertBox = document.getElementById('alertBox');

    function showAlert(msg, type) {
        alertBox.className = `alert mt-3 alert-${type}`;
        alertBox.textContent = msg;
        alertBox.classList.remove('d-none');
    }

    // Varsayılan şifre yoksa oluştur, sonra giriş ekranını göster
    await Auth.ensureDefaultPassword();
    loginSection.classList.remove('d-none');

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
});
