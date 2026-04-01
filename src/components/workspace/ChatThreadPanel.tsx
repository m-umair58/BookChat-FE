"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import {
  isSummaryIntent,
  parseSummarySections,
  splitIntroFromSummary,
  stripMarkdownEmphasis,
} from "@/components/workspace/domain";

function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function ChatThreadPanel() {
  const {
    activeSessionId,
    activeSession,
    isAsking,
    chatProvider,
    setChatProvider,
    question,
    setQuestion,
    k,
    setK,
    handleAsk,
    selectedBookId,
    sessionBookId,
    speakingMessageId,
    stopSpeaking,
    speakText,
    openSourceInBook,
    recognitionSupported,
    isListening,
    handleDictation,
  } = useWorkspaceApp();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messageCount = activeSession?.messages.length ?? 0;

  const updatePinnedFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    pinnedRef.current = nearBottom;
    setShowJumpLatest(!nearBottom && messageCount > 0);
  }, [messageCount]);

  useEffect(() => {
    pinnedRef.current = true;
    setShowJumpLatest(false);
  }, [activeSessionId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updatePinnedFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updatePinnedFromScroll);
  }, [updatePinnedFromScroll]);

  useLayoutEffect(() => {
    if (!pinnedRef.current) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: scrollBehavior() });
  }, [messageCount, isAsking, activeSessionId]);

  const jumpToLatest = () => {
    pinnedRef.current = true;
    setShowJumpLatest(false);
    bottomRef.current?.scrollIntoView({ block: "end", behavior: scrollBehavior() });
  };

  const onComposerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    pinnedRef.current = true;
    setShowJumpLatest(false);
    void handleAsk(e);
  };

  const copyMessage = async (id: string, text: string) => {
    const cleaned = text.replace(/\r/g, "");
    try {
      await navigator.clipboard.writeText(cleaned);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((x) => (x === id ? null : x)), 2000);
    } catch {
      setCopiedId(null);
    }
  };

  const composerDisabledReason =
    !selectedBookId && !activeSessionId
      ? "Create a chat thread first, then choose its target book in the New chat dialog."
      : !selectedBookId
        ? "Create a chat and choose a book first."
        : !activeSessionId
          ? "Select a thread from the sidebar or start a new chat."
          : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChatProvider("ollama")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            chatProvider === "ollama"
              ? "bg-[var(--accent)] text-[var(--bg)]"
              : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]"
          }`}
        >
          Ollama Chat
        </button>
        <button
          type="button"
          onClick={() => setChatProvider("google")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            chatProvider === "google"
              ? "bg-[var(--accent)] text-[var(--bg)]"
              : "border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]"
          }`}
        >
          Google Chat
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-4 sm:px-4"
        >
          {!activeSessionId ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Select a chat from the sidebar or start a new thread.
            </p>
          ) : activeSession && activeSession.messages.length === 0 && !isAsking ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Ask anything about{" "}
              <span className="font-medium text-[var(--text)]">{activeSession.bookLabel}</span>.
            </p>
          ) : null}
          {activeSession?.messages.map((m) => {
            const isUser = m.role === "user";
            const isError = m.role === "assistant" && m.content.trimStart().startsWith("Error:");
            return (
              <div key={m.id} className={`mb-6 flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex w-full max-w-[min(100%,44rem)] flex-col gap-1.5 ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      {isUser ? "You" : "Reply"}
                    </span>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {!isUser ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              speakingMessageId === m.id
                                ? stopSpeaking()
                                : speakText(m.content, m.id)
                            }
                            className="rounded border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                          >
                            {speakingMessageId === m.id ? "Stop audio" : "Play audio"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyMessage(m.id, m.content)}
                            className="rounded border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                          >
                            {copiedId === m.id ? "Copied" : "Copy"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void copyMessage(m.id, m.content)}
                          className="rounded border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                        >
                          {copiedId === m.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    className={`w-full rounded-2xl px-4 py-3 text-sm leading-[1.65] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${
                      isUser
                        ? "rounded-br-md bg-[var(--chat-user)] text-[var(--text)] ring-1 ring-[var(--border)]"
                        : isError
                          ? "rounded-bl-md border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--text)] ring-1 ring-[var(--border)]"
                          : "rounded-bl-md border-l-[3px] border-l-[var(--chat-assistant-bar)] bg-[var(--chat-assistant)] text-[var(--text)] ring-1 ring-[var(--border)]"
                    }`}
                  >
                    {m.role === "assistant" && isSummaryIntent(m.classification) ? (
                      (() => {
                        const { intro, body } = splitIntroFromSummary(m.content);
                        const sections = parseSummarySections(body);
                        if (sections.length === 0) {
                          return <p className="whitespace-pre-wrap">{m.content}</p>;
                        }
                        return (
                          <div className="space-y-3">
                            {intro ? (
                              <div className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-subtle)] px-3 py-2.5">
                                <p className="text-[13px] font-medium leading-relaxed text-[var(--text)]">
                                  {stripMarkdownEmphasis(intro)}
                                </p>
                              </div>
                            ) : null}
                            {sections.map((section, idx) => (
                              <section
                                key={`${m.id}-summary-${idx}`}
                                className="rounded-xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-3.5"
                              >
                                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-warm)]">
                                  {section.title}
                                </h4>
                                {section.body.split("\n").some((ln) => ln.trim().startsWith("*")) ? (
                                  <ul className="space-y-1.5 pl-4 text-[14px] leading-relaxed text-[var(--text)] marker:text-[var(--accent)]">
                                    {section.body
                                      .split("\n")
                                      .map((ln) => ln.trim())
                                      .filter(Boolean)
                                      .map((ln, i) => (
                                        <li key={`${m.id}-summary-${idx}-li-${i}`}>
                                          {stripMarkdownEmphasis(ln.replace(/^\*\s*/, ""))}
                                        </li>
                                      ))}
                                  </ul>
                                ) : (
                                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text)]">
                                    {section.body}
                                  </p>
                                )}
                              </section>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.role === "assistant" && (m.classification || (m.sources?.length ?? 0) > 0) ? (
                      <details className="group/details mt-3 rounded-lg border border-[var(--border)]/80 bg-[var(--chat-thread)]/80 px-3 py-2 text-left">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-[var(--muted)] marker:content-none hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
                          <span
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--panel-soft)] text-[10px] text-[var(--accent)] transition-transform duration-200 group-open/details:rotate-90 motion-reduce:transition-none"
                            aria-hidden
                          >
                            ›
                          </span>
                          <span>Intent & sources</span>
                        </summary>
                        <div className="mt-3 space-y-3 border-t border-[var(--border)]/60 pt-3">
                          {m.classification ? (
                            <p className="text-xs text-[var(--muted)]">
                              <span className="text-[var(--muted)]">Intent · </span>
                              <span className="font-medium text-[var(--accent)]">
                                {m.classification}
                              </span>
                            </p>
                          ) : null}
                          {m.sources?.length ? (
                            <div>
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                                Sources
                              </p>
                              <div className="space-y-2">
                                {m.sources.map((source, idx) => (
                                  <div
                                    key={`${m.id}-src-${idx}`}
                                    className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-[11px] text-[var(--muted)]">
                                        Page {source.page ?? "?"} · {source.chapter ?? "—"}
                                      </p>
                                      <button
                                        type="button"
                                        disabled={
                                          !sessionBookId ||
                                          source.page == null ||
                                          source.page < 1
                                        }
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSourceInBook(
                                            sessionBookId,
                                            source.page,
                                            source.preview,
                                          );
                                        }}
                                        className="shrink-0 rounded-md border border-[var(--accent-muted)]/50 bg-[var(--panel-soft)] px-2 py-1 text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--panel)] disabled:opacity-40"
                                      >
                                        Open in book
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          speakText(
                                            source.preview ??
                                              `Page ${source.page ?? "unknown"} ${source.chapter ?? ""}`,
                                          );
                                        }}
                                        className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-2 py-1 text-[10px] text-[var(--muted)] hover:text-[var(--text)]"
                                      >
                                        Hear chunk
                                      </button>
                                    </div>
                                    {source.preview ? (
                                      <p className="mt-2 text-[12px] leading-snug text-[var(--text)]/90">
                                        {source.preview}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {isAsking ? (
            <div className="flex items-center gap-2 px-1 py-2">
              <span className="text-xs font-medium text-[var(--muted)]">Reply</span>
              <span className="inline-flex gap-1 rounded-full border border-[var(--border)] bg-[var(--chat-assistant)] px-3 py-2">
                <span className="chat-thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <span className="chat-thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <span className="chat-thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              </span>
              <span className="text-[11px] text-[var(--muted)]">Retrieving context…</span>
            </div>
          ) : null}
          <div ref={bottomRef} className="h-px w-full shrink-0 scroll-mt-4" aria-hidden />
        </div>

        {showJumpLatest ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <button
              type="button"
              onClick={jumpToLatest}
              className="pointer-events-auto rounded-full border border-[var(--border-strong)] bg-[var(--panel)] px-4 py-2 text-xs font-medium text-[var(--text)] shadow-lg hover:bg-[var(--panel-soft)]"
            >
              Jump to latest
            </button>
          </div>
        ) : null}
      </div>

      <form
        ref={formRef}
        className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4"
        onSubmit={onComposerSubmit}
      >
        {isListening ? (
          <div className="mb-1 flex items-center gap-2 rounded-xl border border-[var(--accent)]/45 bg-[var(--accent-subtle)] px-3 py-2">
            <span className="voice-orb relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <div className="voice-bars" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="text-xs font-medium tracking-wide text-[var(--text)]">
              Listening... Speak naturally.
            </p>
          </div>
        ) : null}
        {composerDisabledReason ? (
          <p className="text-xs leading-relaxed text-[var(--muted)]">{composerDisabledReason}</p>
        ) : (
          <p className="text-[11px] text-[var(--faint)]">
            <kbd className="rounded border border-[var(--border)] bg-[var(--panel-soft)] px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            send ·{" "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--panel-soft)] px-1 py-0.5 font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            newline
          </p>
        )}
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            selectedBookId ? "Message about this book…" : "Select a book in the library first"
          }
          disabled={!selectedBookId || !activeSessionId}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (isAsking || !selectedBookId || !activeSessionId || !question.trim()) return;
            formRef.current?.requestSubmit();
          }}
          className="min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="k-chat" className="text-sm text-[var(--muted)]">
            Top K
          </label>
          <input
            id="k-chat"
            type="number"
            min={1}
            max={20}
            value={k}
            onChange={(e) => setK(Math.max(1, Math.min(20, Number(e.target.value) || 8)))}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <button
            type="submit"
            disabled={isAsking || !selectedBookId || !activeSessionId || !question.trim()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            Send
          </button>
          <button
            type="button"
            disabled={!recognitionSupported}
            onClick={handleDictation}
            className={`relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              isListening
                ? "voice-recording border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text)] shadow-[0_0_0_1px_rgba(109,179,212,0.25)_inset]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            } disabled:opacity-40`}
            title={
              recognitionSupported
                ? "Dictate message with microphone"
                : "Speech recognition not supported in this browser"
            }
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                isListening
                  ? "border-[var(--accent)] bg-[var(--accent)]/20"
                  : "border-[var(--border)] bg-[var(--panel-soft)]"
              }`}
              aria-hidden
            >
              {isListening ? "●" : "🎙"}
            </span>
            {isListening ? "Stop recording" : "Mic input"}
          </button>
        </div>
      </form>
    </div>
  );
}
