# Chat Page React Migration — Full Implementation Plan

## Overview

Migrating the chat page from vanilla HTML/CSS/JS to React (Vite), following the existing project conventions in `frontend/src/`. The chat page uses a sidebar-based layout (no top nav), SSE streaming, Socket.IO for real-time events, and includes file upload, TTS, voice input, webcam capture, emoji picker, and document preview.

## Architecture

### File Structure

```
frontend/src/
├── pages/
│   └── ChatPage.jsx              # Main chat page (layout shell)
├── components/chat/
│   ├── ChatSidebar.jsx           # Conversation list, CRUD, pin/rename/delete
│   ├── ChatHeader.jsx            # Brand, title, pin, dropdown menu
│   ├── MessageList.jsx           # Scrollable message area
│   ├── MessageBubble.jsx         # Single user/bot message
│   ├── WelcomeScreen.jsx         # Empty state + capability cards
│   ├── ChatInput.jsx             # Textarea + send/stop button
│   ├── FilePreviewRail.jsx       # Thumbnail rail for selected files
│   ├── PlusMenu.jsx              # Popup menu (file/voice/webcam)
│   ├── ModelDropdown.jsx         # Flash/Pro model toggle
│   ├── EmojiPicker.jsx           # 8-category emoji selector
│   ├── WebcamModal.jsx           # Camera capture modal
│   ├── MediaViewer.jsx           # Full-screen image/video overlay
│   ├── PreviewPanel.jsx          # Document preview slide-in panel
│   └── TypingIndicator.jsx       # Animated dots
├── hooks/
│   ├── useChatApi.js             # SSE streaming + message/conversation REST
│   ├── useSocket.js              # Socket.IO connection with JWT auth
│   ├── useConversations.js       # Conversation CRUD + cache
│   ├── useTTS.js                 # Browser + server-side TTS
│   ├── useVoiceInput.js          # Web Speech API
│   ├── useTypewriter.js          # requestAnimationFrame typewriter animation
│   └── useFileUpload.js          # File selection, preview, upload
├── lib/
│   └── markdown.js               # react-markdown wrapper with code highlight
├── contexts/
│   └── ChatContext.jsx            # Shared chat state
└── data/
    └── emojis.json               # (already exists)
```

### Route Change in App.jsx

Replace the placeholder at `/chat`:
```jsx
// Before:
<Route path="/chat" element={<div className="p-8 text-ae-textMuted">Chatbox — Phase 7</div>} />

// After:
<Route path="/chat" element={<ChatPage />} />
```

The chat page uses its own `ChatProvider` and does NOT use `AppShellLayout` (no top nav).

### Dependencies Added

```
react-markdown        # Markdown rendering
remark-gfm            # GitHub-flavored markdown
rehype-highlight      # Code syntax highlighting
socket.io-client      # Already in package.json, now actually used
```

---

## Component Specifications

### ChatPage.jsx

Layout shell component. Wraps content in `ChatProvider`. 3-column flex/grid layout:

- Left: `ChatSidebar` (340px, collapsible to 56px)
- Center: Chat area (header + messages/welcome + input)
- Right: `PreviewPanel` (conditionally shown)

State: `sidebarCollapsed`, `previewActive`, `previewContent`

Responsive:
- ≤1024px: sidebar collapses, column stack
- ≤700px: hide model dropdown, full-width bubbles

CSS: All styles via Tailwind utility classes + `ae-*` design system from `index.css` + new chat-specific CSS added to `index.css`.

### ChatSidebar.jsx

Left panel containing:
- Toggle button (`fa-bars`) to collapse/expand
- Navigation links (Home, Pose, Video) — use React Router `<Link>`
- Chat section header "聊天" + conversation list
- Conversation items: icon + title, active state, dropdown menu (pin/rename/delete)
- Footer: New Chat button, Settings button (opens `SettingsModal`), Logout button

Uses `useConversations` hook for CRUD operations.
Calls `window.dispatchEvent(new CustomEvent('open-settings'))` for settings (matches existing React pattern).
Logout via `AuthContext.logout()`.

