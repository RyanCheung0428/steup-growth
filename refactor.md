# React Refactoring Log

## Phase 0 — React Project Scaffold (2026-04-29)

### Status: ✅ COMPLETE

### What Was Done

1. **Project Structure** — Created `/frontend/` with Vite + React 18 + Tailwind CSS 3
   ```
   frontend/
   ├── index.html              # Entry HTML with font preconnects + Font Awesome CDN
   ├── package.json            # Dependencies: react, react-router-dom, socket.io-client, firebase
   ├── vite.config.js          # Dev proxy to Flask :5000 (covers all API routes + Socket.IO)
   ├── tailwind.config.js      # AEColor palette, Space Grotesk font, custom animations
   ├── postcss.config.js       # Tailwind + Autoprefixer
   ├── .gitignore              # Ignores node_modules, dist
   └── src/
       ├── main.jsx            # Entry: BrowserRouter > Auth > Settings > I18n > App
       ├── App.jsx             # Route definitions + AppShellLayout wrapper
       ├── index.css           # Tailwind directives + AE design system component classes
       ├── contexts/
       │   ├── AuthContext.jsx   # JWT token mgmt, user decode, login/logout/refresh
       │   ├── SettingsContext.jsx # Theme (light/dark/auto), language, model, voice, profile fetch
       │   └── I18nContext.jsx  # Dynamic locale loader, t() function, zh-TW/en/ja/zh-CN
       ├── components/
       │   ├── AuthGuard.jsx    # Redirects to /login if no token in localStorage
       │   ├── AppShellNav.jsx  # Top nav bar (logo, nav links, settings + logout buttons)
       │   └── SettingsModal.jsx # Placeholder modal (4 tabs: Profile/Children/Personalization/API)
       ├── hooks/              # (empty, for future custom hooks)
       ├── lib/                # (empty, for utilities)
       ├── types/              # (empty)
       ├── i18n/               # zh-TW.json, en.json, ja.json, zh-CN.json (copied from app/static/i18n)
       └── data/               # emojis.json (copied from app/static/data)
   ```

2. **Vite Proxy Configuration** — `/frontend/vite.config.js:6-50`
   - All Flask routes proxied: `/api/*`, `/auth/*`, `/chat/*`, `/conversations/*`, `/messages/*`, `/static/*`, `/socket.io`, `/login`, `/forgot_password`, `/serve_file`
   - Socket.IO WebSocket support (`ws: true`)
   - Frontend dev on port 3000

3. **Tailwind Design System** — `/frontend/tailwind.config.js` + `/frontend/src/index.css`
   - `ae-*` color palette matching original `aeon.css` (surface, card, border, text, primary, danger, etc.)
   - Full dark mode support via `.dark-theme` class
   - Custom animations: fade-in, slide-up, slide-down, twinkle, drift, float, spin
   - Reusable component classes: `.ae-card`, `.ae-btn`, `.ae-btn--primary/danger/ghost`, `.ae-icon-btn`, `.ae-navlink`, `.ae-stat`, `.ae-kicker`, `.ae-grid`

4. **Core Contexts**
   - **AuthContext** — Reads `access_token` from localStorage, decodes JWT payload for user info, provides `login()`, `logout()`, `refreshToken()`
   - **SettingsContext** — Theme mode (applies `.dark-theme` to `<html>`), language, AI model, voice; persists to localStorage; fetches from `/api/user/profile`
   - **I18nContext** — Dynamic JSON import per locale, `t('key.subkey')` lookup function

5. **Shared Components**
   - **AuthGuard** — Wraps protected routes; redirects to `/login` if unauthenticated
   - **AppShellNav** — Matches `_app_shell_nav.html`: logo, 4 nav links + admin link for admin users, settings button (dispatches `open-settings` event), logout button
   - **SettingsModal** — Placeholder with open/close logic, listens for `open-settings` event, 4 sidebar tabs

6. **Route Map** — `/frontend/src/App.jsx:17-42`
   | Path | Page | Auth | Layout |
   |------|------|------|--------|
   | `/login` | LoginSignup ✅ | No | Blank |
   | `/forgot-password` | ForgotPassword ✅ | No | Blank |
