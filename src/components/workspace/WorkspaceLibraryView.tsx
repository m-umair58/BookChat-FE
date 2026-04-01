"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiConnectionBanner } from "@/components/ApiConnectionBanner";
import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import { ADMIN_API_TOKEN, API_BASE_URL } from "@/lib/api";
import { speechCleanText, type Book } from "@/components/workspace/domain";

/** Renders chunk text with an in-range highlight (synced to speech `boundary` events when supported). */
function HighlightedReadingText({
  text,
  highlightStart,
  highlightEnd,
}: {
  text: string;
  highlightStart: number;
  highlightEnd: number;
}) {
  const s = Math.max(0, Math.min(highlightStart, text.length));
  const e = Math.max(s, Math.min(highlightEnd, text.length));
  if (e <= s) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }
  return (
    <span className="whitespace-pre-wrap break-words">
      {text.slice(0, s)}
      <mark className="rounded-sm bg-[var(--accent)]/40 px-0.5 font-medium text-[var(--text)] [box-decoration-break:clone]">
        {text.slice(s, e)}
      </mark>
      {text.slice(e)}
    </span>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer rounded-xl border border-[var(--border)] p-4"
          aria-hidden
        >
          <div className="h-4 w-3/4 max-w-[12rem] rounded bg-[var(--surface-muted)]" />
          <div className="mt-3 h-3 w-1/2 max-w-[8rem] rounded bg-[var(--surface-muted)]" />
          <div className="mt-2 h-3 w-2/3 max-w-[10rem] rounded bg-[var(--surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

export function WorkspaceLibraryView() {
  const {
    books,
    booksStatus,
    loadBooks,
    file,
    setFile,
    isIndexing,
    indexMessage,
    elapsedSeconds,
    liveIngestStatus,
    isControllingIngest,
    ingestFilename,
    embeddingProvider,
    setEmbeddingProvider,
    handleIngest,
    handleIngestControl,
    openBookPdf,
    ttsMode,
  } = useWorkspaceApp();
  const [loadingBookListenId, setLoadingBookListenId] = useState<string | null>(null);
  const [speakingBookId, setSpeakingBookId] = useState<string | null>(null);
  const [listenError, setListenError] = useState<string>("");
  const [readingChunks, setReadingChunks] = useState<string[]>([]);
  const [readingIndex, setReadingIndex] = useState(0);
  const [readingBookLabel, setReadingBookLabel] = useState("");
  /** Character range within the current chunk (from `SpeechSynthesisUtterance` boundary events). */
  const [readWordStart, setReadWordStart] = useState(0);
  const [readWordEnd, setReadWordEnd] = useState(0);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startDialogBook, setStartDialogBook] = useState<Book | null>(null);
  const [startDialogLoading, setStartDialogLoading] = useState(false);
  const [startDialogError, setStartDialogError] = useState("");
  const [startDialogChunks, setStartDialogChunks] = useState<string[]>([]);
  const [startLine, setStartLine] = useState(1);
  const [startChar, setStartChar] = useState(1);
  const [selectedPreviewStart, setSelectedPreviewStart] = useState<number | null>(null);
  const [selectedPreviewEnd, setSelectedPreviewEnd] = useState<number | null>(null);
  const bookAudioTokenRef = useRef(0);
  const libraryGeminiAudioRef = useRef<HTMLAudioElement | null>(null);
  const libraryGeminiObjectUrlRef = useRef<string | null>(null);
  const nowReadingChunkRef = useRef<HTMLDivElement | null>(null);
  const previewTextRef = useRef<HTMLParagraphElement | null>(null);
  const chunksCacheRef = useRef<Record<string, string[]>>({});

  const showLibrarySkeleton = booksStatus === "loading" && books.length === 0;
  const libraryEmptyReady = books.length === 0 && booksStatus === "ready";

  const cleanupLibraryGeminiAudio = () => {
    if (libraryGeminiAudioRef.current) {
      try {
        libraryGeminiAudioRef.current.pause();
      } catch {
        // noop
      }
      libraryGeminiAudioRef.current.src = "";
      libraryGeminiAudioRef.current = null;
    }
    if (libraryGeminiObjectUrlRef.current) {
      URL.revokeObjectURL(libraryGeminiObjectUrlRef.current);
      libraryGeminiObjectUrlRef.current = null;
    }
  };

  const stopBookAudio = () => {
    bookAudioTokenRef.current += 1;
    cleanupLibraryGeminiAudio();
    setSpeakingBookId(null);
    setReadingChunks([]);
    setReadingIndex(0);
    setReadingBookLabel("");
    setReadWordStart(0);
    setReadWordEnd(0);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const fetchBookChunks = async (bookId: string): Promise<string[]> => {
    const token = ADMIN_API_TOKEN;
    const limit = 200;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const parts: string[] = [];
    const embeddingProvider = books.find((b) => b.book_id === bookId)?.embedding_provider ?? "ollama";
    while (offset < total) {
      const params = `offset=${offset}&limit=${limit}&embedding_provider=${embeddingProvider}`;
      const endpoints = [
        `${API_BASE_URL}/admin/books/${encodeURIComponent(bookId)}/chunks?${params}`,
        `${API_BASE_URL}/books/${encodeURIComponent(bookId)}/chunks?${params}`,
      ];
      let response: Response | null = null;
      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
          headers: token ? { "X-Admin-Token": token } : undefined,
        });
        if (res.status === 404) continue;
        response = res;
        break;
      }
      if (!response) {
        throw new Error(
          "This backend does not expose a chunks endpoint for whole-book audio. Use Read book, or enable /admin/books/{book_id}/chunks on the API.",
        );
      }
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Admin token required for whole-book audio. Set NEXT_PUBLIC_ADMIN_API_TOKEN."
            : `Could not load book chunks (HTTP ${response.status}).`,
        );
      }
      const data = (await response.json()) as {
        total: number;
        returned: number;
        chunks: Array<{ text?: string }>;
      };
      total = typeof data.total === "number" ? data.total : 0;
      const chunkTexts = (data.chunks ?? [])
        .map((c) => speechCleanText(c.text ?? ""))
        .filter(Boolean);
      parts.push(...chunkTexts);
      if (!data.returned || data.returned <= 0) break;
      offset += data.returned;
    }
    return parts;
  };

  const getOrFetchBookChunks = async (bookId: string): Promise<string[]> => {
    const cached = chunksCacheRef.current[bookId];
    if (cached && cached.length > 0) return cached;
    const loaded = await fetchBookChunks(bookId);
    chunksCacheRef.current[bookId] = loaded;
    return loaded;
  };

  const mapLineCharToChunkPosition = (chunks: string[], line: number, char: number) => {
    const joined = chunks.join("\n");
    if (!joined) return { chunkIndex: 0, charIndex: 0 };
    const lineStarts = [0];
    for (let i = 0; i < joined.length; i += 1) {
      if (joined[i] === "\n") lineStarts.push(i + 1);
    }
    const clampedLine = Math.max(1, Math.min(line, lineStarts.length));
    const lineStart = lineStarts[clampedLine - 1];
    const lineEndExclusive =
      clampedLine < lineStarts.length ? lineStarts[clampedLine] - 1 : joined.length;
    const clampedChar = Math.max(1, char);
    const globalIndex = Math.min(
      Math.max(lineStart + clampedChar - 1, lineStart),
      Math.max(lineStart, lineEndExclusive),
    );

    let cursor = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkLen = chunks[i].length;
      if (globalIndex <= cursor + chunkLen - 1) {
        return { chunkIndex: i, charIndex: Math.max(0, globalIndex - cursor) };
      }
      cursor += chunkLen;
      if (i < chunks.length - 1) {
        if (globalIndex === cursor) {
          return { chunkIndex: i + 1, charIndex: 0 };
        }
        cursor += 1;
      }
    }
    return { chunkIndex: chunks.length - 1, charIndex: 0 };
  };

  const startBookAudio = async (
    book: Book,
    opts?: { chunks?: string[]; startChunkIndex?: number; startCharIndex?: number },
  ) => {
    if (typeof window === "undefined") return;
    if (ttsMode === "browser" && !("speechSynthesis" in window)) return;
    stopBookAudio();
    setListenError("");
    setLoadingBookListenId(book.book_id);
    const token = bookAudioTokenRef.current + 1;
    bookAudioTokenRef.current = token;
    try {
      const parts = opts?.chunks ?? (await getOrFetchBookChunks(book.book_id));
      if (bookAudioTokenRef.current !== token) return;
      if (parts.length === 0) {
        throw new Error("No readable chunks found for this book.");
      }
      const startChunkIndex = Math.max(
        0,
        Math.min(opts?.startChunkIndex ?? 0, parts.length - 1),
      );
      const startCharIndex = Math.max(
        0,
        Math.min(opts?.startCharIndex ?? 0, Math.max(0, parts[startChunkIndex].length - 1)),
      );
      setSpeakingBookId(book.book_id);
      setReadingChunks(parts);
      setReadingIndex(startChunkIndex);
      setReadingBookLabel(book.filename);

      if (ttsMode === "gemini") {
        let idx = startChunkIndex;
        while (idx < parts.length) {
          if (bookAudioTokenRef.current !== token) return;
          const activeStartOffset = idx === startChunkIndex ? startCharIndex : 0;
          const chunkText = parts[idx];
          const slice = (activeStartOffset > 0 ? chunkText.slice(activeStartOffset) : chunkText).trim();
          setReadingIndex(idx);
          setReadWordStart(0);
          setReadWordEnd(chunkText.length);
          if (!slice) {
            idx += 1;
            continue;
          }
          try {
            const response = await fetch(`${API_BASE_URL}/tts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: slice.slice(0, 8000) }),
            });
            if (!response.ok) {
              const err = (await response.json().catch(() => ({}))) as { detail?: unknown };
              const detail =
                typeof err.detail === "string"
                  ? err.detail
                  : err.detail != null
                    ? JSON.stringify(err.detail)
                    : `TTS failed (HTTP ${response.status}).`;
              throw new Error(detail);
            }
            const blob = await response.blob();
            if (bookAudioTokenRef.current !== token) return;
            const url = URL.createObjectURL(blob);
            libraryGeminiObjectUrlRef.current = url;
            const audio = new Audio(url);
            libraryGeminiAudioRef.current = audio;
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => {
                cleanupLibraryGeminiAudio();
                resolve();
              };
              audio.onerror = () => {
                cleanupLibraryGeminiAudio();
                reject(new Error("Audio playback error."));
              };
              void audio.play().catch(reject);
            });
          } catch (e) {
            if (bookAudioTokenRef.current === token) {
              setListenError(e instanceof Error ? e.message : "Gemini audio failed.");
              setSpeakingBookId(null);
              setReadingChunks([]);
              setReadingIndex(0);
              setReadingBookLabel("");
              setReadWordStart(0);
              setReadWordEnd(0);
            }
            return;
          }
          idx += 1;
        }
        if (bookAudioTokenRef.current === token) {
          setSpeakingBookId(null);
          setReadingChunks([]);
          setReadingIndex(0);
          setReadingBookLabel("");
          setReadWordStart(0);
          setReadWordEnd(0);
        }
        return;
      }

      let idx = startChunkIndex;
      const speakNext = () => {
        if (bookAudioTokenRef.current !== token) return;
        if (idx >= parts.length) {
          setSpeakingBookId(null);
          setReadingChunks([]);
          setReadingIndex(0);
          setReadingBookLabel("");
          setReadWordStart(0);
          setReadWordEnd(0);
          return;
        }
        const activeStartOffset = idx === startChunkIndex ? startCharIndex : 0;
        setReadingIndex(idx);
        setReadWordStart(activeStartOffset);
        setReadWordEnd(Math.min(activeStartOffset + 1, parts[idx].length));
        const chunkText = parts[idx];
        const slice = activeStartOffset > 0 ? chunkText.slice(activeStartOffset) : chunkText;
        const utter = new SpeechSynthesisUtterance(slice);
        utter.rate = 1;
        utter.pitch = 1;
        utter.onstart = () => {
          if (bookAudioTokenRef.current !== token) return;
          setReadWordStart(activeStartOffset);
          setReadWordEnd(Math.min(activeStartOffset + 1, chunkText.length));
        };
        utter.onboundary = (event) => {
          if (bookAudioTokenRef.current !== token) return;
          const e = event as SpeechSynthesisEvent;
          const start = Math.min(
            Math.max(0, activeStartOffset + e.charIndex),
            chunkText.length,
          );
          let end =
            e.charLength > 0 ? start + e.charLength : start;
          if (end <= start) {
            const rest = chunkText.slice(start);
            const word = rest.match(/^\s*\S+/)?.[0] ?? rest.slice(0, 1);
            end = Math.min(start + (word?.length ?? 1), chunkText.length);
          } else {
            end = Math.min(end, chunkText.length);
          }
          setReadWordStart(start);
          setReadWordEnd(end);
        };
        utter.onend = () => {
          if (bookAudioTokenRef.current !== token) return;
          setReadWordStart(0);
          setReadWordEnd(0);
          idx += 1;
          speakNext();
        };
        utter.onerror = (event) => {
          if (bookAudioTokenRef.current !== token) return;
          const synthError = (event as SpeechSynthesisErrorEvent).error;
          if (synthError === "canceled" || synthError === "interrupted") {
            // User-initiated stop/cancel should not surface as an error.
            return;
          }
          setSpeakingBookId(null);
          setReadingChunks([]);
          setReadingIndex(0);
          setReadingBookLabel("");
          setReadWordStart(0);
          setReadWordEnd(0);
          setListenError("Playback stopped due to a speech synthesis error.");
        };
        window.speechSynthesis.speak(utter);
      };
      speakNext();
    } catch (error) {
      if (bookAudioTokenRef.current === token) {
        setListenError(error instanceof Error ? error.message : "Could not start audio.");
        setSpeakingBookId(null);
      }
    } finally {
      if (bookAudioTokenRef.current === token) {
        setLoadingBookListenId(null);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopBookAudio();
    };
  }, []);

  useLayoutEffect(() => {
    if (!speakingBookId || !nowReadingChunkRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nowReadingChunkRef.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [speakingBookId, readingIndex, readWordStart]);

  const openStartDialog = async (book: Book) => {
    setStartDialogBook(book);
    setStartDialogOpen(true);
    setStartDialogLoading(true);
    setStartDialogError("");
    setStartDialogChunks([]);
    setStartLine(1);
    setStartChar(1);
    setSelectedPreviewStart(null);
    setSelectedPreviewEnd(null);
    try {
      const chunks = await getOrFetchBookChunks(book.book_id);
      setStartDialogChunks(chunks);
    } catch (error) {
      setStartDialogError(error instanceof Error ? error.message : "Could not load book text.");
    } finally {
      setStartDialogLoading(false);
    }
  };

  const dialogJoined = startDialogChunks.join("\n");
  const dialogLines = dialogJoined ? dialogJoined.split("\n") : [];
  const dialogLineCount = dialogLines.length;
  const clampedDialogLine = Math.max(1, Math.min(startLine, Math.max(1, dialogLineCount)));
  const currentDialogLineText = dialogLines[clampedDialogLine - 1] ?? "";
  const currentDialogLineMaxChar = Math.max(1, currentDialogLineText.length);

  const startFromPosition = async (overrideChar?: number) => {
    if (!startDialogBook || startDialogChunks.length === 0) return;
    const line = Math.max(1, Math.min(startLine, dialogLineCount || 1));
    const char = Math.max(
      1,
      Math.min(
        overrideChar ?? startChar,
        Math.max(1, (dialogLines[line - 1] ?? "").length),
      ),
    );
    const pos = mapLineCharToChunkPosition(startDialogChunks, line, char);
    setStartDialogOpen(false);
    await startBookAudio(startDialogBook, {
      chunks: startDialogChunks,
      startChunkIndex: pos.chunkIndex,
      startCharIndex: pos.charIndex,
    });
  };

  const handlePreviewSelection = () => {
    const container = previewTextRef.current;
    if (!container) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelectedPreviewStart(null);
      setSelectedPreviewEnd(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setSelectedPreviewStart(null);
      setSelectedPreviewEnd(null);
      return;
    }
    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const selectedText = range.toString();
    const end = start + selectedText.length;
    if (!selectedText.trim()) {
      setSelectedPreviewStart(null);
      setSelectedPreviewEnd(null);
      return;
    }
    setSelectedPreviewStart(Math.max(0, start));
    setSelectedPreviewEnd(Math.max(start, end));
  };

  useEffect(() => {
    setSelectedPreviewStart(null);
    setSelectedPreviewEnd(null);
  }, [startLine, currentDialogLineText]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <ApiConnectionBanner />
      <header className="mb-8 border-b border-[var(--border)] pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-warm)]">
          Library & ingestion
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-[var(--text)] md:text-[2rem]">
          Workspace
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Upload PDFs, monitor indexing, and manage indexed books. Conversations live on the{" "}
          <Link href="/chat" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
            Chat
          </Link>{" "}
          screen, where you choose a book when creating each new chat.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              <span className="text-[var(--accent-warm)]">Ingest</span> new PDF
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEmbeddingProvider("ollama")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  embeddingProvider === "ollama"
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--text)]"
                }`}
              >
                Ollama embeddings
              </button>
              <button
                type="button"
                onClick={() => setEmbeddingProvider("google")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  embeddingProvider === "google"
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--text)]"
                }`}
              >
                Google embeddings
              </button>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleIngest}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--panel-soft)] file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              <button
                type="submit"
                disabled={isIndexing}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {isIndexing ? "Indexing…" : "Upload and index"}
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  !isIndexing || isControllingIngest || liveIngestStatus?.status === "paused"
                }
                onClick={() => void handleIngestControl("pause")}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Pause
              </button>
              <button
                type="button"
                disabled={
                  !isIndexing || isControllingIngest || liveIngestStatus?.status !== "paused"
                }
                onClick={() => void handleIngestControl("resume")}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Resume
              </button>
              <button
                type="button"
                disabled={!isIndexing || isControllingIngest}
                onClick={() => void handleIngestControl("stop")}
                className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-1.5 text-xs text-[var(--danger)] disabled:opacity-50"
              >
                Stop
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              {isIndexing || liveIngestStatus
                ? `Elapsed: ${(liveIngestStatus?.elapsed_seconds ?? elapsedSeconds).toFixed(1)}s`
                : "Ready"}
              {ingestFilename ? ` · ${ingestFilename}` : ""}
            </p>
            {liveIngestStatus && liveIngestStatus.status !== "idle" ? (
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] p-3">
                <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                  <span>Status: {liveIngestStatus.status}</span>
                  <span>
                    Chunks: {liveIngestStatus.processed_chunks ?? 0}/
                    {liveIngestStatus.total_chunks ?? 0}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, liveIngestStatus.progress_percent ?? 0))}%`,
                    }}
                  />
                </div>
                {liveIngestStatus.retry_in_seconds != null &&
                liveIngestStatus.status === "rate-limited-wait" ? (
                  <p className="mt-2 rounded-md bg-[var(--warning-bg)] px-2 py-1 text-xs text-[var(--warning)]">
                    Retry in ~{liveIngestStatus.retry_in_seconds}s
                  </p>
                ) : null}
                {liveIngestStatus.message ? (
                  <p className="mt-2 text-xs text-[var(--text)]">{liveIngestStatus.message}</p>
                ) : null}
              </div>
            ) : null}
            {indexMessage ? <p className="mt-3 text-sm text-[var(--text)]">{indexMessage}</p> : null}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              <span className="text-[var(--accent)]">Chat</span> workflow
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Start and manage conversations in{" "}
              <Link href="/chat" className="text-[var(--accent)] hover:underline">
                Chat
              </Link>
              . You will pick the target book when creating a new thread.
            </p>
          </section>
        </aside>

        <section className="lg:col-span-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                <span className="text-[var(--success)]">Library</span>
              </h2>
              <button
                type="button"
                disabled={booksStatus === "loading"}
                onClick={() => void loadBooks()}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {booksStatus === "loading" ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Indexed books available for new chat creation in the Chat screen.
            </p>
            {listenError ? (
              <p className="mt-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
                {listenError}
              </p>
            ) : null}
            {speakingBookId && readingChunks.length > 0 ? (
              <div className="mt-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-subtle)] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                    Now reading
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Chunk {readingIndex + 1} / {readingChunks.length}
                  </p>
                </div>
                <p className="text-xs font-medium text-[var(--text)]">{readingBookLabel}</p>
                <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {readingChunks
                    .slice(Math.max(0, readingIndex - 2), Math.min(readingChunks.length, readingIndex + 3))
                    .map((chunk, i) => {
                      const absoluteIndex = Math.max(0, readingIndex - 2) + i;
                      const active = absoluteIndex === readingIndex;
                      return (
                        <div
                          key={`${absoluteIndex}-${chunk.slice(0, 24)}`}
                          ref={active ? (el) => { nowReadingChunkRef.current = el; } : undefined}
                          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                            active
                              ? "border-[var(--accent)] bg-[var(--panel)] text-[var(--text)] ring-1 ring-[var(--accent)]/35"
                              : "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)]"
                          }`}
                        >
                          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--faint)]">
                            {active ? "Speaking now" : `Chunk ${absoluteIndex + 1}`}
                          </p>
                          {active ? (
                            <HighlightedReadingText
                              text={chunk}
                              highlightStart={readWordStart}
                              highlightEnd={readWordEnd}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{chunk}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {showLibrarySkeleton ? (
                <LibrarySkeleton />
              ) : booksStatus === "error" && books.length === 0 ? (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Library could not be loaded. Use <strong className="text-[var(--text)]">Retry</strong>{" "}
                  in the connection alert above, then refresh this page if needed.
                </p>
              ) : libraryEmptyReady ? (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  No indexed books yet. Ingest a PDF to begin.
                </p>
              ) : (
                books.map((book) => (
                  <div
                    key={book.book_id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-left transition-colors hover:border-[var(--border-strong)]"
                  >
                    <p className="text-sm font-semibold leading-snug">{book.filename}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {book.pages} pages · {book.chunks} chunks
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">{book.book_id}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openBookPdf(book.book_id)}
                        className="rounded-md border border-[var(--border)] bg-[var(--chat-thread)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--panel)]"
                      >
                        Read book
                      </button>
                      {speakingBookId === book.book_id ? (
                        <button
                          type="button"
                          onClick={stopBookAudio}
                          className="rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2.5 py-1 text-xs text-[var(--danger)]"
                        >
                          Stop audio
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={loadingBookListenId === book.book_id}
                            onClick={() => void startBookAudio(book)}
                            className="rounded-md border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-2.5 py-1 text-xs text-[var(--accent)] disabled:opacity-50"
                          >
                            {loadingBookListenId === book.book_id ? "Preparing..." : "Listen"}
                          </button>
                          <button
                            type="button"
                            disabled={loadingBookListenId === book.book_id}
                            onClick={() => void openStartDialog(book)}
                            className="rounded-md border border-[var(--border)] bg-[var(--chat-thread)] px-2.5 py-1 text-xs text-[var(--text)] disabled:opacity-50"
                          >
                            Start from...
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      {startDialogOpen ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Start reading from position"
          onClick={() => setStartDialogOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-[var(--text)]">Start listening from position</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {startDialogBook?.filename ?? "Book"}
            </p>
            {startDialogLoading ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading indexed text...</p>
            ) : startDialogError ? (
              <p className="mt-4 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
                {startDialogError}
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="text-xs text-[var(--muted)]">
                    Line
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, dialogLineCount)}
                      value={startLine}
                      onChange={(e) => setStartLine(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
                    />
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Character
                    <input
                      type="number"
                      min={1}
                      max={currentDialogLineMaxChar}
                      value={startChar}
                      onChange={(e) => setStartChar(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Lines available: {Math.max(1, dialogLineCount)} · Max char on selected line: {currentDialogLineMaxChar}
                </p>
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--faint)]">
                    Line preview
                  </p>
                  <p
                    ref={previewTextRef}
                    onMouseUp={handlePreviewSelection}
                    onKeyUp={handlePreviewSelection}
                    className="max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--text)] selection:bg-[var(--accent)]/45"
                  >
                    {currentDialogLineText || "(Empty line)"}
                  </p>
                  {selectedPreviewStart != null && selectedPreviewEnd != null ? (
                    <p className="mt-2 text-[11px] text-[var(--muted)]">
                      Selection starts at character {selectedPreviewStart + 1}
                    </p>
                  ) : null}
                </div>
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStartDialogOpen(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={startDialogLoading || !!startDialogError || startDialogChunks.length === 0}
                onClick={() => void startFromPosition()}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
              >
                Start listening
              </button>
              <button
                type="button"
                disabled={
                  startDialogLoading ||
                  !!startDialogError ||
                  startDialogChunks.length === 0 ||
                  selectedPreviewStart == null
                }
                onClick={() =>
                  void startFromPosition(
                    selectedPreviewStart != null ? selectedPreviewStart + 1 : startChar,
                  )
                }
                className="rounded-lg border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] disabled:opacity-50"
              >
                Start from selection
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
