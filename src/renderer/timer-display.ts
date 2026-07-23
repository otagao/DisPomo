export interface TimerDisplayState {
  durationMs: number;
  remainingMs: number;
  status: "idle" | "running" | "paused";
  endsAt: number | null;
}

/**
 * Derives the visible countdown without allowing a stale renderer clock to
 * display more than the configured phase duration.
 */
export function getDisplayedSeconds(
  timer: TimerDisplayState,
  now: number
): number {
  if (timer.status !== "running" || timer.endsAt === null) {
    return timer.remainingMs / 1_000;
  }

  const durationSeconds = timer.durationMs / 1_000;
  const remainingSeconds = Math.ceil((timer.endsAt - now) / 1_000);
  return Math.min(durationSeconds, Math.max(0, remainingSeconds));
}