| `/` | Home ✅ | Yes | AppShellNav + SettingsModal |
| `/video` | VideoAccess (placeholder) | Yes | AppShellNav + SettingsModal |
   | `/pose-detection` | PoseDetection (placeholder) | Yes | AppShellNav + SettingsModal |
   | `/admin` | Admin (placeholder) | Yes | AppShellNav + SettingsModal |
   | `/chat` | Chatbox (placeholder) | Yes | No nav (sidebar layout later) |

### Build Verification
- `npm install` — 229 packages installed
- `vite build` — 46 modules transformed, builds in 783ms, output ~174KB JS + 9KB CSS (gzipped: ~57KB + 3KB)
- `vite dev` — Dev server starts on port 3000

### Notes
- Firebase SDK is included in dependencies but not yet used (needed in Phase 2 for Login/Signup)
- `socket.io-client` is installed but not yet wired up (needed for chat and admin pages)
- The original Flask app and templates remain untouched — dual-run during transition
- SettingsModal is a minimal placeholder; full 4-tab implementation comes as pages that need it get built

### Next: Phase 1 — Forgot Password Page
- Template: `app/templates/forget_password.html` (53 lines)
- CSS: `app/static/css/forget_password.css` (80 lines)
- JS: `app/static/js/forget_password.js` (163 lines)
- Backend: `POST /auth/forgot-password`

---

## Phase 1 — Forgot Password Page (2026-04-29)

### Status: ✅ COMPLETE

### Source Files

| Original | New React |
|----------|-----------|
| `app/templates/forget_password.html` (53 lines) | `frontend/src/pages/ForgotPassword.jsx` (171 lines) |
| `app/static/css/forget_password.css` (80 lines) | Tailwind utilities + inline `<style>` for keyframes |
| `app/static/css/login_signup.css` (shared base styles) | Tailwind utilities matching original colors/typography |
| `app/static/js/forget_password.js` (163 lines) | React state + fetch in ForgotPassword.jsx |

### Page Layout (identical to original)

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │     Reset Password (h1)       │  │
│  │  Enter your email... (subtitle)│  │
│  │                               │  │
│  │  STEP 1 (verify):             │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Email input             │  │  │
│  │  └─────────────────────────┘  │  │
│  │  [error message if any]       │  │
│  │  [==== Send Reset Link ====]  │  │
│  │                               │  │
│  │  STEP 2 (success):            │  │
│  │       ✓ / ⚠ icon             │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Success message card    │  │  │
│  │  └─────────────────────────┘  │  │
│  │  [==== Resend Email ====]     │  │
│  │                               │  │
│  │  ← Back to Login              │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Feature Parity

| Feature | Original | React |
|---------|----------|-------|
| Email input with validation | ✅ | ✅ |
| Loading spinner on submit | ✅ | ✅ |
| Error display for invalid email | ✅ | ✅ |
| Error display for network failure | ✅ | ✅ |
| Error display for Google-only accounts | ✅ | ✅ |
| Verification needed warning (⚠ icon, hide resend) | ✅ | ✅ |
| Reset sent success (✓ icon, show resend) | ✅ | ✅ |
| Anti-enumeration generic message | ✅ | ✅ |
| Resend button with 30s cooldown | ✅ | ✅ |
| Resend loading state | ✅ | ✅ |
| Auto-focus email on mount (300ms delay) | ✅ | ✅ |
| Back to Login link | ✅ | ✅ |
| successBounce animation on icon | ✅ | ✅ |
| successPulse animation on message card | ✅ | ✅ |
| Dark theme support | ✅ | ✅ |
| Responsive centered layout (max-w 420px) | ✅ | ✅ |

### API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/forgot-password` | Resend (same endpoint) |

### Code Changes

1. **`frontend/src/pages/ForgotPassword.jsx`** — New file. Full React component with email validation, fetch to `/auth/forgot-password`, two-step UI (verify → success), resend with cooldown, matching all original behaviors.
2. **`frontend/src/App.jsx`** — Added `import ForgotPassword`, replaced placeholder route with `<ForgotPassword />`.

