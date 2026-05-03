# frontend/src/components/chat/ — Chat UI Components

12 React components for the AI chat interface. Phase 7 of React refactoring (pending completion).

## Components

| Component | Role |
|-----------|------|
| `ChatHeader.jsx` | Conversation header (title, actions) |
| `ChatSidebar.jsx` | Conversation list sidebar |
| `FilePreviewRail.jsx` | File attachment preview strip |
| `MediaViewer.jsx` | Image/video content viewer |
| `MessageBubble.jsx` | Single message render (user + assistant) |
| `MessageList.jsx` | Message list with auto-scroll |
| `ModelDropdown.jsx` | AI model selector |
| `PlusMenu.jsx` | Additional actions (upload, webcam, etc.) |
| `PreviewPanel.jsx` | Side/preview panel |
| `TypingIndicator.jsx` | "Assistant is typing..." indicator |
| `WebcamModal.jsx` | Webcam capture modal |
| `WelcomeScreen.jsx` | Empty state / welcome screen |

## Integration

- Consumes: `AuthContext`, `SettingsContext`, `I18nContext`, `ChatContext` from `frontend/src/contexts/`
- Hooks: `useSocket.js` (Socket.IO), `useChatApi.js` (REST), `useConversations.js`, `useFileUpload.js` from `frontend/src/hooks/`
- Styling: Tailwind CSS + `ae-*` design system variables from `frontend/src/index.css`
- Dark mode via `.dark-theme` class on `<html>`

## Streaming

Two surfaces for AI responses:
- **SSE**: `POST /chat/stream` → `data: <json>\n\n`
- **Socket.IO**: `send_message` event → `ai_response_chunk` event

Server strips `Assistant:`, `AI:`, `Bot:`, `System:`, `Human:` prefixes from chunks. Chat components should handle raw content only.
