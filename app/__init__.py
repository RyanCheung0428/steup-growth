import os
import logging
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo
from flask import Flask, abort, request, send_from_directory
from dotenv import load_dotenv
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from .config import apply_runtime_google_credentials

# Load environment variables from .env file
load_dotenv()

# Import the shared `db` instance from models and create a Migrate instance
from .models import db, User
migrate = Migrate()
jwt = JWTManager()

# Initialize Flask-SocketIO (used by socket_events and run.py)
from flask_socketio import SocketIO


def _get_socketio_async_mode() -> Literal['threading', 'eventlet', 'gevent', 'gevent_uwsgi']:
    allowed = {'threading', 'eventlet', 'gevent', 'gevent_uwsgi'}
    raw_mode = os.environ.get('SOCKETIO_ASYNC_MODE')
    if raw_mode is not None:
        normalized_mode = raw_mode.strip().lower()
        if normalized_mode in allowed:
            return normalized_mode  # type: ignore[return-value]
    return 'threading'


def _build_cors_origin_checker(origins_str: str):
    """Build a callable for SocketIO cors_allowed_origins that checks exact origins and pages.dev suffix.
    
    Returns a function that:
    1. Allows all origins if '*' is in the origins list
    2. Allows exact matches from the comma-separated origins list
    3. Allows Cloudflare Pages preview subdomains for steup-growth (*.steup-growth.pages.dev)
    """
    origins = [o.strip() for o in origins_str.split(',') if o.strip()]
    
    def checker(origin):
        if not origin or '*' in origins:
            return True
        if origin in origins:
            return True
        # Allow Cloudflare Pages preview subdomains for steup-growth
        if origin.endswith('.steup-growth.pages.dev') or origin == 'https://steup-growth.pages.dev':
            return True
        return False
    
    return checker


# Read CORS origins from environment variable
_cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', '*')
_cors_checker = _build_cors_origin_checker(_cors_origins)

# Create the SocketIO server instance with CORS
socketio = SocketIO(
    cors_allowed_origins=_cors_checker if _cors_origins != '*' else '*',
    async_mode=_get_socketio_async_mode(),
)

# Module-level holder for the created app; set by create_app() so that
# background threads (e.g. ADK agent tools) can push an app context even
# when no Flask request context is active.
_app_instance = None


class _LiteLLMNoiseFilter(logging.Filter):
    """Drop known noisy LiteLLM warnings that are non-actionable."""

    _NOISY_MESSAGES = (
        "No text in user content. Adding a blank text to user content",
    )

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not any(noise in msg for noise in self._NOISY_MESSAGES)


def _build_timezone_converter(timezone_name: str):
    """Return a logging converter function for the requested timezone."""
    try:
        tz = ZoneInfo(timezone_name)
    except Exception:
        tz = ZoneInfo('UTC')

    def _converter(*args):
        # logging may call this as converter(created) or as a bound method.
        timestamp = args[-1]
        return datetime.fromtimestamp(timestamp, tz).timetuple()

    return _converter


def _configure_logging() -> None:
    """Configure consistent logging across all startup modes."""
    app_log_level = os.environ.get('APP_LOG_LEVEL', 'INFO').upper()
    rag_log_level = os.environ.get('RAG_LOG_LEVEL', 'DEBUG').upper()
    log_timezone = os.environ.get('APP_LOG_TIMEZONE', 'Asia/Hong_Kong')

    # Apply timezone globally for all standard logging formatters.
    logging.Formatter.converter = _build_timezone_converter(log_timezone)

    logging.basicConfig(
        level=getattr(logging, app_log_level, logging.INFO),
        format='[%(asctime)s] %(levelname)s in %(name)s: %(message)s',
        force=True,
    )

    # Ensure RAG pipeline logs are always visible regardless of runner.
    logging.getLogger('app.rag').setLevel(getattr(logging, rag_log_level, logging.DEBUG))
    logging.getLogger('app.rag.chunker').setLevel(getattr(logging, rag_log_level, logging.DEBUG))
    logging.getLogger('app.rag.enricher').setLevel(getattr(logging, rag_log_level, logging.DEBUG))
    logging.getLogger('app.rag.processor').setLevel(getattr(logging, rag_log_level, logging.DEBUG))

    # Reduce LiteLLM noise while keeping real warnings/errors visible.
    litellm_level = os.environ.get('LITELLM_LOG_LEVEL', 'WARNING').upper()
    for logger_name in ('LiteLLM', 'litellm'):
        target = logging.getLogger(logger_name)
        target.setLevel(getattr(logging, litellm_level, logging.WARNING))
        target.addFilter(_LiteLLMNoiseFilter())


def get_app():
    """Return the current Flask app instance (or None if not yet created)."""
    return _app_instance