### ChatHeader.jsx

3-column grid header:
- Left: Sidebar show button (when sidebar collapsed) + Brand link "Steup Growth"
- Center: Conversation title + Pin toggle button
- Right: 3-dot menu button → dropdown (Pin/Rename/Delete)

Only shows actions when a conversation is active.

### MessageList.jsx

Scrollable flex-column container. Renders messages from `ChatContext`:
- User messages: right-aligned with user avatar, primary color bubble
- Bot messages: left-aligned with bot avatar, surface color bubble + TTS button
- Typing indicator: animated dots when streaming starts, hidden on first chunk

Auto-scrolls to bottom on new messages. Preserves scroll position when new content arrives at bottom.

### MessageBubble.jsx

Single message component. Props: `message`, `isUser`, `onFileClick`, `onTTS`

- Avatar: User avatar from `window.userAvatar` (or `AuthContext.user.avatar`), bot avatar from settings `/api/user/profile`
- Content: `react-markdown` with `remark-gfm` and `rehype-highlight`
- File display: images show inline thumbnail, videos show video thumbnail, PDFs show file info chip — all clickable
- TTS button (bot only): volume-up icon, toggles to stop icon while speaking
- Timestamp: `created_at` formatted

Markdown rendering uses `react-markdown` with:
- Code blocks with syntax highlighting
- Headings (h2-h4)
- Bold, italic, links
- Numbered/bullet lists
- XSS sanitization (built into react-markdown)

### WelcomeScreen.jsx

Centered content shown when no conversation is active:
- Avatar circle with stethoscope icon
- "Steup Growth AI" title
- Subtitle from i18n: `welcomeMsg`
- 3 capability pills: `welcome.capability.review`, `welcome.capability.summarize`, `welcome.capability.explain`

### ChatInput.jsx

Input area at bottom of chat:
- `FilePreviewRail` (shows when files selected)
- Input field wrapper (bordered, rounded):
  - Plus button (left) → opens `PlusMenu`
  - Textarea (auto-growing, max 140px)
  - Model button → opens `ModelDropdown`
  - Send button (paper-plane icon, switches to stop-circle when streaming)
- Hidden `<input type="file">` triggered by plus menu file upload

Keyboard: Enter sends, Shift+Enter newline.
When `isStreaming` is true, send button becomes stop button that calls `abortRef.current.abort()`.

### FilePreviewRail.jsx

Horizontal flex container above textarea:
- Image/video files: thumbnail chip (90x64px) with hover X button
- Other files (PDF etc): filename chip with X button
- Shows/hides based on `selectedFiles.length > 0`

### PlusMenu.jsx

Popup menu anchored above plus button:
- "Upload File" — triggers file input click
- "Voice Input" — starts/stops voice recording (pulse animation when recording)
- "Webcam" — opens `WebcamModal`
- Closes on outside click (useEffect with document click listener)

### ModelDropdown.jsx

Popup menu anchored above model button:
- Flash option: `gemini-3-flash-preview` (fast, daily chat)
- Pro option: `gemini-3.1-pro-preview` (powerful, deep analysis)
- Active state indicated with highlight
- Calls `POST /api/user/model` on selection
- Syncs with `SettingsContext.aiModel`

### EmojiPicker.jsx

Popup below input area:
- 8 category tabs: smileys, gestures, animals, food, activities, travel, objects, symbols
- Grid of emojis loaded from `src/data/emojis.json`
- Click inserts emoji at cursor position in textarea
- Closes on outside click

### WebcamModal.jsx

Fixed overlay modal:
- Video stream from `getUserMedia({ facingMode: 'user' })`
- Capture button: draws frame to hidden canvas, converts to File
- Retake button: restarts stream
- Use Photo button: adds captured File to `selectedFiles`
- Close button (X)

### MediaViewer.jsx

Full-screen overlay for clicking inline images/videos:
- Backdrop blur + dark overlay
- Image/video centered at max 90vw/90vh
- Close button (top-right X)
- Escape key closes
- Fade-in/fade-out animation

### PreviewPanel.jsx

