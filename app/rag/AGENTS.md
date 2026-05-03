# app/rag/ — RAG Pipeline

Document → chunk → enrich → embed → retrieve pipeline. ~2800 lines across 6 modules.

## Files

| File | Purpose |
|------|---------|
| `__init__.py` | Public API: `process_document`, `search_knowledge`, `delete_document_data`, `enrich_chunks` |
| `chunker.py` (1711) | ZeroX PDF→markdown → heading-aware chunking → secondary split (800 chars, 100 overlap) |
| `embeddings.py` (248) | `gemini-embedding-001` via Vertex AI SA, 1536d |
| `enricher.py` (294) | Gemini adds 1–2 sentence background summary per chunk |
| `processor.py` (396) | Orchestrator: GCS download → chunk → enrich → embed → DB store |
| `retriever.py` (155) | pgvector `<=>` cosine similarity, configurable top_k + min_similarity |

## Key facts

- **Uses project Vertex AI service account** — NOT per-user API keys (unlike `app/agent/`)
- **embedding = `Vector(1536)` from pgvector** — **WILL NOT WORK on SQLite**, only PostgreSQL
- Status flow: `pending → processing → ready | error`
- GCS path: `RAG/{uuid}_{filename}`
- Env config: `app/config.py` has 15+ `RAG_*` vars
- Supported input formats: PDF, TXT, MD
- Batch: max 10 files/upload, 2 concurrent workers

## Pipeline flow

```
GCS download → ZeroX OCR (PDF) → heading-based chunks → char-split (800/100)
→ Gemini enrichment → vertex-embedding-001 → pgvector INSERT
                                     → similarity search (cosine)
```
