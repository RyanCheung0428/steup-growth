"""add dual-track RAG: owner_id, visibility to rag_documents

Revision ID: 64b4cf2766ea
Revises: a60dd600ed9a
Create Date: 2026-05-18 04:50:02.318051

"""
from alembic import op
import sqlalchemy as sa


revision = '64b4cf2766ea'
down_revision = 'a60dd600ed9a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('rag_documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('visibility', sa.String(length=20), nullable=False, server_default='system'))
        batch_op.create_index(batch_op.f('ix_rag_documents_owner_id'), ['owner_id'], unique=False)
        batch_op.create_foreign_key(None, 'users', ['owner_id'], ['id'], ondelete='CASCADE')
        batch_op.drop_column('scope')


def downgrade():
    with op.batch_alter_table('rag_documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('scope', sa.VARCHAR(length=20), autoincrement=False, nullable=False, server_default='system'))
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_rag_documents_owner_id'))
        batch_op.drop_column('visibility')
        batch_op.drop_column('owner_id')
