export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type PomodoroStatus = "idle" | "running" | "paused";

export type PomodoroTimestamp = number | Date;

export interface PomodoroSettings {
  readonly focusMinutes: number;
  readonly shortBreakMinutes: number;
  readonly longBreakMinutes: number;
  readonly sessionsUntilLongBreak: number;
}

interface PomodoroStateBase {
  readonly phase: PomodoroPhase;
  readonly taskId: string | null;
  readonly completedFocusSessions: number;
  readonly focusSessionsSinceLongBreak: number;
}

export interface IdlePomodoroState extends PomodoroStateBase {
  readonly status: "idle";
  readonly startedAt: null;
  readonly endsAt: null;
  readonly elapsedMs: 0;
  readonly remainingMs: number;
}

export interface RunningPomodoroState extends PomodoroStateBase {
  readonly status: "running";
  /** Wall-clock time at which this phase was first started. */
  readonly startedAt: number;
  /** Start of the current running segment (after the latest resume). */
  readonly segmentStartedAt: number;
  /** Scheduled end of the current running segment. */
  readonly endsAt: number;
  /** Active time accumulated before the current running segment. */
  readonly elapsedMs: number;
  readonly remainingMs: null;
}

export interface PausedPomodoroState extends PomodoroStateBase {
  readonly status: "paused";
  readonly startedAt: number;
  readonly pausedAt: number;
  readonly endsAt: null;
  readonly elapsedMs: number;
  readonly remainingMs: number;
}

export type PomodoroState =
  | IdlePomodoroState
  | RunningPomodoroState
  | PausedPomodoroState;

export type PomodoroCommand =
  | {
      readonly type: "start";
      readonly at: PomodoroTimestamp;
      readonly taskId?: string | null;
    }
  | { readonly type: "pause"; readonly at: PomodoroTimestamp }
  | { readonly type: "resume"; readonly at: PomodoroTimestamp }
  | { readonly type: "complete"; readonly at: PomodoroTimestamp }
  | { readonly type: "reset" }
  | { readonly type: "skip"; readonly at: PomodoroTimestamp }
  | { readonly type: "tick"; readonly at: PomodoroTimestamp };

/**
 * Persistence-neutral data from which the database layer can create a
 * PomodoroSession (adding its own id/createdAt/updatedAt fields).
 */
export interface PomodoroSessionDraft {
  readonly taskId: string | null;
  readonly phase: PomodoroPhase;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly plannedDurationMs: number;
  /** Active timer time. Paused wall-clock time is excluded. */
  readonly elapsedDurationMs: number;
  readonly outcome: "completed" | "skipped";
  /** One-based completed focus count; null for breaks and skipped focuses. */
  readonly focusSessionNumber: number | null;
}

export type PomodoroEvent =
  | {
      readonly type: "sessionFinished";
      readonly session: PomodoroSessionDraft;
    }
  | {
      readonly type: "phaseChanged";
      readonly from: PomodoroPhase;
      readonly to: PomodoroPhase;
      readonly reason: "completed" | "skipped";
    };

export interface PomodoroTransition {
  readonly state: PomodoroState;
  readonly events: readonly PomodoroEvent[];
}

export interface PomodoroSnapshot {
  readonly phase: PomodoroPhase;
  readonly status: PomodoroStatus;
  readonly taskId: string | null;
  readonly completedFocusSessions: number;
  readonly focusSessionsSinceLongBreak: number;
  readonly remainingMs: number;
  readonly startedAt: number | null;
  readonly endsAt: number | null;
}
