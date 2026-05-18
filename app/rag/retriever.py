"""
Vector-based knowledge retrieval for RAG.

Performs cosine similarity search on the rag_chunks table using pgvector's
<=> (cosine distance) operator, returning the most relevant chunks for a
given query along with source metadata.

All embedding calls use the project Service Account via Vertex AI — no
per-user API key is required.
"""

import logging
import os
from typing import Any, Optional

from sqlalchemy import text

from app.rag.embeddings import generate_query_embedding

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _get_top_k() -> int:
    try:
        from flask import current_app
        return current_app.config.get("RAG_TOP_K", 5)
    except RuntimeError:
        return int(os.environ.get("RAG_TOP_K", "5"))


def _get_min_similarity() -> float:
    try:
        from flask import current_app
        return current_app.config.get("RAG_MIN_SIMILARITY", 0.3)
    except RuntimeError:
        return float(os.environ.get("RAG_MIN_SIMILARITY", "0.3"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def search_knowledge(
    query: str,
    top_k: Optional[int] = None,
    min_similarity: Optional[float] = None,
    document_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """
    Search the RAG knowledge base for chunks most relevant to *query*.

    Args:
        query:          Natural-language query to search for.
        top_k:          Max results to return (default from config).
        min_similarity: Minimum cosine similarity threshold (0-1).
        document_id:    Optional filter to search within a specific document.
        user_id:        If provided, restrict results to documents explicitly enabled
                        by that user via user_rag_documents. If None, no per-user
                        filtering is applied (admin/test bypass).

    Returns:
        List of dicts sorted by similarity descending.
    """
    from app.models import db

    # Allow callers to pass None to fall back to config defaults.
    if top_k is None:
        top_k = _get_top_k()
    if min_similarity is None:
        min_similarity = _get_min_similarity()

    try:
        query_embedding = generate_query_embedding(query)
    except Exception as exc:
        logger.error("Failed to generate query embedding: %s", exc)
        return []

    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    join_user_docs = ""
    user_docs_filter = ""
    params = {
        "embedding": embedding_str,
        "doc_id": document_id,
        "min_sim": min_similarity,
        "top_k": top_k,
    }

    # If user_id is provided, restrict retrieval to documents explicitly enabled by the user.
    # System docs with no junction row are intentionally excluded until the user enables them.
    if user_id is not None:
        join_user_docs = "\n        JOIN user_rag_documents urd ON d.id = urd.document_id"
        user_docs_filter = "\n          AND urd.user_id = :user_id AND urd.enabled = TRUE"
        params["user_id"] = user_id

    sql = text(f"""
        SELECT
            c.id,
            c.content,
            c.enriched_content,
            c.heading,
            c.page_number,
            c.document_id,
            d.original_filename AS document_name,
            1 - (c.embedding <=> :embedding ::vector) AS similarity
        FROM rag_chunks c
        JOIN rag_documents d ON d.id = c.document_id{join_user_docs}
        WHERE d.status = 'ready'
          AND (:doc_id IS NULL OR c.document_id = :doc_id){user_docs_filter}
          AND 1 - (c.embedding <=> :embedding ::vector) >= :min_sim
        ORDER BY c.embedding <=> :embedding ::vector
        LIMIT :top_k
    """)

    rows = db.session.execute(sql, params).fetchall()

    results: list[dict[str, Any]] = []
    for row in rows:
        results.append({
            "chunk_id": row.id,
            "content": row.content,
            "enriched_content": row.enriched_content,
            "heading": row.heading,
            "page_number": row.page_number,
            "document_id": row.document_id,
            "document_name": row.document_name,
            "similarity": round(float(row.similarity), 4),
        })

    logger.info(
        "RAG search: query=%r -> %d results (top_k=%d, min_sim=%.2f)",
        query[:80], len(results), top_k, min_similarity,
    )
    return results


def format_context(results: list[dict[str, Any]], *, max_chars: int = 6000) -> str:
    """
    Format search results into a context string suitable for LLM injection.
    """
    if not results:
        return ""

    parts: list[str] = []
    char_count = 0

    for i, r in enumerate(results, 1):
        source = r.get("document_name", "unknown")
        page = r.get("page_number")
        heading = r.get("heading") or ""

        header = f"[Knowledge Base Reference {i} — Source: {source}"
        if page:
            header += f", p.{page}"
        if heading:
            header += f" | {heading}"
        header += f" | relevance: {r['similarity']:.0%}]"

        block = f"{header}\n{r['content']}"
        if char_count + len(block) > max_chars:
            break
        parts.append(block)
        char_count += len(block) + 2

    return "\n\n".join(parts)
