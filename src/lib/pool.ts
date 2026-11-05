/**
 * Concurrency that adapts to the provider's rate limit: halve on "slow down",
 * creep back up after a run of successes. Works the same on a free key (a few
 * requests a minute) and a paid one (many in parallel).
 */
export class AdaptiveLimit {
  private active = 0;
  private waiting: (() => void)[] = [];
  private streak = 0;

  constructor(
    private limit: number,
    private readonly max: number = limit,
    /** Successes in a row before allowing one more parallel request. */
    private readonly growAfter = 4,
  ) {}

  get current() {
    return this.limit;
  }

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  release() {
    this.active--;
    this.drain();
  }

  /** The provider said "too many requests": run fewer at once. */
  backoff() {
    this.streak = 0;
    this.limit = Math.max(1, Math.floor(this.limit / 2));
  }

  success() {
    if (++this.streak >= this.growAfter && this.limit < this.max) {
      this.streak = 0;
      this.limit++;
      this.drain();
    }
  }

  private drain() {
    while (this.waiting.length > 0 && this.active < this.limit) this.waiting.shift()!();
  }
}

/**
 * Runs `worker` over `items`, starting them in order with at most `limit.current`
 * in flight. Results keep the input order. The first failure stops new work
 * from starting and is re-thrown once in-flight work has settled.
 */
export async function runPool<T, R>(
  items: T[],
  limit: AdaptiveLimit,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const running: Promise<void>[] = [];
  let failure: { error: unknown } | null = null;

  for (let i = 0; i < items.length; i++) {
    await limit.acquire();
    if (failure || signal?.aborted) {
      limit.release();
      break;
    }
    running.push(
      worker(items[i], i)
        .then((value) => {
          results[i] = value;
        })
        .catch((error) => {
          failure ??= { error };
        })
        .finally(() => limit.release()),
    );
  }

  await Promise.all(running);
  if (failure) throw (failure as { error: unknown }).error;
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  return results;
}
