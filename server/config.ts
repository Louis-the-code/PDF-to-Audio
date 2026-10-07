import { MAX_PDF_BYTES } from "../shared/config";

const int = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface ServerConfig {
  port: number;
  geminiApiKey: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  models: { extract: string; tts: string };
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
      extract: env.GEMINI_EXTRACT_MODEL || "gemini-3.1-pro-preview",
      tts: env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
    },
    limits: {
      extract: int(env.RATE_LIMIT_EXTRACT_PER_HOUR, 20),
      cleanup: int(env.RATE_LIMIT_CLEANUP_PER_HOUR, 20),
      tts: int(env.RATE_LIMIT_TTS_PER_HOUR, 400),
    },
    pdfJsonLimitBytes: Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64 * 1024,
  };
}
