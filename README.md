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

The ADK API server binds to `http://localhost:8001` to avoid the common `8000` port conflict.
The local script also allows Vite dev origins such as `http://localhost:5173`; restart this process if you see `Forbidden: origin not allowed`.

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
- health check: `/healthz`

## Verify

```bash
npm run check:agents
npm run build
```
