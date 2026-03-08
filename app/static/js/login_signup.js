/**
 * Login & Sign-Up page with Firebase Authentication.
 *
 * Flow:
 * 1. Fetch Firebase config from /auth/firebase-config
 * 2. Initialize Firebase client SDK
 * 3. Support Email/Password sign-up & sign-in via Firebase
 * 4. Support Google sign-in via Firebase popup
 * 5. On Firebase login success -> send Firebase ID token to /auth/firebase-login
 *    -> receive local JWT -> store & redirect
 */

// ============================================================================
// UI toggle between sign-in / sign-up panels
// ============================================================================
const container = document.getElementById('container');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');

registerBtn.addEventListener('click', () => {
    container.classList.add("active");
});

loginBtn.addEventListener('click', () => {
    container.classList.remove("active");
});

// Password visibility toggles
document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';

        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-eye', isVisible);
            icon.classList.toggle('fa-eye-slash', !isVisible);
        }
        btn.setAttribute('aria-pressed', String(!isVisible));
    });
});

// ============================================================================
// Firebase Initialization
// ============================================================================
let firebaseReady = false;

async function initFirebase() {
    try {
        const res = await fetch('/auth/firebase-config');
        if (!res.ok) {
            console.warn('Firebase config not available — Google sign-in disabled');
            return;
        }
        const config = await res.json();

        if (!config.apiKey || !config.authDomain || !config.projectId) {
            console.warn('Firebase config incomplete — Google sign-in disabled');
            return;
        }

        firebase.initializeApp(config);
        firebaseReady = true;
        console.log('Firebase initialized');
    } catch (e) {
        console.warn('Failed to initialize Firebase:', e);
    }
}

// Initialize Firebase on page load
initFirebase();

// ============================================================================
// Helper: Exchange Firebase ID token for local JWT
// ============================================================================
async function exchangeFirebaseToken(idToken, remember = false) {
    const response = await fetch('/auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, remember })
    });

    const data = await response.json();

    if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        window.location.href = '/';
        return;
    }

    throw new Error(data.error || 'Firebase login failed');
}

// ============================================================================
// Google Sign-In (Firebase popup)
// ============================================================================
async function handleGoogleSignIn(errorDiv) {
    if (!firebaseReady) {
        errorDiv.textContent = 'Google sign-in is not available. Please use email/password.';
        return;
    }

    try {
        errorDiv.textContent = '';
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const idToken = await result.user.getIdToken();
        const remember = document.getElementById('remember-me')?.checked || false;
        await exchangeFirebaseToken(idToken, remember);
    } catch (e) {
        console.error('Google sign-in error:', e);
        if (e.code === 'auth/popup-closed-by-user') {
            return; // User closed the popup — not an error worth showing
        }
        errorDiv.textContent = e.message || 'Google sign-in failed. Please try again.';
    }
}

// Wire up Google sign-in buttons
document.getElementById('google-signin-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleSignIn(document.getElementById('signin-error'));
});

document.getElementById('google-signup-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleSignIn(document.getElementById('signup-error'));
});

// ============================================================================
// Email/Password Sign-Up
// ============================================================================
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const errorDiv = document.getElementById('signup-error');

    errorDiv.textContent = '';

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }

    try {
        // All sign-ups go through Firebase
        if (!firebaseReady) {
            errorDiv.textContent = 'Firebase is not available. Please try again later.';
            return;
        }

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            // Update displayName on Firebase side
            if (username) {
                await userCredential.user.updateProfile({ displayName: username });
            }

            // Sign out immediately — user must log in manually after registration
            await firebase.auth().signOut();

            // Show success message and switch to sign-in panel
            errorDiv.style.color = '#28a745';
            errorDiv.textContent = 'Registration successful! Please sign in with your email and password.';

            // Automatically switch to the sign-in panel after a short delay
            setTimeout(() => {
                const container = document.getElementById('container');
                if (container) {
                    container.classList.remove('active');
                }
                errorDiv.textContent = '';
                errorDiv.style.color = '';
            }, 2000);
            return;
        } catch (firebaseError) {
            console.error('Firebase signup error:', firebaseError);
            const errorMap = {
                'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
                'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
                'auth/invalid-email': 'Invalid email format.'
            };
            errorDiv.textContent = errorMap[firebaseError.code] || firebaseError.message || 'Registration failed';
            return;
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        console.error('Error:', error);
    }
});

// ============================================================================
// Email/Password Sign-In
// ============================================================================
document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    const errorDiv = document.getElementById('signin-error');

    errorDiv.textContent = '';
    errorDiv.style.color = 'red';

    try {
        // All sign-ins go through Firebase
        if (!firebaseReady) {
            errorDiv.textContent = 'Firebase is not available. Please try again later.';
            return;
        }

        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const idToken = await userCredential.user.getIdToken();
            await exchangeFirebaseToken(idToken, rememberMe);
            return;
        } catch (firebaseError) {
            console.error('Firebase email login failed:', firebaseError.code);
            const errorMap = {
                'auth/user-not-found': 'No account found with this email.',
                'auth/wrong-password': 'Invalid password.',
                'auth/invalid-credential': 'Invalid email or password.',
                'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
                'auth/user-disabled': 'This account has been disabled.'
            };
            errorDiv.textContent = errorMap[firebaseError.code] || firebaseError.message || 'Login failed';
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        console.error('Error:', error);
    }
});