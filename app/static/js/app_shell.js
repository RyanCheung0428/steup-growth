(function () {
    'use strict';

    function logout() {
        const token = localStorage.getItem('access_token');

        const finish = () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
        };

        if (!token) {
            finish();
            return;
        }

        fetch('/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {}).finally(finish);
    }

    function goToSettings(event) {
        const onSettingsPage = window.location.pathname === '/settings' || window.location.pathname === '/settings/';
        if (onSettingsPage) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        if (typeof window.navigateWithPreloadedPage === 'function') {
            window.navigateWithPreloadedPage('/settings');
            return;
        }

        window.location.href = '/settings';
    }

    function initShell() {
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn && !logoutBtn.dataset.shellBound) {
            logoutBtn.dataset.shellBound = 'true';
            logoutBtn.addEventListener('click', logout);
        }

        const settingsBtn = document.getElementById('settings');
        if (settingsBtn && !settingsBtn.dataset.shellBound) {
            settingsBtn.dataset.shellBound = 'true';
            settingsBtn.addEventListener('click', goToSettings);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShell);
    } else {
        initShell();
    }
})();
