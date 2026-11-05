/** Where the current stage started, to measure its pace. */
export interface StageStart {
  stage: string;
  time: number;
  done: number;
}

/**
 * Remaining time for the current stage from its observed pace, or null until
 * at least two units have finished (too early to be meaningful).
 */
export function estimateRemainingMs(start: StageStart | null, done: number, total: number, now: number): number | null {
  if (!start) return null;
  const finished = done - start.done;
  const elapsed = now - start.time;
  if (finished < 2 || elapsed <= 0 || done >= total) return null;
  return (elapsed / finished) * (total - done);
}

export function formatRemaining(ms: number): string {
  if (ms < 45_000) return "Less than a minute left";
  const minutes = Math.round(ms / 60_000);
  return minutes <= 1 ? "About a minute left" : `About ${minutes} minutes left`;
}
