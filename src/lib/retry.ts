import { ApiError } from "./api";

/** Never make the user wait longer than this for an automatic retry. */
export const MAX_RETRY_WAIT_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How long to wait before retry number `attempt` (1-based), or null if it isn't worth retrying. */
export function retryDelay(err: unknown, attempt: number): number | null {
  if (!(err instanceof ApiError)) return null;
  // Auth, validation and rejected-content errors will fail the same way again.
  const transient = err.status === 0 || err.status === 429 || err.status === 502 || err.status === 503 || err.status === 504;
  if (!transient) return null;

  const delay = err.retryAfterMs ?? (err.status === 429 ? attempt * 15_000 : attempt * 2_000);
  return delay > MAX_RETRY_WAIT_MS ? null : delay;
}

interface RetryOptions {
  retries?: number;
  /** Called before each wait, so the UI can explain the pause. */
  onWait?: (delayMs: number, err: ApiError) => void;
  sleepFn?: (ms: number) => Promise<void>;
}

export async function withRetry<T>(fn: () => Promise<T>, { retries = 3, onWait, sleepFn = sleep }: RetryOptions = {}): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const delay = attempt <= retries ? retryDelay(err, attempt) : null;
      if (delay === null) throw err;
      onWait?.(delay, err as ApiError);
      await sleepFn(delay);
    }
  }
}
