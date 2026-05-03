# Steup Growth — AGENTS.md

Child development assessment platform. Flask backend + ADK multi-agent AI + React SPA frontend.

## Quick start

```bash
# Backend (terminal 1)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python run.py
# Server on :5000

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
# Server on :3000, proxies API to :5000

# Create admin account
python create_admin.py
# Default: admin@gmail.com / admin123

# Docker PostgreSQL (optional dev DB)
cd .devcontainer && docker-compose up -d
```

## Dev commands

| What | Command |
|------|---------|
| Dev server (hot-reload) | `flask --debug run --host=0.0.0.0` |
| DB migration | `flask db migrate -m "msg" && flask db upgrade` |
| Auto-create tables | Set `CREATE_DB_ON_STARTUP=true` (dev convenience) |
| Clear DB | `python clear_db.py` |
| Full test suite | `pytest` (none exist yet — no `test/` dir) |
| Frontend build | `cd frontend && npm run build` (outputs to `frontend/dist/`) |
| Production server | `gunicorn --worker-class gthread --threads 8 -w 1 -b 0.0.0.0:${PORT} run:app` |

## Architecture

```
React SPA (:3000) <──proxy──> Flask API (:5000)  ──> ADK multi-agent (coordinator + PDF + media specialists)
                                   │
                              PostgreSQL + pgvector (RAG embeddings)
                              Google Cloud Storage (files)
                              Firebase Auth + JWT
```

## Structure

```
steup-growth/
├── app/                    # Flask backend
│   ├── agent/              # ADK multi-agent (coordinator + specialists)
│   ├── pose_detection/     # MediaPipe JS modules (NOT React)
│   └── rag/                # RAG pipeline (chunk → enrich → embed → retrieve)
├── frontend/               # React SPA (Vite + Tailwind)
│   └── src/
│       ├── components/chat/# Chat UI (12 components, Socket.IO streaming)
│       ├── contexts/       # Auth, Settings, I18n, Chat
│       └── hooks/          # useSocket, useChatApi, useFileUpload, useTTS, etc.
├── docs/                   # Architecture docs (MULTI_AGENT_SYSTEM_ARCHITECTURE.md)
├── migrations/             # Alembic versions (pgvector-compatible)
└── .devcontainer/          # PostgreSQL + pgAdmin Docker
```

Subdirectory AGENTS.md: `app/agent/`, `app/rag/`, `app/pose_detection/`, `frontend/src/components/chat/`.

### Key files

| File | Purpose |
|------|---------|
| `app/__init__.py` | App factory; creates Flask, SocketIO, JWT, DB, blueprints, SPA routes |
| `app/config.py` | All env-based config (RAG, JWT, GCS, pose, Firebase) |
| `app/models.py` | All SQLAlchemy models (User, UserProfile, UserApiKey, VertexServiceAccount, Conversation, Message, FileUpload, VideoRecord, VideoAnalysisReport, RagDocument, RagChunk, Child, PoseAssessmentRun) |
| `app/auth.py` | JWT + Firebase auth flows |
| `app/routes.py` | REST endpoints + SSE `/chat/stream` |
| `app/socket_events.py` | WebSocket events (Socket.IO) |
| `app/agent/chat_agent.py` | ADK multi-agent runner (coordinator, pdf_agent, media_agent) |
| `app/gcp_bucket.py` | GCS upload/download/delete |

### Frontend structure (React SPA)

| File | Purpose |
|------|---------|
| `frontend/src/main.jsx` | Entry: BrowserRouter > Auth > Settings > I18n > App |
| `frontend/src/App.jsx` | Route definitions (login, forgot-password, home, video, pose-detection, admin, chat) |
| `frontend/src/contexts/AuthContext.jsx` | JWT token mgmt, login/logout/refresh |
| `frontend/src/contexts/SettingsContext.jsx` | Theme/language/model/voice |
| `frontend/src/contexts/I18nContext.jsx` | Dynamic locale loader (zh-TW/en/ja/zh-CN) |
| `frontend/src/components/SettingsModal.jsx` | Full 4-tab settings (Profile, Children, Personalization, Advanced) |
| `frontend/src/index.css` | Tailwind + AE design system CSS variables |
| `frontend/vite.config.js` | Dev proxy: all `/api`, `/auth`, `/chat/`, `/socket.io`, `/static`, etc. to :5000 |

## Critical patterns (do NOT break)

### 1. All timestamps = Hong Kong Time (UTC+8)
Model timestamps use `hk_now()` from `app/models.py`, stored as timezone-naive datetimes.

