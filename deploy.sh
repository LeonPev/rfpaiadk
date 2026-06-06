#!/bin/bash

set -euo pipefail

# Load environment variables from .env file if it exists.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

gcloud run deploy ayit-rfpai \
  --source . \
  --memory 1G \
  --cpu 1 \
  --max 10 \
  --min 0 \
  --timeout=1000 \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=FALSE,GOOGLE_API_KEY=${GOOGLE_API_KEY:-${GEMINI_API_KEY:-}},GEMINI_API_KEY=${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}},AYIT_MODEL=${AYIT_MODEL:-gemini-flash-latest},ADK_SESSION_SERVICE_URI=${ADK_SESSION_SERVICE_URI:-memory://},ADK_ARTIFACT_SERVICE_URI=${ADK_ARTIFACT_SERVICE_URI:-memory://},ADK_MEMORY_SERVICE_URI=${ADK_MEMORY_SERVICE_URI:-memory://}"
