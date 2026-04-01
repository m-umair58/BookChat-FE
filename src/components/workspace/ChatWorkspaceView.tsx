"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiConnectionBanner } from "@/components/ApiConnectionBanner";
import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import { ChatThreadPanel } from "@/components/workspace/ChatThreadPanel";

export function ChatWorkspaceView() {
  const {
    books,
    activeSession,
    selectedBook,
    selectedBookId,
    booksStatus,
    sortedSessions,
    activeSessionId,
    createNewChatSession,
    selectSession,
    deleteSession,
  } = useWorkspaceApp();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChatBookId, setNewChatBookId] = useState("");

  const openCreateDialog = () => {
    if (books.length === 0) return;
    setNewChatBookId(books[0].book_id);
    setIsCreateOpen(true);
  };

  const handleCreateNew = () => {
    if (!newChatBookId) return;
    createNewChatSession(newChatBookId);
    setIsCreateOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ApiConnectionBanner />
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4 lg:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              RAG conversation
            </p>
            <h1 className="font-display mt-0.5 text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[1.75rem] md:leading-tight">
              Chat
            </h1>
            <p className="mt-1 max-w-xl text-xs text-[var(--muted)]">
              Questions and summaries use the active thread&apos;s book. Manage PDFs in{" "}
              <Link
                href="/workspace"
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Workspace
              </Link>
              .
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-left sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Active book
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">
              {activeSession?.bookLabel ??
                selectedBook?.filename ??
                (selectedBookId ? selectedBookId : "None selected")}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-0 md:flex-row md:gap-0">
        <aside className="flex max-h-[40vh] shrink-0 flex-col border-b border-[var(--border)] bg-[var(--panel)] md:max-h-none md:w-72 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-3">
            <span className="text-xs font-semibold text-[var(--text)]">Threads</span>
            <button
              type="button"
              disabled={books.length === 0}
              onClick={openCreateDialog}
              className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-[var(--bg)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              New
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {sortedSessions.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-relaxed text-[var(--muted)]">
                {booksStatus === "error"
                  ? "Threads are saved locally, but the library API is unreachable. Fix the connection, then pick a book in Workspace."
                  : "No threads yet. Create one and pick its book target."}
              </p>
            ) : (
              <ul className="space-y-1">
                {sortedSessions.map((s) => (
                  <li key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => selectSession(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectSession(s.id);
                        }
                      }}
                      className={`group flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                        activeSessionId === s.id
                          ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                          : "border-transparent bg-[var(--chat-thread)] hover:border-[var(--border)]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--text)]">{s.title}</p>
                        <p className="truncate text-[10px] text-[var(--muted)]">{s.bookLabel}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete chat"
                        onClick={(ev) => deleteSession(s.id, ev)}
                        className="shrink-0 rounded border border-[var(--danger-border)] bg-[var(--danger-bg)] px-1 py-0.5 text-[10px] text-[var(--danger)] opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-4 lg:px-6 lg:py-6">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm lg:p-6">
            <ChatThreadPanel />
          </div>
        </main>
      </div>
      {isCreateOpen ? (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create chat"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-[var(--text)]">Create new chat</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Choose the book this conversation should use.
            </p>
            <label htmlFor="new-chat-book" className="mt-4 block text-xs text-[var(--muted)]">
              Book
            </label>
            <select
              id="new-chat-book"
              value={newChatBookId}
              onChange={(e) => setNewChatBookId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--chat-thread)] px-3 py-2 text-sm text-[var(--text)]"
            >
              {books.map((book) => (
                <option key={book.book_id} value={book.book_id}>
                  {book.filename}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newChatBookId}
                onClick={handleCreateNew}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg)] disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
