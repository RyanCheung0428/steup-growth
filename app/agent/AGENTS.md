# app/agent/ — ADK Multi-Agent System

Google ADK-based multi-agent chat runtime. ~2600 lines across 3 modules.

## Files

| File | Purpose |
|------|---------|
| `chat_agent.py` (1433) | Main runtime: `ChatAgentManager`, streaming bridge, provider routing, file validation |
| `prompts.py` (499) | System instructions for coordinator + pdf_agent + media_agent + `retrieve_knowledge` tool |
| `video_analysis_agent.py` (708) | 3-step SequentialAgent: transcribe → multi-perspective analysis → report generation |

## Agent architecture

```
coordinator (steup_growth_coordinator)
  ├── pdf_agent    — PDF analysis (temp 0.2, top_p 0.85)
  ├── media_agent  — Image/media analysis (temp 0.55, top_p 0.9)
  └── (tools) retrieve_knowledge, google_search
```

- **Specialists never message users directly** — they return analysis to coordinator only
- Coordinator temp 0.8, top_p 0.95

## Key patterns

- **Session IDs**: `conv_{user_id}_{conversation_id}` (persisted) / `temp_{user_id}` (no conversation)
- **Provider isolation**: Vertex uses `{user_id}_vertex` cache namespace
- **Streaming bridge**: sync wrapper → background thread → `asyncio.run()` for async ADK → queue → sync generator
- **Agent/runner cache**: `get_or_create_agent()`, `get_or_create_runner()` per user/model; **cleared on provider error**
- **Lazy session creation**: `ensure_session_exists()` in `InMemorySessionService`
- **Vertex env safety**: env vars snapped/restored in `finally` block; temp SA files cleaned up
- **Error mapping**: `_format_error_message()` for region/auth/quota/5xx → user-friendly

## Provider modes

| Mode | Credential source | Env setup |
|------|------------------|-----------|
| AI Studio | `UserApiKey` where `provider='ai_studio'` | Sets `GOOGLE_API_KEY` |
| Vertex AI | `VertexServiceAccount` or `UserApiKey(provider='vertex_ai')` | Writes SA JSON to temp file, sets `GOOGLE_APPLICATION_CREDENTIALS` |

## File validation

- Max 500MB. MIME: PDF, images (jpeg/png/webp/heic/heif), videos (mp4/mov/avi/mkv/webm/flv/wmv/3gpp)
- Video in AI Studio mode: `_transcribe_videos_with_vertex_fallback()` converts to transcript text before coordinator
- Normalization: `_normalize_file_attachments()` handles dict/string entries, deduplicates by path
