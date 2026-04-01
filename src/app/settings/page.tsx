"use client";

import { useWorkspaceApp } from "@/providers/WorkspaceAppProvider";
import type { ProviderChoice, TtsMode } from "@/lib/appSettings";

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

export default function SettingsPage() {
  const {
    embeddingProvider,
    setEmbeddingProvider,
    chatProvider,
    setChatProvider,
    ttsMode,
    setTtsMode,
  } = useWorkspaceApp();

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
