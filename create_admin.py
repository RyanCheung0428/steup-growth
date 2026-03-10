"""Create or update the admin user via Firebase + local DB."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.models import db, User, UserProfile

app = create_app()

with app.app_context():
    admin_email = 'admin@gmail.com'
    admin_password = 'admin123'  # Firebase requires >= 6 chars

    # Ensure Firebase is initialized
    from app.auth import is_firebase_enabled
    if not is_firebase_enabled():
        print('ERROR: Firebase is not configured. Set FIREBASE_CREDENTIALS_PATH in .env')
        sys.exit(1)

    from firebase_admin import auth as fb_auth

    # Create or get Firebase user
    firebase_uid = None
    try:
        firebase_user = fb_auth.get_user_by_email(admin_email)
        firebase_uid = firebase_user.uid
        # Update password on Firebase side
        fb_auth.update_user(firebase_uid, password=admin_password)
        print(f'Firebase user "{admin_email}" already exists — password updated.')
    except fb_auth.UserNotFoundError:
        firebase_user = fb_auth.create_user(
            email=admin_email,
            password=admin_password,
            display_name='Admin',
            email_verified=True
        )
        firebase_uid = firebase_user.uid
        print(f'Firebase user "{admin_email}" created.')

    # Create or update local DB user
    existing_admin = User.query.filter_by(email=admin_email).first()

    if existing_admin:
        existing_admin.role = 'admin'
        existing_admin.auth_provider = 'firebase_email'
        existing_admin.firebase_uid = firebase_uid
        existing_admin.email_verified = True
        if not existing_admin.username:
            existing_admin.username = 'Admin'
        db.session.commit()
        print(f'Local admin user "{admin_email}" updated (role=admin, linked to Firebase).')
    else:
        admin = User(
            username='Admin',
            email=admin_email,
            role='admin',
            auth_provider='firebase_email',
            firebase_uid=firebase_uid,
            email_verified=True,
            display_name='Admin'
        )
        db.session.add(admin)
        db.session.flush()

        # Create default profile
        profile = UserProfile(user_id=admin.id)
        db.session.add(profile)
        db.session.commit()
        print(f'Local admin user "{admin_email}" created and linked to Firebase.')

    print(f'Admin login: email="{admin_email}", password="{admin_password}"')
