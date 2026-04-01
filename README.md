# BookChat (frontend)

Next.js UI for the BookChat LangChain API (`ai-book-chatbot-v2`).

## Features

- PDF ingest for `/books/ingest`
- Library explorer for indexed books
- Chat workspace with RAG, sources, and sessions
- Settings: Ollama/Gemini for embeddings & chat; browser or Gemini TTS
- Chunk inspector (`/admin/chunks`)

## Prerequisites

- **Node.js 20 LTS** (includes `npm`) — [nodejs.org](https://nodejs.org/)
- The **backend** running (default **http://127.0.0.1:8001**) — see [`../ai-book-chatbot-v2/README.md`](../ai-book-chatbot-v2/README.md)

---

## Setup on macOS

1. Open **Terminal** and go to this folder:

   ```bash
   cd path/to/Book-Rag/ai-book-chatbot-frontend-v2
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the API URL:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set, for example:

   ```env
   NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
   ```

   If the backend uses another host or port, change this to match.

4. Optional: if your backend protects admin chunk routes, set:

   ```env
   NEXT_PUBLIC_ADMIN_API_TOKEN=your-token
   ```

   (Must match `ADMIN_API_TOKEN` on the server if configured.)

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Open **http://localhost:3000** (or the URL printed in the terminal).

---

## Setup on Windows

1. Open **Command Prompt** or **PowerShell** and go to this folder:

   ```cmd
   cd path\to\Book-Rag\ai-book-chatbot-frontend-v2
   ```

2. Install dependencies:

   ```cmd
   npm install
   ```

3. Configure the API URL:

   ```cmd
   copy .env.example .env
   ```

   Edit `.env` in your editor:

   ```env
   NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
   ```

4. Optional: `NEXT_PUBLIC_ADMIN_API_TOKEN` as on macOS.

5. Start the dev server:

   ```cmd
   npm run dev
   ```

6. Open **http://localhost:3000** in your browser.

### Windows notes

- If `npm` is not recognized, reinstall Node.js and ensure **“Add to PATH”** is enabled, then open a **new** terminal.
- Use the same `NEXT_PUBLIC_API_BASE_URL` scheme you use in the browser (`127.0.0.1` vs `localhost`) consistently if you hit CORS or connection issues.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (run `build` first) |
| `npm run lint` | ESLint |

---

## Default API target

`http://127.0.0.1:8001` — must match where `uvicorn` (or your host) listens.
