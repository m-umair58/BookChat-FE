"use client";

import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";

export function ApiConnectionBanner() {
  const { booksStatus, booksError, loadBooks } = useWorkspaceApp();

  if (booksStatus !== "error" || !booksError) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--text)]"
      role="alert"
    >
      <p className="min-w-0 flex-1 leading-relaxed">
        <span className="font-semibold text-[var(--warning)]">Connection issue.</span>{" "}
        <span className="text-[var(--muted)]">{booksError}</span>
      </p>
      <button
        type="button"
        onClick={() => void loadBooks()}
        className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--panel-soft)]"
      >
        Retry
      </button>
    </div>
  );
}