Slide-in panel from right side:
- Header with title "文件預覽" + close button
- Content area: renders image, video, PDF (iframe), or generic file info
- 3-column grid layout when active: `grid-template-columns: 340px minmax(0, 0.95fr) minmax(360px, 0.75fr)`
- Animation: translates in from right

### TypingIndicator.jsx

Simple animated dots: `• • •` with staggered opacity animation.

---

## Hook Specifications

### useChatApi.js

```js
// Returns: { streamMessage, createConversation, addMessage, fetchMessages, abortStream }
```

- `streamMessage(params)`: POST to `/chat/stream` with FormData. Reads SSE stream via `ReadableStream`. Calls `onChunk(text)`, `onComplete()`, `onError(err)`. Returns `AbortController`.
- `createConversation(title?)`: POST `/conversations`
- `addMessage(convId, content, sender, metadata?, files?, tempId?)`: POST `/messages`
- `fetchMessages(convId)`: GET `/conversations/{id}/messages`
- `abortStream()`: Aborts current stream via `abortRef`

SSE parsing: Read `ReadableStream`, split on `\n\n`, for lines starting with `data: `, `JSON.parse()` the content. Strip AI prefixes (Assistant:, AI:, Bot:, System:, Human:) client-side (belt-and-suspenders since server also strips).

Auth: Uses `token` from `AuthContext`. On 401, attempts token refresh via `useAuth().refreshToken()` then retries.

### useSocket.js

```js
// Returns: { connect, disconnect, joinRoom, leaveRoom }
```

