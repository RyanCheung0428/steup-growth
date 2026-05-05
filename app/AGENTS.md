# app/ — Flask Backend

Flask app factory + Socket.IO + ADK multi-agent AI + RAG pipeline. ~14K Python lines across 13 top-level modules.

## Entry points

| File | Role |
|------|------|
| `__init__.py` | `create_app()` factory: Flask, SocketIO, JWT, DB, blueprints, SPA routes. Also exports `get_app()` for background threads. |
| `run.py` (root) | Dev entry: `create_app()` → `socketio.run()` |

## Key files

| File | Lines | Purpose |
|------|-------|---------|
| `routes.py` | 1747 | REST endpoints + SSE `/chat/stream` |
| `auth.py` | 973 | JWT + Firebase auth flows |
| `models.py` | 750 | All SQLAlchemy models (12 model classes) |
| `socket_events.py` | 467 | WebSocket events (Socket.IO) |
| `admin_routes.py` | 1101 | Admin dashboard routes |
| `video_access_routes.py` | 988 | Controlled video access + analysis |
| `config.py` | 171 | All env-based config (RAG, JWT, GCS, pose, Firebase) |
| `gcp_bucket.py` | 388 | GCS upload/download/delete |
| `report_generator.py` | 447 | PDF/JSON report generation |
| `video_processor.py` | ~250 | Video upload analysis pipeline |
| `video_cleanup.py` | ~80 | Background cleanup |

## Flask conventions

- **App factory**: `create_app()` in `__init__.py`. Blueprints registered inside factory.
- **SocketIO**: Module-level singleton (`socketio = SocketIO(...)`) created BEFORE factory, re-initialized with `socketio.init_app(app)` inside factory.
- **`_app_instance` global**: Set at end of `create_app()`. Used by `get_app()` for background threads that need Flask app context.
- **SPA routing**: `_register_spa_routes()` serves built React SPA in production from `frontend/dist/`. Vite only used in dev.
- **Auth decorators**: `@jwt_required()` on protected endpoints. Tokens from headers AND cookies.
- **Error handling**: Try/except prevalent. Socket.IO uses dedicated `_format_error_message()` in chat_agent.

## Config system

- `app/config.py`: `class Config` with 60+ env-based config keys. Fallback chain: `os.environ` → class defaults.
- `apply_runtime_google_credentials()`: Cloud Run uses ADC (attached SA), not `GCS_CREDENTIALS_PATH`.
- Key groups: `RAG_*` (15+ vars), `POSE_*`, `SOCKETIO_*`, `JWT_*`, `FIREBASE_*`.

## DB quirks

- `User` model has **no `password_hash`** — auth is Firebase-only (dropped in migration `59e29eb77dd3`).
- `Message.meta` stored as column `metadata` (SQLAlchemy reserved keyword mapped via `db.JSON`).
- `RagChunk.embedding` = `Vector(1536)` from pgvector — **SQLite will crash**. No dialect check at runtime.
- `Message.sender` constrained to `'user'` / `'assistant'` via `CheckConstraint`.
- Soft delete on `FileUpload` via `deleted_at` column (nullable, indexed).
- All timestamps use `hk_now()` (UTC+8, timezone-naive).

## Anti-patterns (Flask-specific)

- **Do NOT** set global `GOOGLE_API_KEY` — use per-user keys cached by `ChatAgentManager`.
- **Do NOT** decrypt API keys globally — decrypt only when making AI calls.
- **Do NOT** modify streaming prefix stripping — both SSE and Socket.IO strip `Assistant:`/`AI:`/`Bot:`/`System:`/`Human:`.
- **Do NOT** add `password_hash` to User — auth is Firebase-only.
- **Do NOT** import RAG chunks without PostgreSQL — pgvector `Vector(1536)` crashes SQLite.
- **Do NOT** suppress type errors — no `@ts-ignore`, `@ts-expect-error`, or `as any`.
