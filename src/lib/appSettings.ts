export type ProviderChoice = "ollama" | "google";
export type TtsMode = "browser" | "gemini";

const STORAGE_KEY = "bookchat-app-settings";

export type AppSettings = {
  embeddingProvider: ProviderChoice;
  chatProvider: ProviderChoice;
  ttsMode: TtsMode;
};

const DEFAULTS: AppSettings = {
  embeddingProvider: "ollama",
  chatProvider: "ollama",
  ttsMode: "browser",
};

function safeParse(raw: string | null): Partial<AppSettings> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    return v as Partial<AppSettings>;
  } catch {
    return null;
  }
}

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  const partial = safeParse(window.localStorage.getItem(STORAGE_KEY));
  if (!partial) return { ...DEFAULTS };
  return {
    embeddingProvider:
      partial.embeddingProvider === "google" || partial.embeddingProvider === "ollama"
        ? partial.embeddingProvider
        : DEFAULTS.embeddingProvider,
    chatProvider:
      partial.chatProvider === "google" || partial.chatProvider === "ollama"
        ? partial.chatProvider
        : DEFAULTS.chatProvider,
    ttsMode:
      partial.ttsMode === "gemini" || partial.ttsMode === "browser"
        ? partial.ttsMode
        : DEFAULTS.ttsMode,
  };
}

export function mergeAppSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...readAppSettings(), ...partial };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
