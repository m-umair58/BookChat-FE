"use client";

import { useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import type { ProviderChoice, TtsMode } from "@/lib/appSettings";

type ServerInfoPayload = {
  vector_store: "faiss" | "pinecone";
  vector_store_env: string;
  vector_store_label: string;
  pinecone_indexes?: {
    default: string | null;
    ollama: string | null;
    google: string | null;
  } | null;
};

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; hint: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--text)]">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text)] ring-1 ring-[var(--accent)]/40"
                  : "border-[var(--border)] bg-[var(--chat-thread)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              }`}
            >
              <span className="block font-medium text-[var(--text)]">{opt.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function envModeLabel(mode: string): string {
  if (mode === "auto") return "Auto (Pinecone if API key + index are set, else FAISS)";
  if (mode === "pinecone") return "Forced: Pinecone";
  if (mode === "faiss") return "Forced: FAISS";
  return mode;
}

export default function SettingsPage() {
  const {
    embeddingProvider,
    setEmbeddingProvider,
    chatProvider,
    setChatProvider,
    ttsMode,
    setTtsMode,
  } = useWorkspaceApp();

  const [serverInfo, setServerInfo] = useState<ServerInfoPayload | null>(null);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [serverInfoLoading, setServerInfoLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setServerInfoLoading(true);
    setServerInfoError(null);
    void fetch(`${API_BASE_URL}/server/info`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<ServerInfoPayload>;
      })
      .then((data) => {
        if (!cancelled) {
          setServerInfo(data);
          setServerInfoError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerInfo(null);
          setServerInfoError("Could not load server info. Is the API running?");
        }
      })
      .finally(() => {
        if (!cancelled) setServerInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl tracking-tight text-[var(--text)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Choose how the app talks to models and how spoken playback works. Preferences are saved in this
          browser.
        </p>
      </header>

      <div className="space-y-10">
        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 md:p-5"
          aria-labelledby="vector-db-heading"
        >
          <h2
            id="vector-db-heading"
            className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            Backend vector database
          </h2>
          <p className="mt-1 text-xs text-[var(--faint)]">
            Configured on the API server (<span className="font-mono text-[var(--muted)]">{API_BASE_URL}</span>
            ). This is where book embeddings are stored for retrieval.
          </p>
          {serverInfoLoading ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
          ) : serverInfoError ? (
            <p className="mt-3 text-sm text-[var(--warning)]">{serverInfoError}</p>
          ) : serverInfo ? (
            <div className="mt-4 space-y-3 text-sm text-[var(--text)]">
              <div>
                <span className="text-[var(--muted)]">Active store: </span>
                <span className="font-medium">{serverInfo.vector_store_label}</span>
                <span className="ml-2 rounded-md bg-[var(--chat-thread)] px-2 py-0.5 font-mono text-[11px] text-[var(--muted)]">
                  {serverInfo.vector_store}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                <span className="text-[var(--faint)]">Config mode: </span>
                {envModeLabel(serverInfo.vector_store_env)}
              </p>
              {serverInfo.vector_store === "pinecone" && serverInfo.pinecone_indexes ? (
                <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--chat-thread)]">
                  <table className="w-full min-w-[280px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--faint)]">
                        <th className="px-3 py-2 font-medium">Scope</th>
                        <th className="px-3 py-2 font-medium">Pinecone index name</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[var(--text)]">
                      <tr className="border-b border-[var(--border)]/60">
                        <td className="px-3 py-2 text-[var(--muted)]">Default / fallback</td>
                        <td className="px-3 py-2">{serverInfo.pinecone_indexes.default ?? "—"}</td>
                      </tr>
                      <tr className="border-b border-[var(--border)]/60">
                        <td className="px-3 py-2 text-[var(--muted)]">Ollama embeddings</td>
                        <td className="px-3 py-2">{serverInfo.pinecone_indexes.ollama ?? "—"}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-[var(--muted)]">Google embeddings</td>
                        <td className="px-3 py-2">{serverInfo.pinecone_indexes.google ?? "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
              {serverInfo.vector_store === "faiss" ? (
                <p className="text-xs text-[var(--muted)]">
                  Indexes live under the API&apos;s <code className="rounded bg-[var(--chat-thread)] px-1">data/indices/</code>{" "}
                  directory on disk.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <Segmented<ProviderChoice>
          label="Embeddings (indexing & retrieval)"
          value={embeddingProvider}
          onChange={setEmbeddingProvider}
          options={[
            {
              value: "ollama",
              title: "Ollama",
              hint: "Local embeddings via your Ollama server (see backend .env).",
            },
            {
              value: "google",
              title: "Google Gemini",
              hint: "Uses Gemini embedding models; requires GEMINI_API_KEY on the API server.",
            },
          ]}
        />

        <Segmented<ProviderChoice>
          label="Chat & summaries"
          value={chatProvider}
          onChange={setChatProvider}
          options={[
            {
              value: "ollama",
              title: "Ollama",
              hint: "Local LLM for answers and summaries.",
            },
            {
              value: "google",
              title: "Google Gemini",
              hint: "Gemini for chat and book summaries.",
            },
          ]}
        />

        <Segmented<TtsMode>
          label="Text-to-speech"
          value={ttsMode}
          onChange={setTtsMode}
          options={[
            {
              value: "browser",
              title: "Browser speech",
              hint: "Web Speech API (offline-capable where the OS supports it).",
            },
            {
              value: "gemini",
              title: "Gemini native speech",
              hint: "Higher-quality voice via the API (uses GEMINI_API_KEY on the server; network required).",
            },
          ]}
        />

        <p className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
          Workspace and chat still let you switch providers quickly; those controls update the same saved
          defaults. Each chat session remembers the providers used when it was created.
        </p>
      </div>
    </div>
  );
}
