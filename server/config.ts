import { MAX_BATCH_BYTES } from "../shared/config";

const int = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface ServerConfig {
  port: number;
  geminiApiKey: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  /** Extraction models in order of preference; the next is tried if one isn't available. */
  models: { extract: string[]; tts: string };
  /** Max requests per user per hour for each endpoint. */
  limits: { extract: number; cleanup: number; tts: number };
  /** Base64 inflates by 4/3; leave headroom for the JSON envelope. */
  pdfJsonLimitBytes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: int(env.PORT, 3000),
    geminiApiKey: env.GEMINI_API_KEY,
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    models: {
      // Fast "Flash" model first; the Pro model (slower, known to work) is the fallback.
      extract: (env.GEMINI_EXTRACT_MODEL || "gemini-3-flash-preview,gemini-2.5-flash,gemini-3.1-pro-preview")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      tts: env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
    },
    limits: {
      // Large documents are processed in page batches and many voice segments,
      // so these are per-request counts, sized for a few books an hour.
      extract: int(env.RATE_LIMIT_EXTRACT_PER_HOUR, 300),
      cleanup: int(env.RATE_LIMIT_CLEANUP_PER_HOUR, 60),
      tts: int(env.RATE_LIMIT_TTS_PER_HOUR, 1500),
    },
    pdfJsonLimitBytes: Math.ceil((MAX_BATCH_BYTES * 4) / 3) + 64 * 1024,
  };
}
