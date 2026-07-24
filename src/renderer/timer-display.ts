export interface TimerDisplayState {
  durationMs: number;
  remainingMs: number;
  status: "idle" | "running" | "paused";
  endsAt: number | null;
}

/**
 * 古いレンダラー時刻でも設定時間を超えない、一貫した表示秒数を返す。
 */
export function getDisplayedSeconds(
  timer: TimerDisplayState,
  now: number
): number {
  const durationSeconds = timer.durationMs / 1_000;
  const remainingMs =
    timer.status === "running" && timer.endsAt !== null
      ? timer.endsAt - now
      : timer.remainingMs;
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  return Math.min(durationSeconds, Math.max(0, remainingSeconds));
}
