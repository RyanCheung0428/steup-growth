# Steup Growth

**Intelligent chat assistant** powered by Google ADK multi-agent AI, with multimodal support (image, video, PDF) and real-time pose detection.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=fff)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.1-000?logo=flask)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=fff)](https://react.dev)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-5.4-010101?logo=socket.io)](https://socket.io)

---

## Features

- **Multi-agent AI** — Google ADK coordinator with text, media, and PDF specialist agents
- **Real-time streaming** — Socket.IO + SSE for responsive chat
- **Multimodal** — Analyze images, videos, and PDF documents (up to 500MB)
- **Pose detection** — Real-time human pose tracking via browser webcam (MediaPipe)
- **RAG pipeline** — Document ingestion with chunking, embeddings (pgvector), and similarity retrieval
- **Secure** — JWT authentication, Fernet-encrypted API keys, Firebase Auth integration
- **Multi-language** — Chinese (Traditional), English, Japanese
- **Customizable** — Theme, language, AI model selection per user

---

## Tech Stack

### Backend

| Category | Technology |
|----------|-----------|
| Framework | Flask 3.1, Flask-SocketIO 5.4 |
| AI / Agents | Google ADK 1.24, Google GenAI 1.69, Vertex AI |
| Database | SQLAlchemy ORM, PostgreSQL + pgvector, Flask-Migrate |
| Auth | Flask-JWT-Extended, Firebase Admin, Fernet encryption |
| Storage | Google Cloud Storage |
| Processing | MediaPipe, PyMuPDF, py-zerox (OCR), Pillow, WeasyPrint |
| TTS | edge-tts |
| Testing | pytest, Hypothesis |

### Frontend

| Category | Technology |
|----------|-----------|
| Framework | React 18, react-router-dom 6 |
| Build | Vite 5, Tailwind CSS 3 |
| Real-time | socket.io-client |
| Auth | Firebase (browser SDK) |
| Rendering | react-markdown, remark-gfm |
| Detection | MediaPipe Pose (browser) |

---

## Project Structure

```
Steup Growth/
├── app/                    # Flask backend & AI agents
│   ├── agent/              #   ADK multi-agent system
│   ├── pose_detection/     #   Pose detection JS + scoring
│   └── rag/                #   RAG embeddings pipeline
├── frontend/               # React SPA (Vite + Tailwind)
│   └── src/
│       ├── pages/          #   7 page components
│       ├── components/     #   Chat UI, settings, auth guard
│       ├── contexts/       #   Auth, chat, i18n, settings
│       └── hooks/          #   Custom React hooks
├── docs/                   # Architecture & feature docs
├── migrations/             # Alembic schema versions
├── .devcontainer/          # PostgreSQL + pgAdmin (Docker)
├── Dockerfile              # Production container
└── SETUP.md                # 🔧 Setup & run instructions
```

---

## Architecture Overview

```
┌──────────────┐     REST + WebSocket      ┌──────────────┐
│  React SPA   │ ◄────────────────────────► │  Flask API   │
│  (Vite :3000)│     (proxy :5000)          │  (Socket.IO) │
└──────────────┘                            └──────┬───────┘
                                                   │
                                        ┌──────────┴──────────┐
                                        │   Google ADK Agents  │
                                        │  ┌─────────────────┐ │
                                        │  │   Coordinator   │ │
                                        │  └───┬───┬───┬─────┘ │
                                        │  ┌───┴┐ ┌┴──┐ ┌┴───┐ │
                                        │  │Text│ │Media│ │PDF │ │
                                        │  └────┘ └────┘ └────┘ │
                                        └───────────────────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                         ┌────┴────┐         ┌─────┴─────┐       ┌────┴────┐
                         │PostgreSQL│         │ Google    │       │ Firebase│
                         │+ pgvector│         │Cloud Store│       │  Auth   │
                         └─────────┘         └───────────┘       └─────────┘
```

- **Frontend**: React SPA communicates with the Flask backend via REST APIs and WebSocket (Socket.IO). Vite proxies all API routes during development.
- **Backend**: Flask app factory with Socket.IO for real-time streaming. JWT authenticates both HTTP and WebSocket connections.
- **AI Layer**: Google ADK multi-agent system — a coordinator routes user requests to text, media, and PDF specialist agents.
- **Storage**: Google Cloud Storage for file uploads. PostgreSQL with pgvector for RAG embedding vectors (SQLite for local dev).
- **Authentication**: JWT tokens (headers + secure cookies) with Firebase Authentication as an alternative provider. User API keys encrypted via Fernet.

---

## Getting Started

See the **[Setup Guide →](SETUP.md)** for detailed instructions on:

- Backend setup (virtual env, dependencies, database)
- Frontend setup (npm install, dev server)
- Admin account creation
- Docker development database
- Cloud Run deployment
- Pose detection usage
- Useful commands

```bash
# Quick start — backend (terminal 1)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python run.py

# Quick start — frontend (terminal 2)
cd frontend && npm install && npm run dev
```

---

## License

This project is developed as part of a final year project (FYP).