def _register_spa_routes(app: Flask) -> None:
    """Serve the built React app for canonical browser routes only."""
    frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    spa_index = os.path.join(frontend_dist, 'index.html')

    if not os.path.exists(spa_index):
        return

    spa_routes = (
        '/',
        '/login',
        '/forgot-password',
        '/chat',
        '/video',
        '/pose-detection',
        '/admin',
    )

    for route in spa_routes:
        endpoint = f"spa_{route.strip('/').replace('-', '_') or 'root'}"

        def _serve_spa_index():
            return send_from_directory(frontend_dist, 'index.html')

        app.add_url_rule(route, endpoint, _serve_spa_index)

    @app.route('/assets/<path:filename>')
    def serve_spa_asset(filename):
        """Serve emitted Vite asset files from the React build output."""
        return send_from_directory(os.path.join(frontend_dist, 'assets'), filename)

    @app.route('/<path:filename>')
    def serve_spa_file(filename):
        """Serve static files emitted at the top level of the React build."""
        file_path = os.path.join(frontend_dist, filename)
        if os.path.isfile(file_path):
            return send_from_directory(frontend_dist, filename)
        abort(404)


def create_app():
    """Create and configure an instance of the Flask application."""
    _configure_logging()
    app = Flask(__name__)

    # Load configuration from app/config.py
    app.config.from_object('app.config.Config')

    # Runtime credentials policy:
    # - Local: use GCS_CREDENTIALS_PATH
    # - Cloud Run: use attached service account (ADC)
    apply_runtime_google_credentials(app.config)

    # Initialize database (SQLAlchemy)
    db.init_app(app)
    
    # Initialize Flask-Migrate to expose `flask db` commands
    try:
        migrate.init_app(app, db)
    except Exception:
        # If flask-migrate is not available or fails, continue without CLI commands
        pass
    
    # Initialize Flask-JWT-Extended
    jwt.init_app(app)

    # Initialize Flask-SocketIO with the app
    # Parse CORS origins from config and build checker for pages.dev wildcard support
    cors_origins_str = app.config.get('CORS_ALLOWED_ORIGINS', '*')
    cors_checker = _build_cors_origin_checker(cors_origins_str)
    socketio.init_app(
        app,
        cors_allowed_origins=cors_checker if cors_origins_str != '*' else '*',
        ping_timeout=app.config.get('SOCKETIO_PING_TIMEOUT', 60),
        ping_interval=app.config.get('SOCKETIO_PING_INTERVAL', 25),
    )

    # Add CORS headers for HTTP endpoints (REST + SSE)
    @app.after_request
    def _add_cors_headers(response):
        origin = request.headers.get('Origin')
        if not origin:
            return response
        
        cors_origins_val = app.config.get('CORS_ALLOWED_ORIGINS', '*')
        if cors_origins_val == '*':
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            return response
        
        allowed = [o.strip() for o in cors_origins_val.split(',') if o.strip()]
        if origin in allowed or origin.endswith('.steup-growth.pages.dev') or origin == 'https://steup-growth.pages.dev':
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
            if request.method == 'OPTIONS':
                response.status_code = 204
        
        return response

    # Initialize Firebase Admin SDK (optional — gracefully disabled if not configured)
    from .auth import init_firebase
    init_firebase(app)

    # Create an uploads folder if it doesn't exist
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    # Register blueprints
    from . import routes
    from . import auth
    from . import admin_routes
    # Video endpoints extracted to a separate module (renamed)
    from . import video_access_routes

    app.register_blueprint(routes.bp)
    app.register_blueprint(auth.auth_bp)
    app.register_blueprint(admin_routes.admin_bp)
    app.register_blueprint(video_access_routes.bp)

    # Import socket events to register WebSocket handlers (must be after socketio exists)
    from . import socket_events
    
    # Register additional static routes for video questions
    videos_quesyions_path = os.path.join(os.path.dirname(__file__), 'videos_quesyions')
    if os.path.exists(videos_quesyions_path):
        @app.route('/static/videos_quesyions/<path:filename>')
        def serve_videos_quesyions(filename):
            return send_from_directory(videos_quesyions_path, filename)

    # Serve the built React SPA for canonical browser routes only.
    _register_spa_routes(app)

    # Optionally create tables on startup (development convenience)
    if app.config.get('CREATE_DB_ON_STARTUP'):
        try:
            with app.app_context():
                # Ensure pgvector extension exists (required for RAG vector columns)
                if 'postgresql' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
                    try:
                        db.session.execute(db.text('CREATE EXTENSION IF NOT EXISTS vector'))
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
                db.create_all()
        except Exception:
            # If create_all fails, don't crash the app startup; log is available when running
            pass

    # Store reference so background threads can push an app context
    global _app_instance
    _app_instance = app

    return app
