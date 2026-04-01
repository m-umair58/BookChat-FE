export type Book = {
  book_id: string;
  filename: string;
  pages: number;
  chunks: number;
  chapters: string[];
  indexed_at: number;
  embedding_provider?: "ollama" | "google";
};

export type ChatSource = {
  page?: number;
  chapter?: string;
  preview?: string;
};

export type ChatResponse = {
  classification: string;
  answer: string;
  sources: ChatSource[];
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  classification?: string;
  sources?: ChatSource[];
  createdAt: number;
};

export type ChatSession = {
  id: string;
  bookId: string;
  bookLabel: string;
  embeddingProvider: "ollama" | "google";
  chatProvider: "ollama" | "google";
  title: string;
  messages: StoredMessage[];
  updatedAt: number;
};

export const CHAT_STORAGE_KEY = "bookchat-chat-sessions-v1";

export const TERMINAL_INGEST_STATUSES = ["completed", "failed", "stopped"];

export type IngestStatusPayload = {
  status: string;
  filename?: string;
  book_id?: string;
  message?: string;
  elapsed_seconds?: number;
  total_chunks?: number;
  processed_chunks?: number;
  progress_percent?: number;
  retry_in_seconds?: number;
};

export type PdfReaderModal = {
  url: string;
  title: string;
};

export function readSessionsFromStorage(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const normalized: ChatSession[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const x = item as Partial<ChatSession> & { messages?: unknown };
      if (!x.id || !x.bookId) continue;
      const msgs = Array.isArray(x.messages)
        ? x.messages
            .filter((m) => m && typeof m === "object")
            .map((m) => {
              const mm = m as Partial<StoredMessage>;
              return {
                id: mm.id ?? newMessageId(),
                role: mm.role === "assistant" ? "assistant" : "user",
                content: String(mm.content ?? ""),
                classification: mm.classification,
                sources: Array.isArray(mm.sources) ? mm.sources : undefined,
                createdAt:
                  typeof mm.createdAt === "number" && Number.isFinite(mm.createdAt)
                    ? mm.createdAt
                    : Date.now(),
              } as StoredMessage;
            })
        : [];
      normalized.push({
        id: String(x.id),
        bookId: String(x.bookId),
        bookLabel: String(x.bookLabel ?? x.bookId),
        embeddingProvider: x.embeddingProvider === "google" ? "google" : "ollama",
        chatProvider: x.chatProvider === "google" ? "google" : "ollama",
        title: String(x.title ?? "New chat"),
        messages: msgs,
        updatedAt:
          typeof x.updatedAt === "number" && Number.isFinite(x.updatedAt)
            ? x.updatedAt
            : Date.now(),
      });
    }
    return normalized;
  } catch {
    return [];
  }
}

export function writeSessionsToStorage(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota or private mode
  }
}

export function newMessageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function sessionPreviewTitle(firstUserText: string): string {
  const t = firstUserText.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 52 ? `${t.slice(0, 52)}…` : t;
}

export type SummarySection = {
  title: string;
  body: string;
};

export function isSummaryIntent(intent: string | undefined): boolean {
  return intent === "book_summary" || intent === "chapter_summary";
}

function normalizeSummaryTitle(raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const noNumber = cleaned.replace(/^\d+[\).\s-]*/, "").trim();
  return noNumber
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

export function splitIntroFromSummary(text: string): { intro: string; body: string } {
  const match = text.match(
    /(?:\*\*)?\s*(?:\d+[\).\s-]*)?(main plot|key characters|major themes|ending(?:\s*\/\s*resolution|\s+overview)?|resolution overview)/i,
  );
  if (!match || match.index == null) return { intro: "", body: text };
  const intro = text.slice(0, match.index).trim();
  const body = text.slice(match.index).trim();
  return { intro, body };
}

export function parseSummarySections(text: string): SummarySection[] {
  const lines = text.split("\n").map((l) => l.trim());
  const sections: SummarySection[] = [];

  let currentTitle = "";
  let currentBody: string[] = [];

  const flush = () => {
    const body = currentBody.join("\n").trim();
    if (currentTitle && body) sections.push({ title: currentTitle, body });
    currentTitle = "";
    currentBody = [];
  };

  for (const line of lines) {
    if (!line) {
      if (currentBody.length > 0) currentBody.push("");
      continue;
    }

    const m = line.match(
      /^(?:[-*]\s*)?(?:\*\*)?(?:\d+[\).\s-]*)?(main plot|key characters|major themes|ending(?:\s*\/\s*resolution|\s+overview)?|resolution overview)(?:\*\*)?\s*:?\s*(.*)$/i,
    );
    if (m) {
      flush();
      currentTitle = normalizeSummaryTitle(m[1]);
      const rest = stripMarkdownEmphasis((m[2] ?? "").trim());
      if (rest) currentBody.push(rest);
      continue;
    }

    if (currentTitle) currentBody.push(stripMarkdownEmphasis(line));
  }

  flush();
  return sections;
}

export function speechCleanText(text: string): string {
  return text
    .replace(/\[(\d+(?:\]\[\d+)*)\]/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

