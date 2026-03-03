"""
Structural document chunker for RAG with Docling PDF conversion.

Pipeline:
  1. PDF  → Docling converts to structured Markdown (preserving headings)
     TXT/MD → decoded directly
  1.5 Text cleaning — remove conversion artifacts (HTML comments, stray
      page numbers, table separator lines, trailing semicolons, etc.)
  2. Heading-based structural split (Markdown headings as boundaries)
  3. Secondary character-based split (chunk_size=800, chunk_overlap=100)
     for sections that exceed the chunk size limit
  4. Per-chunk cleaning + noise-chunk filtering (discard chunks with
     < 10 meaningful characters after stripping punctuation/formatting)

Supported formats:
  • PDF  – via Docling (preserves headings, tables, structure)
  • TXT  – plain text (heading detection via Markdown-style headings)
  • MD   – Markdown
"""

import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Chunk:
    """A single chunk of document text with provenance metadata."""
    content: str
    heading: Optional[str] = None
    page_number: Optional[int] = None
    char_start: int = 0
    char_end: int = 0
    context_summary: Optional[str] = None
    enriched_content: Optional[str] = None


# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

def _get_chunk_size() -> int:
    """Return the configured chunk size for secondary splitting."""
    try:
        from flask import current_app
        return current_app.config.get("RAG_CHUNK_SIZE", 800)
    except RuntimeError:
        return int(os.environ.get("RAG_CHUNK_SIZE", "800"))


def _get_chunk_overlap() -> int:
    """Return the configured chunk overlap for secondary splitting."""
    try:
        from flask import current_app
        return current_app.config.get("RAG_CHUNK_OVERLAP", 100)
    except RuntimeError:
        return int(os.environ.get("RAG_CHUNK_OVERLAP", "100"))


# ---------------------------------------------------------------------------
# Step 1: PDF → Markdown via Docling
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Cached Docling converter singleton (avoid re-initialization overhead)
# ---------------------------------------------------------------------------
_DOCLING_CONVERTER = None


def _get_docling_converter():
    """Return a cached DocumentConverter instance."""
    global _DOCLING_CONVERTER
    if _DOCLING_CONVERTER is None:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.pipeline_options import (
            PdfPipelineOptions,
            EasyOcrOptions,
        )
        from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend

        # Configure OCR with Traditional Chinese and English.
        # The default only includes European languages ('fr','de','es','en'),
        # causing Chinese content on scanned/image-based pages to be lost.
        # Note: EasyOCR does not allow ch_tra + ch_sim together.
        ocr_options = EasyOcrOptions(
            lang=['ch_tra', 'en'],
            force_full_page_ocr=False,
            bitmap_area_threshold=0.05,
            confidence_threshold=0.3,  # lower to avoid dropping valid CJK text
        )

        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_table_structure = True
        pipeline_options.do_ocr = True
        pipeline_options.ocr_options = ocr_options
        pipeline_options.document_timeout = 300  # 5 minute max

        _DOCLING_CONVERTER = DocumentConverter(
            format_options={
                "pdf": PdfFormatOption(
                    pipeline_options=pipeline_options,
                    backend=PyPdfiumDocumentBackend,
                ),
            }
        )
    return _DOCLING_CONVERTER


def reset_docling_converter():
    """Reset the cached Docling converter (e.g. after config changes)."""
    global _DOCLING_CONVERTER
    _DOCLING_CONVERTER = None
    logger.info("Docling converter cache cleared")


def _pdf_to_markdown(file_bytes: bytes) -> str:
    """
    Convert a PDF file to structured Markdown using Docling.
    Preserves headings, tables, lists, and document hierarchy.

    OCR languages include Traditional Chinese, Simplified Chinese, and English.
    Converter instance is cached for reuse across uploads.
    If Docling fails, falls back to PyMuPDF text extraction.

    After Docling conversion, cross-checks with PyMuPDF plain-text extraction
    to detect and recover significant content that Docling may have missed
    (e.g. text in unusual PDF layers or complex layouts).

    Args:
        file_bytes: Raw PDF bytes.

    Returns:
        Markdown string with structure preserved.
    """
    # Docling requires a file path — write bytes to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        converter = _get_docling_converter()
        result = converter.convert(tmp_path)
        markdown_text = result.document.export_to_markdown()
        logger.info(
            "Docling PDF→Markdown conversion complete: %d characters",
            len(markdown_text),
        )

        # Cross-check: compare with PyMuPDF to detect content loss
        markdown_text = _merge_missing_content(file_bytes, markdown_text)

        return markdown_text
    except Exception as exc:
        logger.warning(
            "Docling conversion failed: %s — falling back to PyMuPDF", exc,
        )
        return _extract_pdf_text_fallback(file_bytes)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _extract_pdf_text_by_page(file_bytes: bytes) -> list[str]:
    """Extract text from each PDF page using PyMuPDF. Returns list of per-page text."""
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        return pages
    except Exception as exc:
        logger.warning("PyMuPDF per-page extraction failed: %s", exc)
        return []


def _normalize_for_comparison(text: str) -> str:
    """Normalize text for content comparison (strip whitespace/punctuation)."""
    return re.sub(r'[\s\|\-_;\.,:!?！？。，：；（）()\[\]\{\}#*~`>「」『』]+', '', text)


def _extract_significant_sentences(text: str, min_len: int = 8) -> list[str]:
    """
    Extract meaningful sentences/phrases from text for coverage checking.

    Splits on common sentence/line boundaries and returns phrases with at
    least *min_len* CJK/Latin characters (after stripping noise).

    Args:
        text: Raw text.
        min_len: Minimum character count for a phrase to be "significant".

    Returns:
        List of normalized significant phrases.
    """
    # Split on sentence-ending punctuation and newlines
    fragments = re.split(r'[。！？\n.!?]+', text)
    significant = []
    for frag in fragments:
        norm = _normalize_for_comparison(frag)
        if len(norm) >= min_len:
            significant.append(norm)
    return significant


