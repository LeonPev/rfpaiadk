# AYIT ADK Workflow Prototype

Local prototype for the AYIT procurement workflow. The UI is a Vite/React board; the backend is a set of Python ADK agent apps served by ADK's local API server.

## Setup

```bash
python -m pip install -r requirements.txt
npm install
```

Create or update `.env` with either `GOOGLE_API_KEY` or `GEMINI_API_KEY`.

```bash
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
AYIT_MODEL=gemini-flash-latest
```

## Run

Terminal 1:

```bash
npm run adk
```

The FastAPI backend binds to `http://localhost:8001`, serves the ADK API under `/adk`, and serves local document APIs under `/api`.

Terminal 2:

```bash
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Deploy

This project includes a Cloud Run deploy script adapted from `/Users/leon/git/rfpai4/deploy.sh`.

```bash
./deploy.sh
```

The deployed container serves the React app and ADK API from one FastAPI process:

- frontend: `/`
- ADK API: `/adk`
- uploaded document APIs: `/api/documents`
- health check: `/healthz`

## Uploaded Documents

The Human User panel can upload `.pdf`, `.docx`, and `.doc` files. Originals are stored in `data/uploads/`, converted Markdown is stored in `data/markdown/`, document metadata is stored in `data/rag/documents.sqlite3`, and the local Chroma index is stored in `data/rag/chroma/`.

Uploaded document text is embedded with Google embeddings, using `AYIT_EMBEDDING_MODEL=gemini-embedding-001` by default. The saved files, Markdown, metadata, and vector database remain local.

MarkItDown is the supported v1 converter for `.pdf` and `.docx`. Legacy `.doc` files use the macOS `textutil` fallback.

## Verify

```bash
npm run check:agents
npm run build
```
