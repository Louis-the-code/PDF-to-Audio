import type { Voice } from "../../shared/config";
import { supabase } from "./supabase";

/** An error from our own backend. `status` is 0 when the network failed. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
    /** Server-suggested wait before retrying, in milliseconds. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function accessToken(): Promise<string> {
  if (!supabase) throw new ApiError(401, "Sign-in is not configured.", "UNAUTHENTICATED");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Please sign in to use this feature.", "UNAUTHENTICATED");
  return token;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error. Please check your connection and try again.", "NETWORK");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    let code = "UNKNOWN";
    try {
      const json = await response.json();
      if (typeof json?.error === "string") message = json.error;
      if (typeof json?.code === "string") code = json.code;
    } catch {
      // Non-JSON error body (e.g. a proxy page); keep the generic message.
    }
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, message, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
  }
  return (await response.json()) as T;
}

export const api = {
  extractPdf: (pdfBase64: string) => post<{ text: string }>("/extract", { pdf: pdfBase64 }).then((r) => r.text),
  cleanupText: (text: string) => post<{ text: string }>("/cleanup", { text }).then((r) => r.text),
  /** Returns base64 of 16-bit PCM audio. */
  synthesize: (text: string, voice: Voice) => post<{ audio: string }>("/tts", { text, voice }).then((r) => r.audio),
  previewVoice: (voice: Voice) => post<{ audio: string }>("/preview", { voice }).then((r) => r.audio),
};
