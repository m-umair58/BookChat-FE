# BookChat (frontend)

Next.js UI for the BookChat LangChain API (`ai-book-chatbot-v2`).

## Features

- PDF ingest for `/books/ingest`
- Library explorer for indexed books
- Chat workspace with RAG, sources, and sessions
- Settings: Ollama/Gemini for embeddings & chat; browser or Gemini TTS
- Chunk inspector (`/admin/chunks`)

## Run

1. `npm install`
2. `cp .env.example .env` (if present) and set `NEXT_PUBLIC_API_BASE_URL`
3. `npm run dev`

Default API target is `http://127.0.0.1:8001`.
