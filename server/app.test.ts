import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./config";
import type { AiService } from "./gemini";

const PDF_B64 = Buffer.from("%PDF-1.7\nhello").toString("base64");

let server: Server;
let base: string;
let ai: { [K in keyof AiService]: ReturnType<typeof vi.fn> };

async function start(opts: { verify?: "ok" | "null"; limits?: Partial<ReturnType<typeof loadConfig>["limits"]> } = {}) {
  const config = loadConfig({ GEMINI_API_KEY: "secret-key" } as NodeJS.ProcessEnv);
  config.limits = { ...config.limits, ...opts.limits };
  const verify = opts.verify === "null" ? null : async (t: string) => (t === "good" ? { id: "user-1" } : null);
  const app = createApp({ config, verify, ai: ai as unknown as AiService });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const call = (path: string, body: unknown, token: string | null = "good") =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  ai = {
    extractText: vi.fn().mockResolvedValue("extracted"),
    cleanupText: vi.fn().mockResolvedValue("cleaned"),
    synthesize: vi.fn().mockResolvedValue("QUJD"),
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.restoreAllMocks();
});

describe("authentication", () => {
  it("rejects requests without a token", async () => {
    await start();
    const res = await call("/api/tts", { text: "hi", voice: "Kore" }, null);
    expect(res.status).toBe(401);
    expect(ai.synthesize).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    await start();
    expect((await call("/api/tts", { text: "hi", voice: "Kore" }, "bad")).status).toBe(401);
  });

  it("fails closed when auth is not configured", async () => {
    await start({ verify: "null" });
    const res = await call("/api/tts", { text: "hi", voice: "Kore" });
    expect(res.status).toBe(503);
    expect(ai.synthesize).not.toHaveBeenCalled();
  });

  it("serves health without auth", async () => {
    await start();
    expect((await fetch(base + "/api/health")).status).toBe(200);
  });

  it("does not parse an oversized body before authenticating", async () => {
    await start();
    const res = await call("/api/extract", { pdf: "A".repeat(20 * 1024 * 1024) }, null);
    expect(res.status).toBe(401);
  });
});

describe("/api/extract", () => {
  it("returns extracted text", async () => {
    await start();
    const res = await call("/api/extract", { pdf: PDF_B64 });
    expect(await res.json()).toEqual({ text: "extracted" });
    expect(ai.extractText).toHaveBeenCalledWith(PDF_B64);
  });

  it("rejects data that is not a PDF", async () => {
    await start();
    const res = await call("/api/extract", { pdf: Buffer.from("not a pdf").toString("base64") });
    expect(res.status).toBe(400);
    expect(ai.extractText).not.toHaveBeenCalled();
  });

  it("rejects missing data", async () => {
    await start();
    expect((await call("/api/extract", {})).status).toBe(400);
  });

  it("rejects bodies over the size limit", async () => {
    await start();
    const res = await call("/api/extract", { pdf: "A".repeat(20 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe("/api/cleanup", () => {
  it("cleans text and enforces the length cap", async () => {
    await start();
    expect((await (await call("/api/cleanup", { text: "raw" })).json())).toEqual({ text: "cleaned" });
    expect((await call("/api/cleanup", { text: "x".repeat(100_001) })).status).toBe(413);
    expect((await call("/api/cleanup", { text: "  " })).status).toBe(400);
  });
});

describe("/api/tts", () => {
  it("synthesizes with a valid voice", async () => {
    await start();
    const res = await call("/api/tts", { text: "Hello.", voice: "Puck" });
    expect(await res.json()).toEqual({ audio: "QUJD" });
    expect(ai.synthesize).toHaveBeenCalledWith("Hello.", "Puck");
  });

  it("rejects unknown voices, empty text and over-long text", async () => {
    await start();
    expect((await call("/api/tts", { text: "Hello.", voice: "Nope" })).status).toBe(400);
    expect((await call("/api/tts", { text: "", voice: "Puck" })).status).toBe(400);
    expect((await call("/api/tts", { text: "x".repeat(12_001), voice: "Puck" })).status).toBe(413);
    expect(ai.synthesize).not.toHaveBeenCalled();
  });
});

describe("/api/preview", () => {
  it("caches previews per voice", async () => {
    await start();
    await call("/api/preview", { voice: "Kore" });
    await call("/api/preview", { voice: "Kore" });
    await call("/api/preview", { voice: "Puck" });
    expect(ai.synthesize).toHaveBeenCalledTimes(2);
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once a user exceeds the hourly limit", async () => {
    await start({ limits: { tts: 2 } });
    const body = { text: "Hello.", voice: "Kore" };
    expect((await call("/api/tts", body)).status).toBe(200);
    expect((await call("/api/tts", body)).status).toBe(200);
    const res = await call("/api/tts", body);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });
});

describe("upstream error handling", () => {
  it("maps upstream rate limits to 429 so clients can retry", async () => {
    await start();
    ai.synthesize.mockRejectedValue({ status: 429, message: "RESOURCE_EXHAUSTED" });
    const res = await call("/api/tts", { text: "Hello.", voice: "Kore" });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("AI_RATE_LIMITED");
  });

  it("hides upstream details such as key problems", async () => {
    await start();
    ai.synthesize.mockRejectedValue(new Error("API key not valid. secret-key"));
    const res = await call("/api/tts", { text: "Hello.", voice: "Kore" });
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain("secret-key");
    expect(text).not.toContain("API key not valid");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    await start();
    const res = await fetch(base + "/api/nope");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });
});