- Creates `io()` connection with `auth: { token }`
- On `connect`: stores `socket`
- On `new_message`: if `temp_id` matches an optimistic message, mark confirmed (don't re-render media). Otherwise, add to messages.
- On `idle_timeout`: show alert and redirect to login
- On `refresh_required`: disconnect and show refresh prompt
- `joinRoom(convId)`: emits `join_room`
- `leaveRoom(convId)`: emits `leave_room`
- Idle monitoring: sends `client_activity` every 15 seconds on user interaction (click, keydown, scroll, touch)

### useConversations.js

```js
// Returns: { conversations, loadConversations, createConversation, renameConversation, togglePin, deleteConversation, openConversation }
```

- Caches conversations in ref
- Sorted: pinned first, then by `updated_at` desc
- `openConversation(id)`: loads messages, sets active conversation, hides welcome screen

### useTTS.js

```js
// Returns: { speak, stop, isSpeaking }
```

- `speak(text, lang)`: Tries server-side TTS first (`POST /api/tts`), falls back to browser `SpeechSynthesis`
- Server TTS: Prefetches audio blob, plays via `Audio` element
- Browser TTS: Uses `SpeechSynthesisUtterance` with voice selection per language
- `stop()`: Stops current playback
- Text cleaning: Strips markdown, URLs, citations, code before speech
- Auto-refreshes JWT on 401 before TTS fetch

### useVoiceInput.js

```js
// Returns: { isRecording, startRecording, stopRecording }
```

- Uses `window.SpeechRecognition` or `webkitSpeechRecognition`
- Language mapping: zh-TW, en-US, ja-JP
- `onresult`: sets transcript text, inserts into textarea
- Handles permission denied and not-supported errors

### useTypewriter.js

```js
// Returns: { start, append, done, flush, elementRef }
```

- `start(el)`: clears element, starts rAF loop rendering 1 char per frame
- `append(text)`: adds text to buffer
- `done(callback)`: sets on-complete callback
- `flush()`: renders all buffered text immediately (for errors/abort)
- ~60 chars/second at 60fps

### useFileUpload.js

```js
// Returns: { selectedFiles, addFiles, removeFile, getFileUrl, revokeAllUrls, clearFiles }
```

- Validates MIME type and size (500MB max)
- Creates object URLs for image/video previews
- Revokes URLs on file removal
- MIME type mapping for common file types

---

## CSS Strategy

All chat-specific styles are added to `frontend/src/index.css` in a new `@layer components` section, following the existing pattern of `ae-*` component classes. This avoids creating separate CSS files and keeps everything in the Tailwind + CSS variable design system.

Key new CSS classes:
- `.chat-page` — full viewport height, flex layout (matches `.chatbox-page`)
- `.chat-sidebar` — 340px width, collapsible
- `.chat-container` — flex column, flex-grow
- `.message-content` — max-width 78%/760px, bubble styling
- `.user-message`, `.bot-message` — alignment and color
- `.preview-panel` — slide-in right panel
- `.plus-menu`, `.model-dropdown` — popup menus
- `.emoji-picker` — category tabs + grid
- `.webcam-modal` — fixed overlay
- `.media-viewer-overlay` — fullscreen backdrop blur

Dark mode is handled automatically via `var(--ae-*)` CSS variables that switch with `.dark-theme` class.

---

## Implementation Order

### Step 1: Core Infrastructure
1. `ChatContext.jsx` — shared state
2. `useChatApi.js` — SSE streaming + REST API
3. `useSocket.js` — Socket.IO connection
4. `useConversations.js` — conversation CRUD
5. `lib/markdown.js` — react-markdown wrapper
6. Add chat CSS to `index.css`

### Step 2: Layout & Sidebar
7. `ChatPage.jsx` — layout shell
8. `ChatSidebar.jsx` — conversation list + nav
9. `ChatHeader.jsx` — header with dropdown menu
10. `App.jsx` — route update

### Step 3: Messages & Streaming
11. `MessageList.jsx` — scrollable message area
12. `MessageBubble.jsx` — single message with markdown
13. `WelcomeScreen.jsx` — empty state
14. `TypingIndicator.jsx` — animated dots
15. `useTypewriter.js` — typewriter effect hook

### Step 4: Input & Controls
16. `ChatInput.jsx` — textarea + send/stop
17. `PlusMenu.jsx` — popup menu
18. `ModelDropdown.jsx` — model selection
19. `useFileUpload.js` — file handling
20. `FilePreviewRail.jsx` — selected file thumbnails

### Step 5: File Upload & Media
21. `WebcamModal.jsx` — camera capture
22. `MediaViewer.jsx` — fullscreen overlay
23. `PreviewPanel.jsx` — slide-in document preview

### Step 6: Audio & Emoji
24. `EmojiPicker.jsx` — emoji selector
25. `useTTS.js` — text-to-speech
26. `useVoiceInput.js` — speech recognition

### Step 7: Integration Polish
27. Socket.IO event handlers in `ChatInput` / `MessageList`
28. i18n string integration
29. Responsive breakpoints
30. Dark mode testing

---

## Key Behavioral Notes

1. **Optimistic UI**: User messages render immediately with local blob URLs. When `new_message` Socket event arrives with matching `temp_id`, do NOT replace media (anti-flicker pattern from original `chatbox.js`).

2. **SSE Streaming Flow**: 
   - POST `/chat/stream` with FormData (`message`, `conversation_id`, `file_urls`, `file_mime_types`, `history`)
   - Read `ReadableStream`, parse `data: "..."` lines, `JSON.parse()` each chunk
   - Each chunk appends to typewriter animation
   - On complete: save assistant message via `POST /messages`
   - On error: flush typewriter, show error message

3. **Conversation Lifecycle**:
   - New message with no `conversation_id` → create conversation first → then stream
   - Switching conversations → `leave_room` old, `join_room` new
   - Deleting active conversation → show welcome screen
   - Pin/rename/delete → update cache, re-render sidebar

4. **Model Toggle Sync**: `ModelDropdown` calls `POST /api/user/model` and also updates `SettingsContext.aiModel` via `updateSetting('aiModel', model)` so settings modal stays in sync.

5. **Auto-scroll**: `MessageList` scrolls to bottom on new messages unless user has scrolled up more than 100px from bottom (in which case don't force scroll).

6. **Sidebar responsive**: Auto-collapse at ≤1024px viewport width via `useEffect` with `ResizeObserver`. Manual toggle overrides auto-state.

7. **Idempotent TTS**: Only one TTS playback at a time. Starting a new one stops the previous. Server TTS prefetch starts after streaming completes.