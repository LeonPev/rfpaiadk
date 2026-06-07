from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from ayit_env import configure_google_env
except ModuleNotFoundError:
    from agents.ayit_env import configure_google_env


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
MARKDOWN_DIR = DATA_DIR / "markdown"
RAG_DIR = DATA_DIR / "rag"
CHROMA_DIR = RAG_DIR / "chroma"
DB_PATH = RAG_DIR / "documents.sqlite3"
COLLECTION_NAME = "ayit_uploaded_documents"
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_CHARS = 4200
OVERLAP_CHARS = 450


configure_google_env(ROOT)


def _ensure_dirs() -> None:
    for directory in (UPLOAD_DIR, MARKDOWN_DIR, RAG_DIR, CHROMA_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    _ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            original_path TEXT NOT NULL,
            markdown_path TEXT NOT NULL,
            status TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            error TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def _safe_filename(filename: str) -> str:
    name = Path(filename).name.strip() or "uploaded-document"
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)


def _serialize(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "filename": row["filename"],
        "fileType": row["file_type"],
        "status": row["status"],
        "chunkCount": row["chunk_count"],
        "error": row["error"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _upsert_document(
    *,
    doc_id: str,
    filename: str,
    file_type: str,
    content_hash: str,
    original_path: Path,
    markdown_path: Path,
    status: str,
    chunk_count: int,
    error: str,
) -> dict[str, Any]:
    now = _now()
    with _connect() as conn:
        existing = conn.execute("SELECT created_at FROM documents WHERE id = ?", (doc_id,)).fetchone()
        created_at = existing["created_at"] if existing else now
        conn.execute(
            """
            INSERT INTO documents (
                id, filename, file_type, content_hash, original_path, markdown_path,
                status, chunk_count, error, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                filename = excluded.filename,
                file_type = excluded.file_type,
                content_hash = excluded.content_hash,
                original_path = excluded.original_path,
                markdown_path = excluded.markdown_path,
                status = excluded.status,
                chunk_count = excluded.chunk_count,
                error = excluded.error,
                updated_at = excluded.updated_at
            """,
            (
                doc_id,
                filename,
                file_type,
                content_hash,
                str(original_path),
                str(markdown_path),
                status,
                chunk_count,
                error,
                created_at,
                now,
            ),
        )
        conn.commit()
        return get_document(doc_id) or {}


def _update_status(doc_id: str, status: str, chunk_count: int = 0, error: str = "") -> dict[str, Any]:
    with _connect() as conn:
        conn.execute(
            "UPDATE documents SET status = ?, chunk_count = ?, error = ?, updated_at = ? WHERE id = ?",
            (status, chunk_count, error, _now(), doc_id),
        )
        conn.commit()
    return get_document(doc_id) or {}


def get_document(doc_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return _serialize(row)


def list_documents() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM documents ORDER BY updated_at DESC, filename ASC").fetchall()
    return [doc for row in rows if (doc := _serialize(row))]


def _get_document_row(doc_id: str) -> sqlite3.Row | None:
    with _connect() as conn:
        return conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()


def read_markdown(doc_id: str) -> str:
    row = _get_document_row(doc_id)
    if row is None:
        raise FileNotFoundError("Uploaded document not found.")
    markdown_path = Path(row["markdown_path"])
    if not markdown_path.exists():
        raise FileNotFoundError("Converted Markdown is not available.")
    return markdown_path.read_text(encoding="utf-8")


def delete_document(doc_id: str) -> bool:
    row = _get_document_row(doc_id)
    if row is None:
        return False

    _delete_indexed_chunks(doc_id)
    for path_value in (row["original_path"], row["markdown_path"]):
        path = Path(path_value)
        if path.exists() and path.is_file():
            path.unlink()

    with _connect() as conn:
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
    return True


def retry_document(doc_id: str) -> dict[str, Any]:
    row = _get_document_row(doc_id)
    if row is None:
        raise FileNotFoundError("Uploaded document not found.")

    original_path = Path(row["original_path"])
    if not original_path.exists():
        return _update_status(doc_id, "failed", 0, "Original uploaded file is missing.")

    return _convert_and_index(
        doc_id=doc_id,
        safe_name=row["filename"],
        extension=f".{row['file_type']}",
        original_path=original_path,
        markdown_path=Path(row["markdown_path"]),
    )


def _convert_with_markitdown(path: Path) -> str:
    from markitdown import MarkItDown

    result = MarkItDown().convert(str(path))
    text = getattr(result, "text_content", "")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("MarkItDown returned empty Markdown.")
    return text


def _convert_with_textutil(path: Path) -> str:
    if path.suffix.lower() != ".doc":
        raise RuntimeError("textutil fallback only handles legacy .doc files.")

    result = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    text = result.stdout.strip()
    if not text:
        raise RuntimeError("textutil returned empty text.")
    return text


def _convert_to_markdown(path: Path) -> str:
    try:
        return _convert_with_markitdown(path)
    except Exception as markitdown_error:  # noqa: BLE001
        try:
            return _convert_with_textutil(path)
        except Exception as textutil_error:  # noqa: BLE001
            raise RuntimeError(
                "Conversion failed. "
                f"MarkItDown: {markitdown_error}. "
                f"textutil: {textutil_error}"
            ) from textutil_error


def _split_large_block(block: str) -> list[str]:
    if len(block) <= MAX_CHARS:
        return [block]

    sentences = re.split(r"(?<=[.!?])\s+", block)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip()
        if current and len(candidate) > MAX_CHARS:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def _chunk_markdown(markdown: str) -> list[str]:
    blocks = [block.strip() for block in re.split(r"\n{2,}", markdown.replace("\r\n", "\n")) if block.strip()]
    expanded = [piece for block in blocks for piece in _split_large_block(block)]
    chunks: list[str] = []
    current = ""

    for block in expanded:
        candidate = f"{current}\n\n{block}".strip()
        if current and len(candidate) > MAX_CHARS:
            chunks.append(current)
            overlap = current[-OVERLAP_CHARS:].strip()
            current = f"{overlap}\n\n{block}".strip() if overlap else block
        else:
            current = candidate

    if current:
        chunks.append(current)
    return chunks


def _embedding_client():
    from google import genai

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY or GEMINI_API_KEY is required to embed uploaded documents.")
    return genai.Client(api_key=api_key)


def _embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = _embedding_client()
    model = os.environ.get("AYIT_EMBEDDING_MODEL", "gemini-embedding-001")
    vectors: list[list[float]] = []

    for index in range(0, len(texts), 16):
        batch = texts[index : index + 16]
        response = client.models.embed_content(model=model, contents=batch)
        embeddings = getattr(response, "embeddings", None)
        if embeddings:
            vectors.extend([list(embedding.values) for embedding in embeddings])
            continue

        embedding = getattr(response, "embedding", None)
        if embedding is not None and hasattr(embedding, "values"):
            vectors.append(list(embedding.values))

    if len(vectors) != len(texts):
        raise RuntimeError(f"Embedding API returned {len(vectors)} vectors for {len(texts)} chunks.")
    return vectors


def _collection():
    import chromadb

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _delete_indexed_chunks(doc_id: str) -> None:
    try:
        _collection().delete(where={"doc_id": doc_id})
    except Exception:
        return


def _convert_and_index(
    *,
    doc_id: str,
    safe_name: str,
    extension: str,
    original_path: Path,
    markdown_path: Path,
) -> dict[str, Any]:
    try:
        _delete_indexed_chunks(doc_id)
        _update_status(doc_id, "converting")
        markdown = _convert_to_markdown(original_path)
        markdown_path.write_text(markdown, encoding="utf-8")
        _update_status(doc_id, "indexing")

        chunks = _chunk_markdown(markdown)
        if not chunks:
            raise RuntimeError("No indexable Markdown chunks were produced.")

        vectors = _embed_texts(chunks)
        ids = [f"{doc_id}:{index}" for index in range(len(chunks))]
        metadatas = [
            {
                "doc_id": doc_id,
                "filename": safe_name,
                "file_type": extension.lstrip("."),
                "chunk_id": index,
            }
            for index in range(len(chunks))
        ]
        _collection().add(ids=ids, documents=chunks, metadatas=metadatas, embeddings=vectors)
        return _update_status(doc_id, "indexed", len(chunks))
    except Exception as exc:  # noqa: BLE001
        return _update_status(doc_id, "failed", 0, str(exc))


def ingest_document(filename: str, content: bytes) -> dict[str, Any]:
    safe_name = _safe_filename(filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Only PDF, DOCX, and DOC uploads are supported.")
    if not content:
        raise ValueError("Uploaded document is empty.")

    content_hash = hashlib.sha256(content).hexdigest()
    doc_id = content_hash[:24]
    original_path = UPLOAD_DIR / f"{doc_id}-{safe_name}"
    markdown_path = MARKDOWN_DIR / f"{doc_id}.md"

    _ensure_dirs()
    original_path.write_bytes(content)
    _upsert_document(
        doc_id=doc_id,
        filename=safe_name,
        file_type=extension.lstrip("."),
        content_hash=content_hash,
        original_path=original_path,
        markdown_path=markdown_path,
        status="converting",
        chunk_count=0,
        error="",
    )

    return _convert_and_index(
        doc_id=doc_id,
        safe_name=safe_name,
        extension=extension,
        original_path=original_path,
        markdown_path=markdown_path,
    )


def search_uploaded_docs(query: str, top_k: int = 6) -> dict[str, Any]:
    """Search locally uploaded Human User documents and return cited snippets."""
    query = query.strip()
    if not query:
        return {"status": "error", "query": query, "results": [], "error": "Search query is empty."}

    indexed_docs = [document for document in list_documents() if document["status"] == "indexed"]
    if not indexed_docs:
        return {"status": "empty", "query": query, "results": [], "error": ""}

    try:
        limit = max(1, min(int(top_k), 12))
        query_vector = _embed_texts([query])[0]
        response = _collection().query(
            query_embeddings=[query_vector],
            n_results=limit,
            include=["documents", "metadatas", "distances"],
        )
        ids = response.get("ids", [[]])[0]
        documents = response.get("documents", [[]])[0]
        metadatas = response.get("metadatas", [[]])[0]
        distances = response.get("distances", [[]])[0]
        results = []
        for chunk_id, document, metadata, distance in zip(ids, documents, metadatas, distances):
            results.append(
                {
                    "chunk_id": chunk_id,
                    "filename": metadata.get("filename", "unknown"),
                    "score": 1 / (1 + float(distance)),
                    "snippet": document,
                }
            )
        return {"status": "success", "query": query, "results": results, "error": ""}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "query": query, "results": [], "error": str(exc)}