def _merge_missing_content(file_bytes: bytes, docling_md: str) -> str:
    """
    Cross-check Docling markdown against PyMuPDF plain-text extraction.

    Identifies significant sentences present in PyMuPDF output but missing
    from Docling output. If significant content loss is detected (>20% of
    PyMuPDF sentences missing), appends the missing PyMuPDF text to the
    Docling markdown.

    This catches cases where Docling's layout analysis misses text in
    unusual PDF structures (text boxes, overlapping layers, etc.).

    Args:
        file_bytes: Original PDF bytes.
        docling_md: Markdown text from Docling conversion.

    Returns:
        Docling markdown, possibly augmented with recovered content.
    """
    pymupdf_pages = _extract_pdf_text_by_page(file_bytes)
    if not pymupdf_pages:
        return docling_md

    pymupdf_full = "\n".join(pymupdf_pages)
    if not pymupdf_full.strip():
        return docling_md

    # Extract significant sentences from both sources
    docling_norm = _normalize_for_comparison(docling_md)
    pymupdf_sentences = _extract_significant_sentences(pymupdf_full)

    if not pymupdf_sentences:
        return docling_md

    # Check how many PyMuPDF sentences are missing from Docling output
    missing_count = 0
    missing_pages: set[int] = set()

    # Track which page each sentence came from
    page_sentences: list[tuple[int, str]] = []
    for page_idx, page_text in enumerate(pymupdf_pages):
        for sent in _extract_significant_sentences(page_text):
            page_sentences.append((page_idx, sent))

    for page_idx, sent in page_sentences:
        if sent not in docling_norm:
            missing_count += 1
            missing_pages.add(page_idx)

    total = len(page_sentences)
    if total == 0:
        return docling_md

    missing_ratio = missing_count / total
    logger.info(
        "Content check: %d/%d PyMuPDF sentences missing from Docling (%.1f%%), "
        "pages with missing content: %s",
        missing_count, total, missing_ratio * 100,
        sorted(missing_pages) if missing_pages else "none",
    )

    if missing_ratio < 0.10:
        # Less than 10% missing — Docling output is good enough
        return docling_md

    # Significant content loss detected — recover missing page content.
    # Append individual missing pages as fallback sections.
    recovered_parts: list[str] = []
    for page_idx in sorted(missing_pages):
        page_text = pymupdf_pages[page_idx].strip()
        if not page_text:
            continue

        # Check what fraction of THIS page's content is missing
        page_sents = _extract_significant_sentences(page_text)
        if not page_sents:
            continue

        page_missing = sum(1 for s in page_sents if s not in docling_norm)
        page_ratio = page_missing / len(page_sents)

        if page_ratio >= 0.3:  # >30% of page content is missing
            recovered_parts.append(page_text)
            logger.info(
                "Recovering page %d content (%d/%d sentences missing, %.0f%%)",
                page_idx + 1, page_missing, len(page_sents), page_ratio * 100,
            )

    if recovered_parts:
        logger.warning(
            "Content recovery: appending %d pages of PyMuPDF text to Docling output",
            len(recovered_parts),
        )
        # Append recovered content as additional sections
        recovery_text = "\n\n".join(recovered_parts)
        return f"{docling_md}\n\n{recovery_text}"

    return docling_md


