# frontend/src/contexts/ — React Contexts

4 React context providers wrapping the entire app. No prop drilling — components consume contexts directly.

## Contexts

| Context | File | Provides |
|---------|------|----------|
| `AuthContext` | `AuthContext.jsx` | JWT token lifecycle (storage, refresh, logout), user identity |
| `SettingsContext` | `SettingsContext.jsx` | Theme (`dark`/`light`), language (`zh-TW`/`en`/`ja`/`zh-CN`), AI model, voice |
| `I18nContext` | `I18nContext.jsx` | Dynamic locale loader — fetches `{lang}.json` on language change, provides `t(key)` |
| `ChatContext` | `ChatContext.jsx` | Active conversation, messages array, streaming state, typing indicator |

## Provider nesting (in `main.jsx`)

```
<AuthProvider>        ← outermost (everything depends on auth)
  <SettingsProvider>  ← needs auth for user profile sync
    <I18nProvider>    ← needs settings for language
      <App />
    </I18nProvider>
  </SettingsProvider>
</AuthProvider>
```

`ChatContext` is NOT in the global tree — it wraps only the ChatPage route to avoid unnecessary re-renders on other pages.

## Key patterns

### Auth token lifecycle

- Tokens stored in `localStorage` (`access_token`, `refresh_token`)
- Auto-refresh on 401 responses
- `login()` → POST `/auth/login` → stores tokens → fetches user profile
- `logout()` → clears localStorage → redirects to `/login`
- `AuthGuard` component wraps protected routes

### Settings persistence

- Settings loaded from backend (`/api/profile`) on mount
- Changes persisted via `PUT /api/profile`
- Theme toggles `.dark-theme` class on `<html>` element

### I18n dynamic loading

- Locale files in `frontend/src/i18n/{lang}.json`
- `I18nContext` fetches and caches locale data
- `t('key.path')` for translation lookup with dot-notation keys
- Falling back to key path when translation missing

### Chat state

- `ChatContext` manages: active conversation ID, messages array, streaming flag, typing users
- Chat components import directly: `const { messages, sendMessage } = useContext(ChatContext)`
- No prop drilling through the chat component tree

## Anti-patterns

- **Do NOT** change the provider nesting order — Auth must be outermost.
- **Do NOT** move `ChatContext` into the global tree — it causes unnecessary re-renders on non-chat pages.
- **Do NOT** store non-serializable objects (class instances, functions) in settings state — they're persisted to backend JSON.
