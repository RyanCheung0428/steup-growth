// Forget Password Page JavaScript — Firebase password reset email only.

// ============================================================================
// Firebase Initialization
// ============================================================================
let firebaseReady = false;

async function initFirebaseForReset() {
    try {
        const res = await fetch('/auth/firebase-config');
        if (!res.ok) return;
        const config = await res.json();
        if (!config.apiKey || !config.authDomain || !config.projectId) return;
        firebase.initializeApp(config);
        firebaseReady = true;
    } catch (e) {
        console.warn('Firebase not available for password reset:', e);
    }
}

initFirebaseForReset();

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('forget-password-form');
    const stepVerify = document.getElementById('step-verify');
    const stepSuccess = document.getElementById('step-success');
    const backLink = document.getElementById('back-link');

    const emailInput = document.getElementById('reset-email');
    const sendBtn = document.getElementById('verify-btn');
    const resetError = document.getElementById('reset-error');
    const resetSuccess = document.getElementById('reset-success');

    // Handle form submission — send Firebase password reset email
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleSendResetEmail();
    });

    async function handleSendResetEmail() {
        const email = emailInput.value.trim();

        resetError.textContent = '';
        resetError.style.display = 'none';

        if (!email) {
            showError(resetError, 'Please enter your email address.');
            return;
        }

        if (!isValidEmail(email)) {
            showError(resetError, 'Please enter a valid email address.');
            return;
        }

        if (!firebaseReady) {
            showError(resetError, 'Password reset service is not available. Please try again later.');
            return;
        }

        showLoading(sendBtn, 'Sending...');

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            // Show success
            goToStep('success');
            resetSuccess.textContent = 'A password reset email has been sent to ' + email + '. Please check your inbox (including spam folder).';
            resetSuccess.style.display = 'block';
        } catch (fbErr) {
            console.error('Firebase password reset error:', fbErr.code);
            if (fbErr.code === 'auth/user-not-found') {
                showError(resetError, 'No account found with this email address.');
            } else if (fbErr.code === 'auth/invalid-email') {
                showError(resetError, 'Please enter a valid email address.');
            } else if (fbErr.code === 'auth/too-many-requests') {
                showError(resetError, 'Too many requests. Please try again later.');
            } else {
                showError(resetError, 'Failed to send reset email. Please try again.');
            }
        } finally {
            hideLoading(sendBtn, 'Send Reset Link');
        }
    }

    function goToStep(step) {
        stepVerify.style.display = step === 'verify' ? 'flex' : 'none';
        stepSuccess.style.display = step === 'success' ? 'flex' : 'none';
        backLink.style.display = step === 'success' ? 'none' : 'flex';
    }

    function showError(el, msg) {
        el.textContent = msg;
        el.style.display = 'block';
    }

    function showLoading(btn, text) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    }

    function hideLoading(btn, text) {
        btn.disabled = false;
        btn.textContent = text;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Auto-focus email input
    setTimeout(() => emailInput.focus(), 300);
});