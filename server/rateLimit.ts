import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number;
}

/** Fixed-window per-user limiter. In-memory, so it is per server instance. */
export function createRateLimiter(name: string, max: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const t = now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= t) buckets.delete(key);
  }, 5 * 60 * 1000);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.user?.id ?? req.ip ?? "anonymous";
    const t = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      bucket = { count: 0, resetAt: t + WINDOW_MS };
      buckets.set(key, bucket);
    }
    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - t) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: `Hourly limit reached for ${name}. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        code: "RATE_LIMITED",
      });
      return;
    }
    bucket.count++;
    next();
  };
}