def _extract_pdf_text_fallback(file_bytes: bytes) -> str:
    """Fallback PDF text extraction using PyMuPDF (fitz)."""
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return "\n\n".join(pages)
    except Exception as exc:
        logger.error("PyMuPDF fallback also failed: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# Text cleaning helpers
# ---------------------------------------------------------------------------

# Pre-compiled patterns for cleaning
_HTML_COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
_STANDALONE_PAGE_RANGE_RE = re.compile(r'^\s*\d{1,4}\s*[\-–]\s*\d{1,4}\s*;?\s*$', re.MULTILINE)
_STANDALONE_PAGE_NUM_RE = re.compile(r'^\s*\d{1,4}\s*;?\s*$', re.MULTILINE)
_TABLE_SEPARATOR_RE = re.compile(r'^\s*\|[\s\-\|:]+\|\s*$', re.MULTILINE)
_EMPTY_TABLE_ROW_RE = re.compile(r'^\s*\|[\s\|]*\|\s*$', re.MULTILINE)
_TRAILING_SEMICOLON_RE = re.compile(r';(\s*)$', re.MULTILINE)
_EXCESSIVE_BLANK_LINES_RE = re.compile(r'\n{3,}')
_FORMATTING_ONLY_LINE_RE = re.compile(r'^\s*[\|\-_\s]+\s*$', re.MULTILINE)
_URL_LINE_RE = re.compile(r'^\s*https?://\S+\s*;?\s*$', re.MULTILINE)
# Table row with content: lines starting and ending with | that contain text
_TABLE_ROW_RE = re.compile(r'^\s*\|(.+)\|\s*$', re.MULTILINE)
# Duplicate phrase pattern: catches "XYZXYZ" where XYZ is 2-80 chars of CJK/punct
_DUPLICATE_PHRASE_RE = re.compile(r'([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef，。、；：「」『』（）\s,.　]{2,80})\1')
# Isolated dot bullets: standalone ． on its own line
_STANDALONE_BULLET_RE = re.compile(r'^\s*[．\.·]\s*$', re.MULTILINE)# TOC heading keywords (Chinese & English)
_TOC_HEADING_KEYWORDS = re.compile(
    r'\b(table\s+of\s+contents|contents|\u76ee\u9304|\u76ee\u6b21)\b',
    re.IGNORECASE,
)
# TOC line pattern: short title text followed by page number(s)
# e.g. "第一章 概論  7-15", "1.1 理念  8", "2.3.1 各項發展目標的具體闡述 21"
# Also matches colon-separated format: "課程目標：18"
_TOC_LINE_RE = re.compile(
    r'^\s*.{2,60}[\s：:]+\d{1,4}\s*([\-\u2013]\s*\d{1,4})?\s*$'
)
# Orphaned punctuation on its own line (left after HTML comment removal)
_ORPHANED_PUNCT_RE = re.compile(r'^\s*[\.。,，;；]\s*$', re.MULTILINE)
# Page number pattern for TOC table detection (column 2 of a table)
_TOC_PAGE_COL_RE = re.compile(r'^\s*\d{1,4}\s*([\-\u2013]\s*\d{1,4})?\s*$')

def _remove_toc_sections(text: str) -> str:
    """
    Remove Table of Contents (TOC) sections from Markdown text.

    Detects headings containing TOC keywords (目錄, 目次, Contents, Table of
    Contents) and removes everything from that heading through to the next
    heading of equal or higher level.

    Args:
        text: Markdown text potentially containing a TOC section.

    Returns:
        Text with TOC sections removed.
    """
    if not text:
        return text

    lines = text.split('\n')
    result: list[str] = []
    skip_until_level = 0  # 0 = not skipping

    for line in lines:
        heading_match = re.match(r'^(#{1,6})\s+(.+)', line)

        if heading_match:
            level = len(heading_match.group(1))
            heading_text = heading_match.group(2).strip()

            # If we're currently skipping a TOC section
            if skip_until_level > 0:
                # Stop skipping when we hit a heading of equal or higher level
                if level <= skip_until_level:
                    skip_until_level = 0
                    result.append(line)
                # else: still inside TOC, skip this sub-heading
                continue

            # Check if this heading starts a TOC section
            if _TOC_HEADING_KEYWORDS.search(heading_text):
                skip_until_level = level
                logger.debug("Removing TOC section: '%s' (level %d)", heading_text, level)
                continue

            result.append(line)
        else:
            if skip_until_level > 0:
                continue  # Skip body content of TOC section
            result.append(line)

    return '\n'.join(result)


def _is_toc_chunk(text: str, threshold: float = 0.5) -> bool:
    """
    Detect whether a chunk is predominantly Table of Contents entries.

    Checks each non-empty line against a TOC line pattern (short title text
    followed by page numbers).  If more than *threshold* fraction of lines
    match, the chunk is considered TOC content.

    Args:
        text:      Chunk content to evaluate.
        threshold: Fraction of lines that must match TOC pattern (0.0-1.0).

    Returns:
        True if the chunk is predominantly TOC entries.
    """
    if not text or not text.strip():
        return False

    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
    if len(lines) < 3:
        return False  # Need at least 3 lines to be a TOC block

    toc_count = sum(1 for l in lines if _TOC_LINE_RE.match(l))
    return (toc_count / len(lines)) >= threshold


def _process_tables(text: str) -> str:
    """
    Process Markdown pipe-formatted tables with structural awareness.

    Identifies contiguous table blocks and classifies each one:

    - **TOC tables** (2-column tables where >50% of data rows have a page
      number / range in the second column) → **removed entirely**.
    - **Vocabulary / glossary tables** (2-column tables with short terms and
      longer explanations, 3+ consecutive matching rows) → converted to
      ``#### heading`` + paragraph for the heading-based splitter.
    - **Regular tables** → **kept in clean Markdown pipe format** with cell
      whitespace trimmed and empty / separator-only rows normalised.

    Args:
        text: Markdown text potentially containing table blocks.

    Returns:
        Text with TOC tables removed, vocab tables converted to sub-headings,
        and regular tables preserved in clean Markdown format.
    """
    if '|' not in text:
        return text

    lines = text.split('\n')

    # ------------------------------------------------------------------
    # Pass 1: identify contiguous table blocks (runs of lines that are
    #         either pipe rows, separator rows, or blank lines between
    #         pipe rows)
    # ------------------------------------------------------------------
    def _is_table_line(line: str) -> bool:
        s = line.strip()
        if not s:
            return False
        return s.startswith('|') or re.match(r'^[\|\s\-:]+$', s) is not None

    blocks: list[dict] = []  # {"start": int, "end": int, "lines": list[str]}
    i = 0
    while i < len(lines):
        if _is_table_line(lines[i]):
            block_start = i
            j = i + 1
            # Continue as long as we see table lines or blank lines
            # inside a table block (blank lines tolerated only between
            # two table lines).
            while j < len(lines):
                if _is_table_line(lines[j]):
                    j += 1
                elif lines[j].strip() == '' and j + 1 < len(lines) and _is_table_line(lines[j + 1]):
                    j += 1  # blank line between table lines
                else:
                    break
            blocks.append({"start": block_start, "end": j, "lines": lines[block_start:j]})
            i = j
        else:
            i += 1

    if not blocks:
        return text

    # ------------------------------------------------------------------
    # Helper: parse rows of a table block
    # ------------------------------------------------------------------
    def _parse_block(block_lines: list[str]) -> list[dict]:
        parsed: list[dict] = []
        for line in block_lines:
            stripped = line.strip()
            if not stripped:
                parsed.append({"type": "blank", "original": line})
                continue
            if re.match(r'^\|[\s\-:]+\|$', stripped) or re.match(r'^[\|\s\-:]+$', stripped):
                parsed.append({"type": "separator", "original": line})
                continue
            if stripped.startswith('|') and stripped.endswith('|'):
                cells = [c.strip() for c in stripped.split('|')]
                cells = [c for c in cells if c]
                meaningful = [c for c in cells if c.strip(' -_')]
                if not meaningful:
                    parsed.append({"type": "empty_row", "original": line})
                else:
                    parsed.append({"type": "table_row", "cells": meaningful, "original": line})
            else:
                # Partial table line (starts or ends with | but not both)
                parsed.append({"type": "text", "original": line})
        return parsed

    # ------------------------------------------------------------------
    # Helper: classify a parsed table block
    # ------------------------------------------------------------------
    _TERM_MAX_LEN = 40
    _EXPLANATION_MIN_LEN = 10
    _MIN_VOCAB_RUN = 3
    _HEADER_LABELS = re.compile(
        r'^(詞彙|闡釋|名稱|說明|定義|術語|概念|term|definition|description|'
        r'meaning|explanation|concept|範疇|領域|項目|類別|category|domain|'
        r'發展範疇|學習範疇)$',
        re.IGNORECASE,
    )

    def _is_vocab_row(entry: dict) -> bool:
        if entry["type"] != "table_row" or len(entry["cells"]) != 2:
            return False
        term, explanation = entry["cells"]
        if _HEADER_LABELS.match(term.strip()) or _HEADER_LABELS.match(explanation.strip()):
            return False
        return len(term) <= _TERM_MAX_LEN and len(explanation) >= _EXPLANATION_MIN_LEN

    def _classify_block(parsed: list[dict]) -> str:
        """Return 'toc', 'vocab', or 'regular'."""
        data_rows = [e for e in parsed if e["type"] == "table_row"]
        if not data_rows:
            return "regular"  # empty table — will be cleaned anyway

        # --- TOC detection: 2-col table where most rows have page numbers
        two_col_rows = [r for r in data_rows if len(r["cells"]) == 2]
        if len(two_col_rows) >= 3:
            page_col_matches = sum(
                1 for r in two_col_rows
                if _TOC_PAGE_COL_RE.match(r["cells"][1])
            )
            if page_col_matches / len(two_col_rows) > 0.5:
                return "toc"

        # --- Vocab detection: consecutive short-term + long-explanation rows
        vocab_count = sum(1 for r in data_rows if _is_vocab_row(r))
        if vocab_count >= _MIN_VOCAB_RUN and vocab_count / len(data_rows) > 0.5:
            return "vocab"

        return "regular"

    # ------------------------------------------------------------------
    # Helper: render a classified table block back to text
    # ------------------------------------------------------------------
    def _render_block(parsed: list[dict], kind: str) -> str:
        if kind == "toc":
            logger.debug("Removing TOC table (%d rows)",
                         sum(1 for e in parsed if e["type"] == "table_row"))
            return ""  # remove entirely

        if kind == "vocab":
            parts: list[str] = []
            for entry in parsed:
                if entry["type"] == "table_row":
                    cells = entry["cells"]
                    if len(cells) == 2 and _is_vocab_row(entry):
                        parts.append(f"\n#### {cells[0]}\n\n{cells[1]}\n")
                    elif len(cells) == 2 and all(len(c) <= 10 for c in cells):
                        continue  # skip header labels
                    else:
                        parts.append('：'.join(cells))
                elif entry["type"] == "text":
                    parts.append(entry["original"])
                # separators / empty_rows / blanks → skip
            return '\n'.join(parts)

        # kind == "regular" → keep clean Markdown table
        out: list[str] = []
        for entry in parsed:
            if entry["type"] == "table_row":
                cells = entry["cells"]
                out.append('| ' + ' | '.join(cells) + ' |')
            elif entry["type"] == "separator":
                out.append(entry["original"])
            elif entry["type"] == "empty_row":
                continue  # drop empty rows
            elif entry["type"] == "blank":
                continue  # drop blank lines inside tables
            elif entry["type"] == "text":
                out.append(entry["original"])
        return '\n'.join(out)

    # ------------------------------------------------------------------
    # Pass 2: classify + render each block, assemble result
    # ------------------------------------------------------------------
    result_parts: list[str] = []
    prev_end = 0

    for block in blocks:
        # Text before this table block
        if block["start"] > prev_end:
            result_parts.append('\n'.join(lines[prev_end:block["start"]]))

        parsed = _parse_block(block["lines"])
        kind = _classify_block(parsed)
        rendered = _render_block(parsed, kind)
        if rendered.strip():
            result_parts.append(rendered)

        prev_end = block["end"]

    # Text after the last table block
    if prev_end < len(lines):
        result_parts.append('\n'.join(lines[prev_end:]))

    return '\n'.join(result_parts)


def _deduplicate_phrases(text: str) -> str:
    """
    Remove consecutively duplicated phrases caused by PDF extraction artifacts.

    Docling sometimes extracts overlapping text layers from PDFs, producing
    doubled content like "培育幼兒培育幼兒" ("nurture children nurture children").
    This function detects and collapses such consecutive duplications using
    two complementary strategies:

    1. Regex-based: catches short–medium CJK phrase duplication (2-80 chars).
    2. Line-level: for each line, checks if the first half approximately
       equals the second half (handles longer duplicates with minor whitespace
       differences).

    Args:
        text: Text potentially containing duplicated phrases.

    Returns:
        Text with consecutive duplicate phrases collapsed.
    """
    if not text:
        return text

    # Strategy 1: Regex-based for short-medium CJK duplicates
    prev = None
    current = text
    for _ in range(5):  # max 5 passes (typically 1-2 needed)
        prev = current
        current = _DUPLICATE_PHRASE_RE.sub(r'\1', current)
        if current == prev:
            break

    # Strategy 2: Line-level half-duplicate detection
    # Handles cases like "ABC DEF ABC DEF" where there's whitespace variance
    lines = current.split('\n')
    cleaned_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        # Only attempt on lines long enough to contain a meaningful duplicate
        if len(stripped) >= 10:
            cleaned_line = _dedup_line_halves(stripped)
            cleaned_lines.append(cleaned_line)
        else:
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines)