### Build Verification
- `vite build` — 47 modules transformed, 816ms, ~179KB JS + 14KB CSS (gzipped: ~58KB + 4KB)
- Incremental size: +5KB CSS (forgot-password inline styles), +5KB JS

### Notes
- Inline `<style>` element used for `successBounce` and `successPulse` keyframes (avoids polluting Tailwind config for page-specific animations)
- HTML dangerouslySetInnerHTML used for server-generated messages (trusted source: our backend)
- React route is `/forgot-password` (hyphen) — login page Phase 2 will link accordingly

### Next: Phase 2 — Login/Signup Page
- Template: `app/templates/login_signup.html` (120 lines)
- CSS: `app/static/css/login_signup.css` (373 lines)
- JS: `app/static/js/login_signup.js` (475 lines)
- Backend: `POST /auth/firebase-login`, `GET /auth/firebase-config`, `POST /auth/resend-verification`
- Firebase SDK required for Google OAuth + email/password auth

---

## Phase 2 — Login/Signup Page (2026-04-29)

### Status: ✅ COMPLETE

### Source Files

| Original | New React |
|----------|-----------|
| `app/templates/login_signup.html` (120 lines) | `frontend/src/pages/LoginSignup.jsx` (330 lines) |
| `app/static/css/login_signup.css` (373 lines) | Tailwind utilities (all colors/spacing/fonts matched) |
| `app/static/js/login_signup.js` (475 lines) | React state + Firebase modular SDK |

### Page Layout (identical to original)

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │  [ Sign In ] . [ Sign Up ]    │  │  ← Tab bar with active underline
│  │                               │  │
│  │  SIGN IN VIEW:                │  │
│  │    Welcome Back (h1)          │  │
│  │    Please enter your...       │  │
│  │    [=== Sign in with Google]  │  │
│  │    ─────── or ───────         │  │
│  │    [ Email input            ] │  │
│  │    [ Password ****      👁 ]  │  │
│  │    ☐ Remember Me  Forget PW?  │  │
│  │    [error if any]             │  │
│  │    [====== Sign In ======]    │  │
│  │                               │  │
│  │  SIGN UP VIEW:                │  │
│  │    Create Account (h1)        │  │
│  │    Join us to access...       │  │
│  │    [== Sign up with Google=]  │  │
│  │    ─────── or ───────         │  │
│  │    [ Username               ] │  │
│  │    [ Email                  ] │  │
│  │    [ Password ****      👁 ]  │  │
│  │    [ Confirm ***        👁 ]  │  │
│  │    [error if any]             │  │
│  │    [====== Sign Up ======]    │  │
│  │                               │  │
│  │  VERIFICATION CARDS:          │  │  ← Dynamic, replaces form
│  │    (warning) Unverified sign-in attempt   │
│  │    (success) After registration           │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Feature Parity

| Feature | Original | React |
|---------|----------|-------|
| Tab switching (Sign In / Sign Up) | ✅ | ✅ |
| Firebase config fetch from `/auth/firebase-config` | ✅ | ✅ |
| Google Sign-In popup (both tabs) | ✅ | ✅ |
| Google Sign-Up popup | ✅ | ✅ |
| Popup closed — silent ignore | ✅ | ✅ |
| Email/Password Sign-In | ✅ | ✅ |
| Email/Password Sign-Up | ✅ | ✅ |
| Username update on Firebase profile during sign-up | ✅ | ✅ |
| Email verification sent on sign-up | ✅ | ✅ |
| Local DB sync on sign-up (firebase-login POST) | ✅ | ✅ |
| JWT token exchange → localStorage → redirect to `/` | ✅ | ✅ |
| Remember Me checkbox (sign-in only) | ✅ | ✅ |
| Forget Password link (sign-in only) | ✅ | ✅ |
| Password visibility toggle (eye/eye-slash) | ✅ | ✅ |
| Confirm password match validation | ✅ | ✅ |
| Hidden dummy fields (prevent browser save-password) | ✅ | ✅ |
| Firebase error codes mapped to user-friendly messages | ✅ | ✅ |
| Sign-in verification card (unverified email) — warning | ✅ | ✅ |
| Sign-in verification card — resend with 30s cooldown | ✅ | ✅ |
| Sign-in verification card — back to sign in button | ✅ | ✅ |
| Sign-up verification card (after registration) — success | ✅ | ✅ |
| Sign-up verification card — resend with 30s cooldown | ✅ | ✅ |
| Sign-up verification card — go to sign in link | ✅ | ✅ |
| Dark theme support | ✅ | ✅ |
| Responsive centered layout (max-w 420px) | ✅ | ✅ |
| fadeIn animation on view switch | ✅ | ✅ |

