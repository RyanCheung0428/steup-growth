"""Regression tests for chat stream multimodal attachment flow."""

import json
import os
import sys
import uuid
from unittest.mock import patch

import pytest


sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope='session')
def app():
    os.environ.setdefault('DATABASE_URL', 'sqlite://')
    os.environ.setdefault('SECRET_KEY', 'test-secret')
    os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret')
    os.environ.setdefault('CREATE_DB_ON_STARTUP', 'true')

    from app import create_app
    test_app = create_app()
    test_app.config['TESTING'] = True
    test_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'

    with test_app.app_context():
        from app.models import db
        db.create_all()
        yield test_app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    from app.models import db as _db
    with app.app_context():
        yield _db


def _uid() -> str:
    return uuid.uuid4().hex[:8]


def _make_user(db):
    from app.models import User

    uid = _uid()
    user = User(username=f'user_{uid}', email=f'user_{uid}@test.com', role='user')
    db.session.add(user)
    db.session.commit()
    return user


def _auth_headers(user_id: int) -> dict:
    from flask_jwt_extended import create_access_token

    token = create_access_token(identity=str(user_id))
    return {'Authorization': f'Bearer {token}'}


class TestChatStreamFilePayloads:
    def test_accepts_multi_file_payload(self, app, client, db):
        """chat_stream should forward multi-file arrays to agent.generate_streaming_response."""
        from app.models import db as _db

        with app.app_context():
            user = _make_user(db)
            headers = _auth_headers(user.id)

            captured = {}

            def _fake_generate(*_args, **kwargs):
                captured['kwargs'] = kwargs
                yield 'ok'

            with patch('app.routes.agent.generate_streaming_response', side_effect=_fake_generate):
                res = client.post(
                    '/chat/stream',
                    data={
                        'message': 'Please compare these PDFs',
                        'file_urls': json.dumps([
                            'https://storage.googleapis.com/demo-bucket/1/chatbox/a.pdf',
                            'https://storage.googleapis.com/demo-bucket/1/chatbox/b.pdf',
                        ]),
                        'file_mime_types': json.dumps(['application/pdf', 'application/pdf']),
                    },
                    headers=headers,
                )

            assert res.status_code == 200
            assert res.mimetype == 'text/event-stream'
            forwarded = captured['kwargs']['file_attachments']
            assert len(forwarded) == 2
            assert forwarded[0]['path'].endswith('/a.pdf')
            assert forwarded[1]['path'].endswith('/b.pdf')
            assert forwarded[0]['mime_type'] == 'application/pdf'
            assert forwarded[1]['mime_type'] == 'application/pdf'

            _db.session.delete(user)
            _db.session.commit()


    def test_reuses_recent_conversation_attachments(self, app, client, db):
        """Follow-up messages should auto-attach files from the latest user upload message."""
        from app.models import Conversation, FileUpload, Message, db as _db

        with app.app_context():
            user = _make_user(db)
            headers = _auth_headers(user.id)

            conversation = Conversation(user_id=user.id, title='Test conversation')
            _db.session.add(conversation)
            _db.session.commit()

            url_a = 'https://storage.googleapis.com/demo-bucket/1/chatbox/alpha.pdf'
            url_b = 'https://storage.googleapis.com/demo-bucket/1/chatbox/bravo.mov'

            msg = Message(
                conversation_id=conversation.id,
                sender='user',
                content='Initial upload',
                uploaded_files=[url_a, url_b],
            )
            _db.session.add(msg)
            _db.session.commit()

            _db.session.add(
                FileUpload(
                    user_id=user.id,
                    filename='alpha.pdf',
                    file_path=url_a,
                    storage_key='1/chatbox/alpha.pdf',
                    file_type='pdf',
                    content_type='application/pdf',
                    upload_category='chatbox',
                    conversation_id=conversation.id,
                    message_id=msg.id,
                    file_size=100,
                )
            )
            _db.session.add(
                FileUpload(
                    user_id=user.id,
                    filename='bravo.mov',
                    file_path=url_b,
                    storage_key='1/chatbox/bravo.mov',
                    file_type='mov',
                    content_type='video/quicktime',
                    upload_category='chatbox',
                    conversation_id=conversation.id,
                    message_id=msg.id,
                    file_size=100,
                )
            )
            _db.session.commit()

            captured = {}

            def _fake_generate(*_args, **kwargs):
                captured['kwargs'] = kwargs
                yield 'ok'

            with patch('app.routes.agent.generate_streaming_response', side_effect=_fake_generate):
                res = client.post(
                    '/chat/stream',
                    data={
                        'message': 'Use the previous files and explain.',
                        'conversation_id': str(conversation.id),
                    },
                    headers=headers,
                )

            assert res.status_code == 200
            forwarded = captured['kwargs']['file_attachments']
            assert [item['path'] for item in forwarded] == [url_a, url_b]
            assert [item['mime_type'] for item in forwarded] == ['application/pdf', 'video/quicktime']

            _db.session.delete(conversation)
            _db.session.delete(user)
            _db.session.commit()

    def test_rejects_invalid_file_url_payload(self, app, client, db):
        """Invalid JSON array payload should return 400 with clear error."""
        from app.models import db as _db

        with app.app_context():
            user = _make_user(db)
            headers = _auth_headers(user.id)

            res = client.post(
                '/chat/stream',
                data={
                    'message': 'test',
                    'file_urls': 'not-json-array',
                },
                headers=headers,
            )

            assert res.status_code == 400
            data = res.get_json()
            assert 'file_urls' in data['error']

            _db.session.delete(user)
            _db.session.commit()