def _dedup_line_halves(line: str) -> str:
    """
    Check if a line contains a duplicated half and collapse it.

    Compares the first half of the line to the second half (after
    normalizing whitespace). If they match, returns just the first half.
    Tries multiple split points near the midpoint to account for minor
    whitespace differences.

    Args:
        line: A single line of text.

    Returns:
        Deduplicated line.
    """
    import unicodedata

    def _normalize(s: str) -> str:
        """Normalize whitespace for comparison."""
        return re.sub(r'\s+', '', s)

    text = line.strip()
    length = len(text)
    if length < 10:
        return line

    # Try split points from exact midpoint ± 3 chars
    mid = length // 2
    for offset in range(0, min(4, mid)):
        for split_at in (mid + offset, mid - offset):
            if split_at <= 0 or split_at >= length:
                continue
            first_half = text[:split_at]
            second_half = text[split_at:]

            if _normalize(first_half) == _normalize(second_half):
                return first_half.strip()

    return line


def _merge_short_lines(text: str, max_line_len: int = 15) -> str:
    """
    Merge consecutive short lines (likely from diagram/figure extraction)
    into single lines separated by commas.

    Lines from extracted diagrams/figures often appear as isolated words
    (e.g. "早期數學\n\n科學與科技\n\n藝術"). This function detects runs of
    consecutive short non-empty lines (<=*max_line_len* chars) and joins
    them, preserving longer lines and headings unchanged.

    Args:
        text:         Input text.
        max_line_len: Max characters for a line to be considered "short".

    Returns:
        Text with short-line runs consolidated.
    """
    if not text:
        return text

    lines = text.split('\n')
    result: list[str] = []
    short_buffer: list[str] = []

    def flush_buffer():
        if short_buffer:
            # Only merge if 3+ consecutive short lines (otherwise likely
            # intentional formatting)
            if len(short_buffer) >= 3:
                result.append('、'.join(short_buffer))
            else:
                result.extend(short_buffer)
            short_buffer.clear()

    for line in lines:
        stripped = line.strip()

        # Skip blank lines (don't break a short-line run — the original text
        # has blank lines between each fragment)
        if not stripped:
            # If we're NOT in a short-line run, preserve the blank line
            if not short_buffer:
                result.append('')
            continue

        # Headings are never merged
        if stripped.startswith('#'):
            flush_buffer()
            result.append(line)
            continue

        # Table rows / separators — never merge (pipes indicate structure)
        if stripped.startswith('|') or re.match(r'^[\|\s\-:]+$', stripped):
            flush_buffer()
            result.append(line)
            continue

        # Standalone bullets / dots — skip
        if stripped in ('．', '.', '·', '。'):
            continue

        # Numbered list items — never merge
        if re.match(r'^\d+\.\s', stripped):
            flush_buffer()
            result.append(line)
            continue

        # Bold labels — never merge
        if stripped.startswith('**') or stripped.startswith('__'):
            flush_buffer()
            result.append(line)
            continue

        # Bullet list items — never merge
        if re.match(r'^[\-\u2022\u2013\u2014．·]\s', stripped):
            flush_buffer()
            result.append(line)
            continue

        if len(stripped) <= max_line_len:
            short_buffer.append(stripped)
        else:
            flush_buffer()
            result.append(line)

    flush_buffer()
    return '\n'.join(result)