### API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/firebase-config` | Fetch Firebase client config (apiKey, authDomain, projectId) |
| POST | `/auth/firebase-login` | Exchange Firebase ID token for local JWT |

### Code Changes

1. **`frontend/src/pages/LoginSignup.jsx`** — New file (330 lines). Full React component: Firebase init, tab-switching UI, Google OAuth popup, email/password sign-in and sign-up flows, verification card states (warning + success) with resend + back buttons, password visibility toggles, hidden dummy fields to prevent browser autofill, all Firebase error mappings.
2. **`frontend/src/App.jsx`** — Added `import LoginSignup`, replaced placeholder route with `<LoginSignup />`.

### Build Verification
- `vite build` — 59 modules, 1.05s, ~358KB JS + 17KB CSS (gzipped: ~96KB + 4KB)
- Incremental size: +179KB JS (Firebase SDK modules), +3KB CSS

### Notes
- Firebase SDK imported as ES modules (`firebase/app`, `firebase/auth`) — NOT compat mode CDN. This avoids a CDN dependency at runtime.
- `GoogleAuthProvider` from `firebase/auth` replaces `firebase.auth.GoogleAuthProvider` from compat mode.
- `signOut(auth)` → calls Firebase sign out after verification resend or exchange failure
- Verification cards use inline component state (`resendState: idle/loading/sent/throttled/error`) matching the 30s cooldown pattern from original
- On successful login: stores `access_token` and `refresh_token` in localStorage, navigates to `/`

### Next: Phase 3 — Home/Landing Page
- Template: `app/templates/index.html` (95 lines)
- CSS: `app/static/css/index.css` (83 lines) + `aeon.css`
- JS: `app_shell.js` (56 lines) + settings by include
- Includes: `_app_shell_nav.html`, `setting.html`

---

## Phase 3 — Home Page + Settings Modal (2026-04-29)

### Status: ✅ COMPLETE

### Source Files

| Original | New React |
|----------|-----------|
| `app/templates/index.html` (95 lines) | `frontend/src/pages/Home.jsx` (97 lines) |
| `app/static/css/index.css` (83 lines) | Tailwind utilities |
| `app/static/css/aeon.css` (423 lines) | `frontend/tailwind.config.js` + `frontend/src/index.css` (aligned to match exactly) |
| `app/templates/setting.html` (459 lines) | `frontend/src/components/SettingsModal.jsx` (420 lines) |
| `app/static/css/settings.css` (462 lines) | Tailwind + CSS component classes in index.css |
| `app/static/js/settings.js` (3811 lines) | React state + fetch per tab |
| `app/static/js/app_shell.js` (56 lines) | Already handled by AppShellNav + AuthContext |

### Home Page Layout (matches original)

