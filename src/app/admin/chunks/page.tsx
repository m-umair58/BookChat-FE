"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ADMIN_API_TOKEN, API_BASE_URL } from "@/lib/api";

const ADMIN_TOKEN_STORAGE = "bookchat-admin-token";

type Book = {
  book_id: string;
  filename: string;
  pages: number;
  chunks: number;
  chapters: string[];
  indexed_at: number;
  embedding_provider?: "ollama" | "google";
};

type AdminChunk = {
  ordinal: number;
  faiss_index: number;
  doc_id: string;
  text: string;
  metadata: Record<string, unknown>;
  char_count: number;
};

type ChunksResponse = {
  book_id: string;
  embedding_provider: string;
  total: number;
  offset: number;
  limit: number;
  returned: number;
  chunks: AdminChunk[];
};

function chunkRowKey(c: AdminChunk): string {
  return `${c.faiss_index}::${c.doc_id}`;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function AdminChunksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [embeddingProvider, setEmbeddingProvider] = useState<"ollama" | "google">("ollama");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ChunksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenOverride, setTokenOverride] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTokenOverride(sessionStorage.getItem(ADMIN_TOKEN_STORAGE) ?? "");
  }, []);

  const effectiveToken = useMemo(() => {
    return (ADMIN_API_TOKEN || tokenOverride).trim();
  }, [tokenOverride]);

  const persistToken = (value: string) => {
    setTokenOverride(value);
    if (typeof window !== "undefined") {
      if (value.trim()) sessionStorage.setItem(ADMIN_TOKEN_STORAGE, value.trim());
      else sessionStorage.removeItem(ADMIN_TOKEN_STORAGE);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/books`);
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json?.books) ? (json.books as Book[]) : [];
        setBooks(list);
        setBookId((prev) => prev || list[0]?.book_id || "");
      } catch {
        setBooks([]);
      }
    })();
  }, []);

  const fetchChunks = useCallback(async () => {
    if (!bookId) {
      setError("Select a book.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({
        embedding_provider: embeddingProvider,
        offset: String(offset),
        limit: String(limit),
      });
      const headers: HeadersInit = {};
      if (effectiveToken) {
        headers["X-Admin-Token"] = effectiveToken;
      }
      const res = await fetch(
        `${API_BASE_URL}/admin/books/${encodeURIComponent(bookId)}/chunks?${params}`,
        { headers },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json?.detail === "string" ? json.detail : "Request failed.");
      }
      setData(json as ChunksResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chunks.");
    } finally {
      setLoading(false);
    }
  }, [bookId, embeddingProvider, offset, limit, effectiveToken]);

  useEffect(() => {
    if (!bookId) return;
    void fetchChunks();
  }, [bookId, embeddingProvider, offset, limit, fetchChunks]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = data ? Math.floor(offset / limit) + 1 : 1;

  const toggleChunk = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  const speakChunk = useCallback((key: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const payload = text.replace(/\s+/g, " ").trim();
    if (!payload) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(payload);
    utter.onend = () => {
      setSpeakingKey((prev) => (prev === key ? null : prev));
    };
    utter.onerror = () => {
      setSpeakingKey((prev) => (prev === key ? null : prev));
    };
    setSpeakingKey(key);
    window.speechSynthesis.speak(utter);
  }, []);

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [bookId, embeddingProvider, offset, limit]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <header className="mb-8 border-b border-[var(--border)] pb-6">
        <h1 className="text-xl font-semibold text-[var(--text)]">Chunk inspector</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Human-readable text stored in the FAISS index for the selected book and embedding provider.
          Raw vectors are not exposed. If the API returns 401, set{" "}
          <code className="rounded bg-[var(--panel-soft)] px-1 text-xs">ADMIN_API_TOKEN</code> on the
          server and optionally{" "}
          <code className="rounded bg-[var(--panel-soft)] px-1 text-xs">
            NEXT_PUBLIC_ADMIN_API_TOKEN
          </code>{" "}
          for the browser, or paste a token below (stored in session storage only).
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium text-[var(--muted)]">Book</label>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
            value={bookId}
            onChange={(e) => {
              setBookId(e.target.value);
              setOffset(0);
            }}
          >
            {books.length === 0 ? (
              <option value="">No books — ingest from Workspace</option>
            ) : null}
            {books.map((b) => (
              <option key={b.book_id} value={b.book_id}>
                {b.filename} ({b.chunks} chunks)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)]">Embeddings</label>
          <div className="mt-1 flex gap-2">
            {(["ollama", "google"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setEmbeddingProvider(p);
                  setOffset(0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs capitalize ${
                  embeddingProvider === p
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--text)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)]">Page size</label>
          <select
            className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setOffset(0);
            }}
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
        </div>
        {!ADMIN_API_TOKEN ? (
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-[var(--muted)]">
              Admin token (optional)
            </label>
            <input
              type="password"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
              placeholder="X-Admin-Token if server requires it"
              value={tokenOverride}
              onChange={(e) => persistToken(e.target.value)}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void fetchChunks()}
          disabled={loading || !bookId}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <span>
            <span className="text-[var(--text)]">{data.returned}</span> of{" "}
            <span className="text-[var(--text)]">{data.total}</span> chunks
            {totalPages > 1 ? (
              <>
                {" "}
                · page {currentPage} of {totalPages}
              </>
            ) : null}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!data || offset + data.returned >= data.total || loading}
              onClick={() => setOffset(offset + limit)}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {data?.chunks.map((c) => {
          const key = chunkRowKey(c);
          const open = expandedKeys.has(key);
          const metaEntries = Object.entries(c.metadata).sort(([a], [b]) => a.localeCompare(b));
          return (
            <article
              key={key}
              className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] transition-shadow ${
                open ? "ring-1 ring-[var(--accent)]/35" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => toggleChunk(key)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--panel)]/60"
                aria-expanded={open}
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--accent)] transition-transform duration-200 ${
                    open ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ›
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="font-mono font-semibold text-[var(--accent)]">#{c.ordinal}</span>
                    <span>faiss {c.faiss_index}</span>
                    <span>{c.char_count} chars</span>
                    {c.metadata.page != null ? (
                      <span className="rounded bg-[var(--panel)] px-2 py-0.5 text-[var(--text)]">
                        Page {String(c.metadata.page)}
                      </span>
                    ) : null}
                    {c.metadata.chapter != null ? (
                      <span className="rounded bg-[var(--panel)] px-2 py-0.5 text-[var(--text)]">
                        {String(c.metadata.chapter)}
                      </span>
                    ) : null}
                    <span className="ml-auto truncate font-mono text-[10px] text-[var(--faint)]" title={c.doc_id}>
                      {c.doc_id}
                    </span>
                  </div>
                  {!open ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-snug text-[var(--muted)]">{c.text}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-[var(--faint)]">
                    {open ? "Click header to collapse" : "Click to expand · full metadata & text"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (speakingKey === key) {
                      stopSpeaking();
                    } else {
                      speakChunk(key, c.text);
                    }
                  }}
                  className="shrink-0 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                >
                  {speakingKey === key ? "Stop audio" : "Play audio"}
                </button>
              </button>
              {open ? (
                <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Metadata
                    </h3>
                    {metaEntries.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">No metadata on this chunk.</p>
                    ) : (
                      <dl className="mt-2 divide-y divide-[var(--border)]/60 rounded-lg border border-[var(--border)] bg-[var(--chat-thread)]">
                        {metaEntries.map(([k, v]) => (
                          <div key={k} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-4">
                            <dt className="font-mono text-[11px] font-medium text-[var(--accent-warm)]">{k}</dt>
                            <dd className="min-w-0">
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text)]">
                                {formatMetadataValue(v)}
                              </pre>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Chunk text
                    </h3>
                    <pre className="mt-2 max-h-[min(70vh,32rem)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] p-3 text-sm leading-relaxed text-[var(--text)]">
                      {c.text}
                    </pre>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {data && data.chunks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No chunks in this range.</p>
      ) : null}
    </div>
  );
}