def trace_cleaning(text: str, search_for: str = "") -> dict:
    """
    Debug utility: trace text through each cleaning step.

    Returns a dict with text length at each step and whether *search_for*
    was found.  Useful for diagnosing content loss during pre-processing.

    Args:
        text:       Raw Markdown text to trace.
        search_for: Optional substring to track through the pipeline.

    Returns:
        Dict mapping step name → {length, found, text_excerpt}.
    """
    steps: dict = {}

    def _record(name: str, current_text: str):
        info = {"length": len(current_text)}
        if search_for:
            info["found"] = search_for in current_text
        info["excerpt"] = current_text[:200]
        steps[name] = info

    _record("0_raw", text)

    text = _HTML_COMMENT_RE.sub('', text)
    _record("1_html_comments", text)

    text = _ORPHANED_PUNCT_RE.sub('', text)
    _record("1.1_orphaned_punct", text)

    text = _URL_LINE_RE.sub('', text)
    _record("1.2_url_lines", text)

    text = _remove_toc_sections(text)
    _record("1.5_toc_sections", text)

    text = _STANDALONE_PAGE_RANGE_RE.sub('', text)
    _record("2_page_ranges", text)

    text = _STANDALONE_PAGE_NUM_RE.sub('', text)
    _record("3_page_numbers", text)

    text = _process_tables(text)
    _record("4_process_tables", text)

    text = _TRAILING_SEMICOLON_RE.sub(r'\1', text)
    _record("5_trailing_semicolons", text)

    text = _STANDALONE_BULLET_RE.sub('', text)
    _record("6_standalone_bullets", text)

    text = _deduplicate_phrases(text)
    _record("7_dedup_phrases", text)

    text = _merge_short_lines(text)
    _record("8_merge_short_lines", text)

    text = _EXCESSIVE_BLANK_LINES_RE.sub('\n\n', text)
    _record("9_collapse_blanks", text)

    # Also trace heading split
    chunks = _split_by_headings(text.strip())
    steps["12_heading_split"] = {
        "num_chunks": len(chunks),
        "chunks": [
            {"heading": c.heading, "content_len": len(c.content),
             "content_preview": c.content[:100],
             "search_found": search_for in c.content if search_for else None}
            for c in chunks
        ],
    }

    # Trace secondary split
    chunks_after_split = _secondary_split(chunks)
    steps["13_secondary_split"] = {
        "num_chunks": len(chunks_after_split),
        "chunks_with_match": [
            {"idx": i, "heading": c.heading, "content_len": len(c.content),
             "content_preview": c.content[:100]}
            for i, c in enumerate(chunks_after_split)
            if search_for and search_for in c.content
        ] if search_for else [],
    }

    # Trace post-clean
    chunks_after_clean = _post_clean_chunks(chunks_after_split)
    steps["14_post_clean"] = {
        "num_chunks": len(chunks_after_clean),
        "removed": len(chunks_after_split) - len(chunks_after_clean),
        "chunks_with_match": [
            {"idx": i, "heading": c.heading, "content_len": len(c.content),
             "content_preview": c.content[:100]}
            for i, c in enumerate(chunks_after_clean)
            if search_for and search_for in c.content
        ] if search_for else [],
    }

    return steps


def _clean_markdown_text(text: str) -> str:
    """
    Pre-process the full Markdown text before heading-based splitting.

    Removes conversion artifacts (HTML comments, stray page numbers,
    table separator-only rows, trailing semicolons), converts tables to
    plain text, deduplicates phrases, and merges fragmented short lines.

    Args:
        text: Raw Markdown text from PDF conversion or file decode.

    Returns:
        Cleaned Markdown text.
    """
    if not text:
        return text

    prev_len = len(text)

    def _log_step(step_name: str):
        nonlocal prev_len
        cur_len = len(text)
        diff = prev_len - cur_len
        if diff > 0:
            logger.debug(
                "Clean step '%s': %d → %d chars (removed %d)",
                step_name, prev_len, cur_len, diff,
            )
        prev_len = cur_len

    # 1. Remove HTML comments (e.g. <!-- image -->)
    text = _HTML_COMMENT_RE.sub('', text)
    _log_step("html_comments")

    # 1.1 Remove orphaned punctuation left by HTML comment removal
    text = _ORPHANED_PUNCT_RE.sub('', text)
    _log_step("orphaned_punct")

    # 1.2 Remove standalone URL-only lines
    text = _URL_LINE_RE.sub('', text)
    _log_step("url_lines")

    # 1.5. Remove TOC sections (heading-based detection)
    text = _remove_toc_sections(text)
    _log_step("toc_sections")

    # 2. Remove standalone page number ranges (e.g. "97-101", "102-104")
    text = _STANDALONE_PAGE_RANGE_RE.sub('', text)
    _log_step("page_ranges")

    # 3. Remove standalone page numbers (e.g. "2", "6")
    #    Only match lines that are *exclusively* a short number.
    text = _STANDALONE_PAGE_NUM_RE.sub('', text)
    _log_step("page_numbers")

    # 4. Process tables: remove TOC tables, convert vocab tables to
    #    sub-headings, keep regular tables in clean Markdown format.
    #    (This replaces the old steps 4/5/6 that destructively removed
    #    separators before table classification.)
    text = _process_tables(text)
    _log_step("process_tables")

    # 5. Strip trailing semicolons from all lines
    text = _TRAILING_SEMICOLON_RE.sub(r'\1', text)
    _log_step("trailing_semicolons")

    # 6. Remove isolated bullet markers (standalone ．)
    text = _STANDALONE_BULLET_RE.sub('', text)
    _log_step("standalone_bullets")

    # 7. Deduplicate repeated phrases (Docling artifact)
    text = _deduplicate_phrases(text)
    _log_step("dedup_phrases")

    # 8. Merge fragmented short lines (diagram/figure text)
    text = _merge_short_lines(text)
    _log_step("merge_short_lines")

    # 9. Collapse 3+ consecutive blank lines into 2
    text = _EXCESSIVE_BLANK_LINES_RE.sub('\n\n', text)
    _log_step("collapse_blanks")

    return text.strip()