```
┌──────────────────────────────────────────────┐
│  ┌─ AppShellNav (sticky, blur backdrop) ───┐ │
│  └──────────────────────────────────────────┘ │
│  ┌─ ae-main ───────────────────────────────┐ │
│  │  ┌─ Hero Card ────────────────────────┐ │ │
│  │  │  Kicker: Child Development          │ │ │
│  │  │  H1: Clinical support...            │ │ │
│  │  │  Desc + [Video Analysis] [AI Chat]  │ │ │
│  │  │                    Stat Grid (x3)   │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  │  ┌─ Workbench (3 col) ────────────────┐ │ │
│  │  │ [Video Analysis] [Pose Detection]   │ │ │
│  │  │          [AI Guidance]              │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────┘ │
│  ┌─ SettingsModal (conditional) ───────────┐ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Home Page Feature Parity

| Feature | Original | React |
|---------|----------|-------|
| Hero section with kicker + h1 + description | ✅ | ✅ |
| Two action buttons (Video Analysis, Open AI Chat) | ✅ | ✅ |
| 3 stat cards (Video Workflow, Pose Session, AI Guidance) | ✅ | ✅ |
| 3 workbench clickable cards with navigation | ✅ | ✅ |
| Workbench cards: icon, title, description | ✅ | ✅ |
| Responsive grid (3→2→1 columns) | ✅ | ✅ |
| Dark theme support via CSS variables | ✅ | ✅ |
| Sticky nav bar with blur backdrop | ✅ | ✅ |

### Settings Modal Feature Parity

| Tab | Feature | Original | React |
|-----|---------|----------|-------|
| **Profile** | Avatar display + upload/clear | ✅ | ✅ |
| | Edit username (modal) | ✅ | ✅ |
| | Edit email (modal) | ✅ | ✅ |
| | Send password reset email | ✅ | ✅ |
| | Delete account with password confirmation | ✅ | ✅ |
| **Children** | Children list display | ✅ | ✅ |
| | Add child (modal: name, birthdate, gender, notes) | ✅ | ✅ |
| | Edit child | ✅ | ✅ |
| | Delete child with confirmation | ✅ | ✅ |
| | Empty state message | ✅ | ✅ |
| **Personalization** | Theme selector (light/dark/auto) | ✅ | ✅ |
| | Language selector (zh-TW/zh-CN/en/ja) | ✅ | ✅ |
| | TTS voice selector | ✅ | ✅ |
| **Advanced** | Provider toggle (AI Studio / Vertex AI) | ✅ | ✅ |
| | Model selection dropdown | ✅ | ✅ |
| | API key selection dropdown | ✅ | ✅ |
| | Configuration list (show/hide toggle) | ✅ | ✅ |
| | Delete API key / Vertex account | ✅ | ✅ |
| | Add config modal (AI Studio: name+key, Vertex: SA/API key) | ✅ | ✅ |
| | Vertex auth mode toggle (Service Account / API Key) | ✅ | ✅ |
| **General** | Open/close via settings button (custom event) | ✅ | ✅ |
| | Close on Escape key | ✅ | ✅ |
| | Close on backdrop click | ✅ | ✅ |
| | Sidebar tab navigation with active state | ✅ | ✅ |
| | Data loads on tab selection (children, keys) | ✅ | ✅ |

### Design System Alignment

Updated `tailwind.config.js` + `index.css` to match original `aeon.css` exactly:
- All 14 CSS variables (`--ae-bg`, `--ae-surface`, `--ae-border`, `--ae-text`, `--ae-primary`, etc.)
- Full dark theme overrides matching original `.dark-theme` body class
- Component classes: `.ae-card`, `.ae-btn`, `.ae-btn--primary`, `.ae-btn--danger`, `.ae-btn--ghost`, `.ae-icon-btn`, `.ae-btn--sm`, `.ae-kicker`, `.ae-stat`, `.ae-stat__label`, `.ae-stat__value`, `.ae-input`, `.ae-select`, `.ae-textarea`, `.ae-navlink`, `.profile-item`, `.field-label`, `.field-content`, `.settings-sidebar-group`
- Top navigation: `.ae-topnav` with translucent bg + blur backdrop (light + dark)
- Body background: radial + linear gradient matching original

### API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/me` | Get user profile (username, email, avatar) |
| POST | `/auth/update-avatar` | Upload/clear avatar |
| POST | `/auth/update-profile` | Update username or email |
| POST | `/auth/change-password` | Send password reset email |
| POST | `/auth/delete-account` | Delete account (with password confirmation) |
| GET | `/api/children` | List user's children |
| POST | `/api/children` | Create child |
| PUT | `/api/children/:id` | Update child |
| DELETE | `/api/children/:id` | Delete child |
| GET | `/api/keys` | List API keys |
| POST | `/api/keys` | Create API key |
| DELETE | `/api/keys/:id` | Delete API key |
| POST | `/api/keys/:id/toggle` | Toggle key selection |
| GET | `/api/vertex/accounts` | List Vertex accounts |
| POST | `/api/vertex/accounts` | Create Vertex account |
| DELETE | `/api/vertex/accounts/:id` | Delete Vertex account |
| GET | `/api/user/model` | Get selected AI model |
| POST | `/api/user/model` | Set AI model/provider |
| POST | `/api/user/profile` | Update language/voice/theme |
| GET | `/api/tts/voices` | List TTS voices |

