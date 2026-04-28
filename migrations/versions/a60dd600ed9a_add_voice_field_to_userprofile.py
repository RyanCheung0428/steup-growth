"""add voice field to UserProfile

Revision ID: a60dd600ed9a
Revises: 9f1c2a8d4e73
Create Date: 2026-04-28 01:48:57.638661

"""
from alembic import op
import sqlalchemy as sa


revision = 'a60dd600ed9a'
down_revision = '9f1c2a8d4e73'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('voice', sa.String(length=50), nullable=True))


def downgrade():
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.drop_column('voice')