def _clean_chunk_content(text: str) -> str:
    """
    Clean an individual chunk's content.

    Re-applies line-level cleaning rules defensively (split boundaries
    can create new artifacts), converts residual table rows to text,
    deduplicates phrases, and removes noise lines.

    Args:
        text: A single chunk's content string.

    Returns:
        Cleaned chunk content.
    """
    if not text:
        return text

    # Remove any residual HTML comments
    text = _HTML_COMMENT_RE.sub('', text)

    # Remove orphaned punctuation from comment removal
    text = _ORPHANED_PUNCT_RE.sub('', text)

    # Remove standalone URL-only lines
    text = _URL_LINE_RE.sub('', text)

    # Remove standalone page numbers / ranges
    text = _STANDALONE_PAGE_RANGE_RE.sub('', text)
    text = _STANDALONE_PAGE_NUM_RE.sub('', text)

    # Remove lines that contain only formatting characters (|, -, _, spaces)
    # but are NOT part of a valid table (safety-net for residual noise)
    text = _FORMATTING_ONLY_LINE_RE.sub('', text)

    # Strip trailing semicolons
    text = _TRAILING_SEMICOLON_RE.sub(r'\1', text)

    # Remove isolated bullet markers
    text = _STANDALONE_BULLET_RE.sub('', text)

    # Deduplicate repeated phrases
    text = _deduplicate_phrases(text)

    # Collapse excessive blank lines
    text = _EXCESSIVE_BLANK_LINES_RE.sub('\n\n', text)

    return text.strip()


def _is_meaningful_chunk(text: str, min_length: int = 15) -> bool:
    """
    Determine whether a chunk contains enough meaningful content to keep.

    Strips whitespace and common punctuation/formatting characters, then
    checks if at least *min_length* characters of real content remain.
    CJK characters are counted as 2 towards the threshold (higher
    information density per character).
    Also rejects chunks that are entirely parenthetical (e.g. English
    translations like "(Aesthetic development)") or predominantly URL
    fragments / page numbers / formatting noise.

    Args:
        text:       Chunk content.
        min_length: Minimum weighted character count after stripping noise.

    Returns:
        True if the chunk should be kept.
    """
    if not text or not text.strip():
        return False

    # Remove common noise characters
    stripped = re.sub(r'[\s\|\-_;\.,:!?！？。，：（）()\[\]\{\}#*~`>]+', '', text)

    # Weighted length: CJK chars count as 2 (higher density)
    _CJK_RANGE = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]')
    weighted_len = sum(2 if _CJK_RANGE.match(c) else 1 for c in stripped)
    if weighted_len < min_length:
        return False

    # Reject chunks that are entirely parenthetical text
    # e.g. "(Aesthetic development)" or "（認知和語言發展）"
    text_trimmed = text.strip()
    if re.match(r'^\s*[（(].+[）)]\s*$', text_trimmed, re.DOTALL):
        return False

    # Reject chunks where >80% of content is URL fragments or page numbers
    total_chars = len(text_trimmed)
    if total_chars > 0:
        noise_len = sum(len(m) for m in re.findall(
            r'https?://\S+|\d{1,4}\s*[-–]\s*\d{1,4}',
            text_trimmed,
        ))
        if noise_len / total_chars > 0.8:
            return False

    return True


def _post_clean_chunks(chunks: List[Chunk]) -> List[Chunk]:
    """
    Apply per-chunk cleaning and filter out noise-only chunks.

    Args:
        chunks: List of chunks after splitting.

    Returns:
        Cleaned and filtered list of chunks.
    """
    cleaned: List[Chunk] = []
    removed = 0

    for chunk in chunks:
        chunk.content = _clean_chunk_content(chunk.content)

        if not _is_meaningful_chunk(chunk.content):
            removed += 1
            continue

        # Filter out TOC-pattern chunks
        if _is_toc_chunk(chunk.content):
            removed += 1
            logger.debug("Filtered TOC chunk: %s...", chunk.content[:60])
            continue

        cleaned.append(chunk)

    if removed:
        logger.info(
            "Post-clean: removed %d noise-only chunks (kept %d)",
            removed, len(cleaned),
        )

    return cleaned


# ---------------------------------------------------------------------------
# Step 2: Heading-based structural split
# ---------------------------------------------------------------------------

# Matches Markdown headings: # Title, ## Subtitle, ### Sub-subtitle, etc.
_HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+)', re.MULTILINE)


def _split_by_headings(markdown_text: str) -> List[Chunk]:
    """
    Split Markdown text at heading boundaries with parent heading propagation.

    Each section (heading + body) becomes one Chunk, with the heading stored
    as metadata.  Text before the first heading (if any) becomes an
    untitled chunk.

    When a heading has no body (e.g. ``## Age Group`` immediately followed by
    ``### Sub-topic``), the heading acts as a parent context and is prepended
    to all subsequent child chunks until the next heading of equal or higher
    level.  This ensures hierarchy context (e.g. "三至四歲") is not lost.

    Args:
        markdown_text: Full Markdown text.

    Returns:
        List of Chunk objects, one per section.
    """
    if not markdown_text or not markdown_text.strip():
        return []

    # Find all heading positions
    headings = list(_HEADING_PATTERN.finditer(markdown_text))

    if not headings:
        # No headings found — return the whole text as one chunk
        text = markdown_text.strip()
        if text:
            return [Chunk(content=text, char_start=0, char_end=len(text))]
        return []

    chunks: List[Chunk] = []

    # Text before the first heading (preamble)
    preamble = markdown_text[:headings[0].start()].strip()
    if preamble:
        chunks.append(Chunk(
            content=preamble,
            heading=None,
            char_start=0,
            char_end=len(preamble),
        ))

    # Track parent headings for hierarchy propagation.
    # Maps heading level → active parent heading text.
    # e.g. {2: "三至四歲"} means "## 三至四歲" is the active parent.
    parent_headings: dict[int, str] = {}

    # Each heading starts a section that ends at the next heading
    for i, match in enumerate(headings):
        heading_level = len(match.group(1))  # number of # characters
        heading_text = match.group(2).strip()
        section_start = match.start()

        if i + 1 < len(headings):
            section_end = headings[i + 1].start()
        else:
            section_end = len(markdown_text)

        # Clear any parent headings at this level or lower (they're replaced)
        for lvl in list(parent_headings.keys()):
            if lvl >= heading_level:
                del parent_headings[lvl]

        # Section body = everything after the heading line until next heading
        heading_line_end = match.end()
        body = markdown_text[heading_line_end:section_end].strip()

        if not body:
            # Heading with no body — register as parent context for children
            parent_headings[heading_level] = heading_text
            continue

        # Short-body heading detection: if the body is very short (e.g.
        # just an English translation like "(Aesthetic development)") AND
        # the next heading is a child (deeper level) AND the body has no
        # sentence-ending punctuation, treat this as a parent heading rather
        # than creating a near-empty chunk.
        _SHORT_BODY_THRESHOLD = 80  # characters
        _SENTENCE_ENDERS = re.compile(r'[.。!?！？]')
        if (len(body) <= _SHORT_BODY_THRESHOLD
                and not _SENTENCE_ENDERS.search(body)
                and i + 1 < len(headings)):
            next_level = len(headings[i + 1].group(1))
            if next_level > heading_level:
                # Merge short body into heading text as parent context
                body_oneline = ' '.join(body.split())
                parent_headings[heading_level] = f"{heading_text} {body_oneline}"
                logger.debug(
                    "Short-body heading '%s' propagated as parent (%d chars body)",
                    heading_text, len(body),
                )
                continue

        # Build composite heading with parent context
        # e.g. "三至四歲 > 體能發展" when ## 三至四歲 is parent of ### 體能發展
        parent_parts = [
            parent_headings[lvl]
            for lvl in sorted(parent_headings.keys())
            if lvl < heading_level
        ]
        composite_heading = " > ".join(parent_parts + [heading_text])

        # Prepend the composite heading to chunk content so the hierarchy
        # context is included in what gets embedded and is searchable.
        content_with_heading = f"{composite_heading}\n\n{body}"

        chunks.append(Chunk(
            content=content_with_heading,
            heading=composite_heading,
            char_start=section_start,
            char_end=section_end,
        ))

    return chunks