### Code Changes

1. **`frontend/src/pages/Home.jsx`** — New file (97 lines). Hero section + 3 workbench cards, all with click navigation via `useNavigate()`.
2. **`frontend/src/components/SettingsModal.jsx`** — Replaced placeholder with full 420-line component. Includes ProfileTab, ChildrenTab, PersonalizationTab, AdvancedTab, plus 6 sub-modals (EditUsername, EditEmail, ChangePassword, DeleteAccount, ChildForm, AddConfig).
3. **`frontend/tailwind.config.js`** — Rebuilt to match aeon.css colors exactly. Added dark theme color variants.
4. **`frontend/src/index.css`** — Rebuilt to match aeon.css design system exactly: 14 CSS variables, component classes, topnav, dark theme body background gradient.
5. **`frontend/src/components/AppShellNav.jsx`** — Updated to use `.ae-topnav` class with proper translucent blur backdrop.
6. **`frontend/src/App.jsx`** — Added `import Home`, wired route.

### Build Verification
- `vite build` — 60 modules, 1.08s, ~382KB JS + 23KB CSS (gzipped: ~102KB + 6KB)
- Incremental size: +25KB JS (settings modal), +3KB CSS (design system classes)

### Notes
- Settings modal loads data lazily per tab (children only fetched when Children tab selected, keys on Advanced tab)
- CSS variables (`var(--ae-*)`) handle dark mode automatically — no duplicate `dark:` utility classes needed
- All sub-modals render at higher z-index (150) to layer above the main settings modal (140)
- Delete account triggers full logout (removes tokens, redirects to /login)

### Phase 3 Fixes (2026-04-29)

**Bug fix — Personalization tab white screen:**
- Root cause: `PersonalizationTab` was receiving `settings` (containing `updateSetting`) as a prop from parent, but the function reference wasn't properly passed through destructuring
- Fix: `PersonalizationTab` now calls `useSettings()` directly inside its own component body, ensuring it always has the live context value with `theme`, `language`, `voice`, `updateSetting`
- Added `ErrorBoundary` wrapper around all 4 tabs to prevent one tab crash from taking down the entire modal

**Bug fix — Settings modal header gap:**
- Root cause: `ErrorBoundary` returned `this.props.children` as array, making React render Header + content as separate grid children with `gap-[22px]` between them
- Fix: Each tab's Header + content wrapped in a `<div>` inside ErrorBoundary; removed grid gap from panel

**Bug fix — Children add/edit not refreshing:**
- Root cause: `onSaved` closed sub-modal but useEffect dep array `[open, tab, token]` hadn't changed
- Fix: Added `refreshVer` state counter, incremented via `bump()` on save, added to useEffect deps

**Bug fix — API config add not refreshing:**
- Root cause: `AddConfigModal` only called `onClose()`, no refresh trigger
- Fix: Added `onSaved` prop to `AddConfigModal`; parent's `onSaved` calls `bump()` to trigger re-fetch

**Bug fix — Login redirect not working:**
- Root cause: `LoginSignup.exchangeFirebaseToken` set `localStorage.setItem('access_token', ...)` directly but never called `AuthContext.login()`, so AuthContext's `token` state stayed `null`
- Fix: Replaced direct localStorage set with `login(data.access_token)` from AuthContext, which updates both localStorage AND React state; AuthGuard now correctly sees `isAuthenticated === true` on redirect

**Bug fix — Language switching not working:**
- Root cause: `updateSetting('language', l)` saved to `localStorage.userSettings.language`, but `I18nContext` reads from `localStorage.preferredLanguage` — different keys
- Fix: `PersonalizationTab.handleLang` now calls `setLocale(l)` from I18nContext to sync both storage mechanisms

### Next: Phase 4 — Video Access Page
- Template: `app/templates/video_access.html` (170 lines)
- CSS: `app/static/css/video_access.css` (512 lines)
- JS: `app/static/js/video_access.js` (1010 lines)
- Backend: Video upload, analysis, reports, child selection
