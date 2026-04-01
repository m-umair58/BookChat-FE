"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import { API_BASE_URL } from "@/lib/api";

const NAV = [
  {
    href: "/workspace",
    label: "Workspace",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
        />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "Chat",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M8 10h8M8 14h4M5 19h3v-3a4 4 0 014-4h3l2-3h-3.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        />
      </svg>
    ),
  },
  {
    href: "/admin/chunks",
    label: "Chunk inspector",
    icon: (
      <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M4 6h16M4 12h10M4 18h16M17 12l3-2v4l-3-2z"
        />
      </svg>
    ),
  },
] as const;

function navItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin/chunks" && pathname.startsWith("/admin")) return true;
  if (href === "/settings" && pathname.startsWith("/settings")) return true;
  return false;
}

function ApiStatusDot({ status }: { status: "loading" | "ready" | "error" }) {
  if (status === "loading") {
    return (
      <span
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--warning)]"
        title="Checking API…"
      />
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full bg-[var(--danger)]"
        title="API unreachable"
      />
    );
  }
  return (
    <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)]" title="Library API OK" />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { booksStatus } = useWorkspaceApp();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] md:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--bg)]"
      >
        Skip to content
      </a>
      <aside className="z-50 flex w-full shrink-0 flex-col border-b border-[var(--border-strong)]/40 bg-[var(--panel)] md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r md:shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <div className="border-b border-[var(--border)] px-4 py-5">
          <Link
            href="/workspace"
            className="font-display block text-[17px] leading-tight tracking-tight text-[var(--text)] hover:text-[var(--accent)]"
          >
            BookChat
          </Link>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <ApiStatusDot status={booksStatus} />
              <span className="font-medium uppercase tracking-wider">Library API</span>
            </div>
            <details className="group rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-2 text-[10px] text-[var(--muted)]">
              <summary className="cursor-pointer list-none font-mono text-[var(--faint)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="text-[var(--muted)]">Endpoint</span>
                <span className="ml-1 text-[var(--text)] group-open:hidden">▸</span>
                <span className="ml-1 hidden text-[var(--text)] group-open:inline">▾</span>
              </summary>
              <p
                className="mt-2 break-all font-mono text-[10px] leading-snug text-[var(--muted)]"
                title={API_BASE_URL}
              >
                {API_BASE_URL}
              </p>
            </details>
          </div>
        </div>
        <nav
          className="flex flex-1 flex-row gap-0.5 overflow-x-auto p-2 md:flex-col md:overflow-x-visible"
          aria-label="Primary"
        >
          {NAV.map((item) => {
            const active = navItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent-subtle)] text-[var(--text)] ring-1 ring-[var(--accent)]/45 shadow-sm"
                    : "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--text)]"
                }`}
              >
                <span className={active ? "text-[var(--accent)]" : "text-[var(--faint)]"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-[var(--border)] px-3 py-3 text-[10px] text-[var(--faint)] md:block">
          LangChain · FAISS
        </div>
      </aside>
      <div
        id="main-content"
        className="flex min-h-0 min-h-screen flex-1 flex-col md:pl-64"
        tabIndex={-1}
      >
        <div className="flex min-h-screen flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