# ---------------------------------------------------------------------------
# Step 3: Secondary character-based splitting
# ---------------------------------------------------------------------------

def _secondary_split(
    chunks: List[Chunk],
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> List[Chunk]:
    """
    Split oversized chunks into sub-chunks of approximately *chunk_size*
    characters with *chunk_overlap* character overlap.

    Preserves the parent chunk's heading and page_number metadata on all
    sub-chunks.  Tries to break at sentence boundaries (。.!?！？\\n)
    for cleaner splits.

    Args:
        chunks:        Input chunks from heading-based split.
        chunk_size:    Max characters per sub-chunk (default from config).
        chunk_overlap: Character overlap between consecutive sub-chunks.

    Returns:
        List of Chunk objects (may be longer than input if splits occurred).
    """
    if chunk_size is None:
        chunk_size = _get_chunk_size()
    if chunk_overlap is None:
        chunk_overlap = _get_chunk_overlap()

    result: List[Chunk] = []

    for chunk in chunks:
        text = chunk.content
        if len(text) <= chunk_size:
            result.append(chunk)
            continue

        # Split oversized chunk into sub-chunks
        sub_chunks = _split_text_with_overlap(text, chunk_size, chunk_overlap)
        for i, sub_text in enumerate(sub_chunks):
            offset = i * max(chunk_size - chunk_overlap, 1) if i > 0 else 0
            result.append(Chunk(
                content=sub_text,
                heading=chunk.heading,
                page_number=chunk.page_number,
                char_start=chunk.char_start + offset,
                char_end=chunk.char_start + offset + len(sub_text),
            ))

    return result


def _find_table_ranges(text: str) -> list[tuple[int, int]]:
    """
    Find character ranges of contiguous Markdown table blocks in *text*.

    Returns a list of (start, end) character offsets for each table block.
    A table block is a run of consecutive lines where each line starts with
    ``|`` or is a separator (``|---|---|``) or is a blank line between two
    table lines.
    """
    ranges: list[tuple[int, int]] = []
    lines = text.split('\n')
    offset = 0
    i = 0

    # Pre-compute (offset, length) for each line
    line_offsets: list[tuple[int, int]] = []
    pos = 0
    for line in lines:
        line_offsets.append((pos, len(line)))
        pos += len(line) + 1  # +1 for the \n

    def _is_tbl(line: str) -> bool:
        s = line.strip()
        return bool(s) and (s.startswith('|') or re.match(r'^[\|\s\-:]+$', s) is not None)

    while i < len(lines):
        if _is_tbl(lines[i]):
            block_start_idx = i
            j = i + 1
            while j < len(lines):
                if _is_tbl(lines[j]):
                    j += 1
                elif lines[j].strip() == '' and j + 1 < len(lines) and _is_tbl(lines[j + 1]):
                    j += 1
                else:
                    break
            # char range: start of first line → end of last line
            char_start = line_offsets[block_start_idx][0]
            last_idx = j - 1
            char_end = line_offsets[last_idx][0] + line_offsets[last_idx][1]
            ranges.append((char_start, char_end))
            i = j
        else:
            i += 1

    return ranges


def _split_text_with_overlap(text: str, chunk_size: int, overlap: int) -> List[str]:
    """
    Split *text* into segments of approximately *chunk_size* characters
    with *overlap* character overlap.  Prefers breaking at sentence
    boundaries.  Never breaks inside a Markdown table block.
    """
    if len(text) <= chunk_size:
        return [text]

    # Pre-compute table ranges so we can avoid splitting inside them
    table_ranges = _find_table_ranges(text)

    def _inside_table(pos: int) -> bool:
        """Check if character position *pos* falls inside a table block."""
        for t_start, t_end in table_ranges:
            if t_start <= pos <= t_end:
                return True
            if t_start > pos:
                break  # ranges are sorted
        return False

    # Sentence-ending patterns (Chinese + English punctuation + newlines)
    sentence_endings = re.compile(r'[。.!?！？\n]')

    segments: List[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end >= len(text):
            # Last segment — take everything
            segment = text[start:].strip()
            if segment:
                segments.append(segment)
            break

        # Check if we're inside a table block at the proposed split point.
        # If so, extend the end to after the table block.
        for t_start, t_end in table_ranges:
            if t_start <= end <= t_end:
                # Extend to the end of this table block
                end = min(t_end + 1, len(text))
                break

        if end >= len(text):
            segment = text[start:].strip()
            if segment:
                segments.append(segment)
            break

        # Try to find a sentence boundary near the end of the window
        # Search backwards from `end` within a buffer zone
        search_start = max(start + chunk_size // 2, start)
        search_region = text[search_start:end]
        breaks = list(sentence_endings.finditer(search_region))

        # Filter out breaks that fall inside a table block
        valid_breaks = [
            b for b in breaks
            if not _inside_table(search_start + b.start())
        ]

        if valid_breaks:
            best_break = valid_breaks[-1]
            actual_end = search_start + best_break.end()
        elif breaks:
            # All breaks are inside tables — use the chunk_size boundary
            actual_end = end
        else:
            actual_end = end

        segment = text[start:actual_end].strip()
        if segment:
            segments.append(segment)

        # Move start forward by (actual_end - overlap), but ensure progress
        start = max(actual_end - overlap, start + 1)

    return segments


# ---------------------------------------------------------------------------
# Fallback: simple paragraph splitting (used when everything else fails)
# ---------------------------------------------------------------------------

def _fallback_chunk_text(text: str) -> List[Chunk]:
    """Split text into chunks at paragraph boundaries (blank lines)."""
    paragraphs = re.split(r'\n\s*\n', text)
    chunks: List[Chunk] = []
    offset = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        chunks.append(Chunk(
            content=para,
            char_start=offset,
            char_end=offset + len(para),
        ))
        offset += len(para) + 1

    return chunks


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

def chunk_document(file_bytes: bytes, content_type: str, filename: str = "") -> List[Chunk]:
    """
    Chunk a document using Docling (PDF) or heading-based splitting (TXT/MD),
    followed by secondary character-based splitting for oversized chunks.

    Falls back to paragraph-based splitting if all else fails.

    Pipeline:
      PDF:    Docling → Markdown → heading split → secondary split
      TXT/MD: decode  → heading split → secondary split

    Args:
        file_bytes:   Raw file bytes.
        content_type: MIME type (e.g. "application/pdf").
        filename:     Original filename.

    Returns:
        List of Chunk objects.
    """
    ct = (content_type or "").lower()
    fn = (filename or "").lower()

    # Step 1: Convert to Markdown / extract text
    try:
        if ct == "application/pdf" or fn.endswith(".pdf"):
            markdown_text = _pdf_to_markdown(file_bytes)
        else:
            # TXT and MD — decode directly
            markdown_text = file_bytes.decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning(
            "Text extraction failed for %s (%s), falling back to raw decode: %s",
            filename, content_type, exc,
        )
        markdown_text = file_bytes.decode("utf-8", errors="replace")

    if not markdown_text.strip():
        return []

    # Log raw extraction output for diagnostics
    raw_len = len(markdown_text)
    logger.info(
        "Raw extraction for %s: %d characters (before cleaning)",
        filename, raw_len,
    )

    # Step 1.5: Pre-process — clean conversion artifacts
    markdown_text = _clean_markdown_text(markdown_text)
    logger.info(
        "Pre-clean complete for %s: %d → %d characters (removed %d)",
        filename, raw_len, len(markdown_text), raw_len - len(markdown_text),
    )

    if not markdown_text.strip():
        return []

    # Step 2: Heading-based structural split
    try:
        chunks = _split_by_headings(markdown_text)
        if chunks:
            logger.info(
                "Heading-based split: %d sections for %s",
                len(chunks), filename,
            )
        else:
            raise ValueError("Heading split produced no chunks")
    except Exception as exc:
        logger.warning(
            "Heading-based split failed for %s: %s — using fallback",
            filename, exc,
        )
        chunks = _fallback_chunk_text(markdown_text)

    # Step 3: Secondary character-based split for oversized chunks
    chunks = _secondary_split(chunks)

    # Step 4: Per-chunk cleaning + noise chunk filtering
    chunks = _post_clean_chunks(chunks)

    logger.info(
        "Final chunking: %d chunks for %s (after split + clean)",
        len(chunks), filename,
    )

    if not chunks:
        # Last resort fallback
        chunks = _fallback_chunk_text(markdown_text)
        chunks = _post_clean_chunks(chunks)
        logger.info(
            "Fallback paragraph chunking: %d chunks for %s",
            len(chunks), filename,
        )

    return chunks


# ---------------------------------------------------------------------------
# Diagnostic utility
# ---------------------------------------------------------------------------

def diagnose_pdf(file_bytes: bytes, search_for: str = "") -> dict:
    """
    Diagnostic utility: compare Docling vs PyMuPDF extraction and trace
    content through each cleaning step.

    Usage from terminal::

        from app.rag.chunker import diagnose_pdf
        with open("file.pdf", "rb") as f:
            report = diagnose_pdf(f.read(), search_for="某段文字")
        print(report["summary"])

    Args:
        file_bytes: Raw PDF bytes.
        search_for: Optional substring to track through the pipeline.

    Returns:
        Dict with 'docling_md', 'pymupdf_pages', 'trace', 'summary'.
    """
    report: dict = {}

    # 1. Docling extraction
    try:
        docling_md = _pdf_to_markdown.__wrapped__(file_bytes) if hasattr(_pdf_to_markdown, '__wrapped__') else ""
    except Exception:
        docling_md = ""

    # Re-do without merge to get raw Docling output
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        converter = _get_docling_converter()
        result = converter.convert(tmp_path)
        docling_md = result.document.export_to_markdown()
    except Exception as e:
        docling_md = f"[Docling failed: {e}]"
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    report["docling_md"] = docling_md
    report["docling_len"] = len(docling_md)

    # 2. PyMuPDF extraction
    pymupdf_pages = _extract_pdf_text_by_page(file_bytes)
    pymupdf_full = "\n\n".join(pymupdf_pages)
    report["pymupdf_pages"] = pymupdf_pages
    report["pymupdf_len"] = len(pymupdf_full)
    report["pymupdf_page_count"] = len(pymupdf_pages)

    # 3. Search tracking
    if search_for:
        report["in_docling"] = search_for in docling_md
        report["in_pymupdf"] = search_for in pymupdf_full
        if not report["in_docling"] and report["in_pymupdf"]:
            # Find which page has it
            for i, page in enumerate(pymupdf_pages):
                if search_for in page:
                    report["pymupdf_page_with_match"] = i + 1
                    break

    # 4. Trace through cleaning
    report["trace"] = trace_cleaning(docling_md, search_for=search_for)

    # 5. Content comparison
    docling_norm = _normalize_for_comparison(docling_md)
    pymupdf_sents = _extract_significant_sentences(pymupdf_full)
    missing = [s for s in pymupdf_sents if s not in docling_norm]
    report["pymupdf_sentences"] = len(pymupdf_sents)
    report["missing_in_docling"] = len(missing)
    if pymupdf_sents:
        report["missing_ratio"] = f"{len(missing)/len(pymupdf_sents)*100:.1f}%"

    # 6. Summary
    lines = [
        f"Docling output: {len(docling_md)} chars",
        f"PyMuPDF output: {len(pymupdf_full)} chars ({len(pymupdf_pages)} pages)",
        f"PyMuPDF sentences: {len(pymupdf_sents)}, missing in Docling: {len(missing)} ({report.get('missing_ratio', 'N/A')})",
    ]
    if search_for:
        lines.append(f"Search '{search_for}': in Docling={report.get('in_docling')}, in PyMuPDF={report.get('in_pymupdf')}")
        if report.get("pymupdf_page_with_match"):
            lines.append(f"  Found on PyMuPDF page {report['pymupdf_page_with_match']}")
    report["summary"] = "\n".join(lines)

    return report
