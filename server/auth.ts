import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

export interface AuthUser {
  id: string;
  email?: string;
}

/** Resolves a Supabase access token to a user, or null if it is invalid. */
export type TokenVerifier = (token: string) => Promise<AuthUser | null>;

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const CACHE_TTL_MS = 60_000;

export function createSupabaseVerifier(url: string, anonKey: string): TokenVerifier {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A document makes many TTS calls; avoid one Supabase round trip for each.
  const cache = new Map<string, { user: AuthUser; expires: number }>();

  return async (token) => {
    const hit = cache.get(token);
    if (hit && hit.expires > Date.now()) return hit.user;

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      cache.delete(token);
      return null;
    }
    const user = { id: data.user.id, email: data.user.email };
    cache.set(token, { user, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of cache) if (value.expires <= now) cache.delete(key);
    }
    return user;
  };
}

/** Rejects requests that do not carry a valid Supabase session token. */
export function requireAuth(verify: TokenVerifier | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!verify) {
      // Fail closed: never expose paid AI endpoints without auth configured.
      res.status(503).json({ error: "Server authentication is not configured.", code: "AUTH_NOT_CONFIGURED" });
      return;
    }
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "Please sign in to use this feature.", code: "UNAUTHENTICATED" });
      return;
    }
    try {
      const user = await verify(token);
      if (!user) {
        res.status(401).json({ error: "Your session has expired. Please sign in again.", code: "UNAUTHENTICATED" });
        return;
      }
      req.user = user;
      next();
    } catch (err) {
      console.error("Auth verification failed:", err);
      res.status(503).json({ error: "Could not verify your session. Please try again.", code: "AUTH_UNAVAILABLE" });
    }
  };
}
