# frontend/src/hooks/ — Custom React Hooks

7 custom hooks for Socket.IO, REST APIs, file uploads, TTS, and voice input.

## Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useSocket` | `useSocket.js` | Socket.IO client singleton — connect, disconnect, event listeners |
| `useChatApi` | `useChatApi.js` | REST API calls for conversations, messages, streaming |
| `useConversations` | `useConversations.js` | Conversation list CRUD + state management |
| `useFileUpload` | `useFileUpload.js` | File upload with progress tracking, preview generation |
| `useTTS` | `useTTS.js` | Text-to-speech playback (edge-tts backend) |
| `useTypewriter` | `useTypewriter.js` | Typewriter text animation effect |
| `useVoiceInput` | `useVoiceInput.js` | Browser speech recognition for voice input |

## Key patterns

### Module-level Socket.IO singleton (`useSocket.js`)

```js
let _socket = null  // module-level, survives HMR teardown
```

Intentional — avoids EPIPE errors from rapid mount/unmount. Reconnects on auth change. JWT token passed as `auth` field via `io(url, { auth: { token } })`.

### JWT token patterns

All hooks read tokens from `localStorage`:
- `access_token` — sent as `Authorization: Bearer <token>` header
- `refresh_token` — used to silently refresh when 401 received

`useChatApi.js` implements automatic token refresh on 401 responses before retrying the failed request.

### File upload flow (`useFileUpload.js`)

Multi-step with progress tracking:
1. Client-side validation (size, type)
2. Generate preview (URL.createObjectURL)
3. XHR upload with `onprogress` handler
4. GCS URL returned for attachment to message

### API base

All hooks use `API_BASE` from `../lib/apiBase.js` — differs between development (Vite proxy) and production (Cloudflare Pages env var).

## Anti-patterns

- **Do NOT** remove the module-level `_socket` singleton pattern — it prevents WebSocket reconnect storms during React HMR.
- **Do NOT** change auth token storage from `localStorage` without updating all hooks and AuthContext.
