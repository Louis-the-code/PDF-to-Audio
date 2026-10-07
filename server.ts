import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApp } from "./server/app";
import { createSupabaseVerifier } from "./server/auth";
import { loadConfig } from "./server/config";
import { createGeminiService } from "./server/gemini";

// Same precedence as Vite: .env.local overrides .env.
dotenv.config({ path: [".env.local", ".env"] });

async function startServer() {
  const config = loadConfig();

  if (!config.geminiApiKey) {
    console.warn("GEMINI_API_KEY is not set: AI endpoints will fail until it is configured.");
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn("Supabase is not configured: AI endpoints will refuse all requests (they require sign-in).");
  }

  const verify =
    config.supabaseUrl && config.supabaseAnonKey
      ? createSupabaseVerifier(config.supabaseUrl, config.supabaseAnonKey)
      : null;

  const app = createApp({ config, verify, ai: createGeminiService(config) });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

startServer();
