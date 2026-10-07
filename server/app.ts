import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import {
  MAX_CLEANUP_CHARS,
  MAX_PDF_BYTES,
  MAX_TTS_CHARS,
  VOICES,
  type Voice,
} from "../shared/config";
import { requireAuth, type TokenVerifier } from "./auth";
import type { ServerConfig } from "./config";
import type { AiService } from "./gemini";
import { createRateLimiter } from "./rateLimit";

export interface AppDeps {
  config: ServerConfig;
  /** null means auth is not configured; protected routes then refuse every request. */
  verify: TokenVerifier | null;
  ai: AiService;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Maps an upstream AI error to a response that never leaks internals. */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 0;
  const message = String((err as { message?: unknown })?.message ?? err);

  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
    return new HttpError(429, "The AI service is busy. Please wait a moment and try again.", "AI_RATE_LIMITED");
  }
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED/i.test(message) || status === 401 || status === 403) {
    return new HttpError(502, "The AI service is not configured correctly. Please contact the site owner.", "AI_MISCONFIGURED");
  }
  if (status === 400) {
    return new HttpError(422, "The AI service could not process this content.", "AI_REJECTED");
  }
  return new HttpError(502, "The AI service is temporarily unavailable. Please try again.", "AI_UNAVAILABLE");
}

const isVoice = (v: unknown): v is Voice => typeof v === "string" && (VOICES as readonly string[]).includes(v);

const handler =
  (fn: (req: express.Request, res: express.Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function createApp({ config, verify, ai }: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    next();
  });

  const api = express.Router();
  const auth = requireAuth(verify);
  const small = express.json({ limit: "256kb" });
  const large = express.json({ limit: config.pdfJsonLimitBytes });
  const previewCache = new Map<Voice, string>();

  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Order matters: authenticate and rate-limit before parsing a large body.
  api.post(
    "/extract",
    auth,
    createRateLimiter("PDF extraction", config.limits.extract),
    large,
    handler(async (req, res) => {
      const pdf = req.body?.pdf;
      if (typeof pdf !== "string" || pdf.length === 0) {
        throw new HttpError(400, "Missing PDF data.", "BAD_REQUEST");
      }
      const bytes = Buffer.from(pdf, "base64");
      if (bytes.length > MAX_PDF_BYTES) {
        throw new HttpError(413, "File size exceeds the 10MB limit.", "TOO_LARGE");
      }
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new HttpError(400, "That doesn't look like a valid PDF.", "BAD_REQUEST");
      }
      res.json({ text: await ai.extractText(pdf) });
    }),
  );

  api.post(
    "/cleanup",
    auth,
    createRateLimiter("text cleanup", config.limits.cleanup),
    express.json({ limit: "1mb" }),
    handler(async (req, res) => {
      const text = req.body?.text;
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new HttpError(400, "Missing text.", "BAD_REQUEST");
      }
      if (text.length > MAX_CLEANUP_CHARS) {
        throw new HttpError(413, "Text is too long to clean up.", "TOO_LARGE");
      }
      res.json({ text: await ai.cleanupText(text) });
    }),
  );

  api.post(
    "/tts",
    auth,
    createRateLimiter("audio generation", config.limits.tts),
    small,
    handler(async (req, res) => {
      const { text, voice } = req.body ?? {};
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new HttpError(400, "Missing text.", "BAD_REQUEST");
      }
      if (text.length > MAX_TTS_CHARS) {
        throw new HttpError(413, `Segments are limited to ${MAX_TTS_CHARS} characters.`, "TOO_LARGE");
      }
      if (!isVoice(voice)) throw new HttpError(400, "Unknown voice.", "BAD_REQUEST");
      res.json({ audio: await ai.synthesize(text, voice) });
    }),
  );

  api.post(
    "/preview",
    auth,
    createRateLimiter("voice previews", 60),
    small,
    handler(async (req, res) => {
      const voice = req.body?.voice;
      if (!isVoice(voice)) throw new HttpError(400, "Unknown voice.", "BAD_REQUEST");
      let audio = previewCache.get(voice);
      if (!audio) {
        audio = await ai.synthesize(`Hello, my name is ${voice}.`, voice);
        previewCache.set(voice, audio);
      }
      res.json({ audio });
    }),
  );

  api.use((_req, res) => {
    res.status(404).json({ error: "Not found.", code: "NOT_FOUND" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    // body-parser errors carry their own status (413 too large, 400 bad JSON).
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "Request is too large.", code: "TOO_LARGE" });
      return;
    }
    if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid request body.", code: "BAD_REQUEST" });
      return;
    }
    const httpError = toHttpError(err);
    if (!(err instanceof HttpError)) console.error("API error:", err);
    res.status(httpError.status).json({ error: httpError.message, code: httpError.code });
  };
  api.use(onError);

  app.use("/api", api);
  return app;
}