### 2. API keys are Fernet-encrypted
- `ENCRYPTION_KEY` env var required for key/service-account encryption
- `UserApiKey.set_encrypted_key()` / `get_decrypted_key()` in models
- `VertexServiceAccount.set_encrypted_credentials()` / `get_decrypted_credentials()`
- **Never decrypt globally** — only when needed for AI calls
- Generate new key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

### 3. Session ID format for ADK
`conv_{user_id}_{conversation_id}` — used to persist agent sessions across messages.

### 4. Streaming prefix stripping
Both SSE (`routes.py`) and Socket.IO (`socket_events.py`) strip `Assistant:`, `AI:`, `Bot:`, `System:`, `Human:` prefixes from streamed chunks before sending to client.

### 5. Two provider modes
- **AI Studio**: uses user's `UserApiKey` where `provider = 'ai_studio'`
- **Vertex AI**: uses `VertexServiceAccount` or `UserApiKey` where `provider = 'vertex_ai'`
- Mode selected via `UserProfile.ai_provider` and `UserProfile.selected_vertex_account_id` / `selected_vertex_api_key_id`
- Vertex mode snaps/restores env vars in a `finally` block

### 6. Auth tokens in headers + cookies
JWT tokens are accepted from both `Authorization: Bearer <token>` header and `access_token` / `refresh_token` cookies. CSRF protection enabled.

### 7. Pose detection is NOT React
The pose detection page loads the original vanilla JS as dynamic scripts. The React component (`PoseDetection.jsx`) renders matching DOM IDs and loads MediaPipe CDN + Flask-served modules + original `pose_detection.js` as-is.

### 8. File upload limits
500MB max. Supported: PDF, images (jpeg/png/webp/heic/heif), videos (mp4/mov/avi/mkv/webm/flv/wmv/3gpp). Enforced in `chat_agent.py`.

### 9. GCS storage key pattern
`{user_id}/{category}/{filename_timestamp.ext}`

### 10. RAG pipeline
Documents → chunking (Gemini-based) → enrichment (background context) → embeddings (gemini-embedding-001, 1536d) → pgvector similarity search. Status flow: `pending → processing → ready | error`.

## Important DB quirks

- `User` model has **no `password_hash` column** — auth is entirely Firebase-based (password_hash was dropped in migration `59e29eb77dd3`)
- `Message.meta` is column named `metadata` in DB (using `db.JSON`)
- `RagChunk.embedding` is `Vector(1536)` from pgvector — **won't work on SQLite**
- `Message.sender` is constrained to `'user'` or `'assistant'` via `CheckConstraint`
- Soft delete on `FileUpload` via `deleted_at` column (nullable, indexed)
- Conversation titles auto-generated from first user message (60 chars max)

## Deployment

- Dockerfile: `python:3.12-slim` with WeasyPrint/Pango/cjk-font deps. Gunicorn with gthread workers.
- Cloud Run deploy command in `SETUP.md`. Secrets managed via Google Cloud Secret Manager.
- No CI workflows found yet.

## Anti-patterns

- **Do NOT set global `GOOGLE_API_KEY`** — use per-user keys cached by `ChatAgentManager`
- **Do NOT decrypt API keys globally** — decrypt only when making AI calls
- **Do NOT refactor pose detection JS** — it's vanilla JS loaded dynamically, not npm modules
- **Do NOT suppress type errors** — no `@ts-ignore`, `@ts-expect-error`, or `as any`
- **Do NOT commit `.env` or `.credentials/`** — they contain secrets (already in `.gitignore`)
- **Do NOT modify streaming prefix stripping** — both SSE and Socket.IO routes strip `Assistant:`/`AI:`/`Bot:`/`System:`/`Human:` prefixes; preserve this logic
- **Do NOT add `password_hash` column to User** — auth is Firebase-only (column was dropped)
- **Do NOT import RAG chunks without checking DB dialect** — `RagChunk.embedding` is `Vector(1536)` from pgvector; SQLite crashes on it

## Existing docs

| File | Worth reading? |
|------|----------------|
| `docs/MULTI_AGENT_SYSTEM_ARCHITECTURE.md` | ✅ Yes — detailed ADK architecture |
| `refactor.md` | ✅ Yes — React refactoring status (Phase 7 Chatbox pending) |
| `docs/llms.txt` | ⚠️ Reference — external ADK doc links |
| `.github/copilot-instructions.md` | ❌ No — verbose, generic, superseded by this file |
| `/init-deep` generated subdir AGENTS.md | ✅ `app/agent/`, `app/rag/`, `app/pose_detection/`, `frontend/src/components/chat/` |
