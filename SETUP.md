# Steup Growth — Setup Guide

> 📖 **Quick navigation**: [README](README.md) for project overview, tech stack, and architecture.

---

## Prerequisites

- Python 3.12+
- Node.js 18+
- npm
- (Optional) Docker & Docker Compose — for PostgreSQL database in development

> ⚠️ Copy `.credentials/` folder and `.env` file to the project root before starting.

---

## Quick Start Overview

The project has two components that run simultaneously:

| Component | Location | Port | Tech Stack |
|-----------|----------|------|------------|
| Backend (API) | `./` | 5000 | Flask + Socket.IO + ADK |
| Frontend (UI) | `./frontend/` | 3000 | React + Vite + Tailwind |

You need **two terminals** — one for the backend, one for the frontend.

---

## Backend Setup

### 1. Virtual Environment

```bash
# macOS / Linux
python -m venv .venv && source .venv/bin/activate

# Windows
python -m venv .venv; .\.venv\Scripts\Activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Generate the required security keys and add them to your `.env` file:

```bash
# SECRET_KEY / JWT_SECRET_KEY:
python -c "import secrets; print(secrets.token_urlsafe(48))"

# ENCRYPTION_KEY:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 4. Database Setup

```bash
# First time only — initialize migrations
flask db init

# Create and apply migration
flask db migrate -m "initial"
flask db upgrade
```

**Alternative**: Set `CREATE_DB_ON_STARTUP=true` in `.env` and the database will be created automatically when you start the server.

### 5. Start Backend

```bash
python run.py
# Server starts on http://localhost:5000

# Or with debug / hot-reload:
flask --debug run --host=0.0.0.0
```

---

## Frontend Setup

In a **separate terminal**:

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start development server (port 3000, proxies API to backend on port 5000)
npm run dev

# For production build:
npm run build

# Preview production build:
npm run preview
```

The Vite dev server automatically proxies these routes to the Flask backend:

| Proxy Path | Target |
|------------|--------|
| `/api` | `http://localhost:5000` |
| `/auth` | `http://localhost:5000` |
| `/chat/` | `http://localhost:5000` |
| `/socket.io` | `http://localhost:5000` (WebSocket) |
| `/static` | `http://localhost:5000` |
| `/conversations` | `http://localhost:5000` |
| `/messages` | `http://localhost:5000` |
| `/serve_file` | `http://localhost:5000` |
| `/view_rag_document` | `http://localhost:5000` |
| `/pose_detection/js` | `http://localhost:5000` |

---

## Create Admin Account

```bash
python create_admin.py
```

Default credentials:

```
username = 'admin@gmail.com'
password = 'admin123'
```

---

## Docker Development Database

For PostgreSQL + pgAdmin (instead of default SQLite):

```bash
# Start
cd .devcontainer && docker-compose up -d

# Stop
cd .devcontainer && docker-compose down

# Check status
cd .devcontainer && docker ps
```

---

## Cloud Run Deployment

```bash
gcloud run deploy steup-growth \
	--project fyp-project-4f3b7 \
	--region us-central1 \
	--platform managed \
	--source . \
	--cpu 2 \
	--memory 4Gi \
	--min-instances 0 \
	--allow-unauthenticated \
	--service-account steup-growth@fyp-project-4f3b7.iam.gserviceaccount.com \
	--add-cloudsql-instances fyp-project-4f3b7:us-central1:xiaoice \
	--set-env-vars "GOOGLE_CLOUD_PROJECT=fyp-project-4f3b7" \
	--set-secrets "SECRET_KEY=steup-growth-secret-key:latest,JWT_SECRET_KEY=steup-growth-jwt-secret:latest,ENCRYPTION_KEY=steup-growth-encryption-key:latest,FIREBASE_API_KEY=steup-growth-firebase-api-key:latest,DATABASE_URL=steup-growth-database-url:latest"
```

Production Dockerfile is at `./Dockerfile` (Flask + Gunicorn; frontend pre-built into `frontend/dist/`).

---

## Pose Detection

Enable real-time human pose tracking and action recognition through your webcam.

### Quick Start

1. **Open Steup Growth** → navigate to the main chat interface
2. **Click Pose Detection Button** → activate the pose detection mode
3. **Allow Camera Access** → grant permission when prompted
4. **Start Moving** → the system detects poses and recognizes actions in real-time

### Supported Actions

- **Standing**: Upright posture with arms at sides
- **Sitting**: Seated position with bent hips and knees
- **Walking**: Alternating leg movements
- **Raising Hands**: One or both hands above shoulder level
- **Squatting**: Bent knees with lowered hips

### Performance Tips

- Set `POSE_MODEL_COMPLEXITY=0` for faster processing on lower-end hardware
- Increase confidence thresholds for more accurate but stricter detection
- Reduce `POSE_MAX_CONCURRENT_SESSIONS` if experiencing high CPU usage

### Browser Compatibility

- For best performance, use Chrome or Edge (Chromium-based browsers)
- Safari users may need to enable camera access in System Preferences

### Privacy & Security

- ✅ Real-time processing only — no video recording or storage
- ✅ Frames immediately discarded after processing
- ✅ Secure WebSocket connections
- ✅ No third-party data sharing

---

## Useful Commands

### Backend

```bash
python run.py                              # Start Flask dev server
flask --debug run --host=0.0.0.0           # Alternative dev command
flask db migrate -m "description"          # Create a new migration
flask db upgrade                           # Apply pending migrations
```

### Frontend

```bash
cd frontend && npm run dev                 # Start Vite dev server
cd frontend && npm run build               # Production build to frontend/dist/
cd frontend && npm run preview             # Preview production build locally
```

### Admin & Database

```bash
python create_admin.py                     # Create admin account
python clear_db.py                         # Reset / clear database
python view_database.py users              # Inspect database contents
```

### Docker

```bash
cd .devcontainer && docker-compose up -d   # Start PostgreSQL + pgAdmin
cd .devcontainer && docker-compose down     # Stop all services
```

### Testing

```bash
pytest                                     # Run full test suite
pytest -v                                  # Verbose output
pytest test/path::TestClass::test_method   # Run a single test
```
