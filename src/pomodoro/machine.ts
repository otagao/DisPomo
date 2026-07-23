import type {
  IdlePomodoroState,
  PausedPomodoroState,
  PomodoroCommand,
  PomodoroEvent,
  PomodoroPhase,
  PomodoroSessionDraft,
  PomodoroSettings,
  PomodoroSnapshot,
  PomodoroState,
  PomodoroTimestamp,
  PomodoroTransition,
  RunningPomodoroState,
} from "./types";

const MILLISECONDS_PER_MINUTE = 60_000;

export class PomodoroTransitionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PomodoroTransitionError";
  }
}

export function validatePomodoroSettings(
  settings: PomodoroSettings,
): PomodoroSettings {
  assertPositiveNumber(settings.focusMinutes, "focusMinutes");
  assertPositiveNumber(settings.shortBreakMinutes, "shortBreakMinutes");
  assertPositiveNumber(settings.longBreakMinutes, "longBreakMinutes");

  if (
    !Number.isInteger(settings.sessionsUntilLongBreak) ||
    settings.sessionsUntilLongBreak <= 0
  ) {
    throw new RangeError("sessionsUntilLongBreak must be a positive integer");
  }

  return settings;
}

export function phaseDurationMs(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  validatePomodoroSettings(settings);

  switch (phase) {
    case "focus":
      return settings.focusMinutes * MILLISECONDS_PER_MINUTE;
    case "shortBreak":
      return settings.shortBreakMinutes * MILLISECONDS_PER_MINUTE;
    case "longBreak":
      return settings.longBreakMinutes * MILLISECONDS_PER_MINUTE;
  }
}

export function createPomodoroState(
  settings: PomodoroSettings,
  taskId: string | null = null,
): IdlePomodoroState {
  return createIdleState(
    "focus",
    settings,
    taskId,
    0,
    0,
  );
}

/**
 * Applies one command without reading the system clock or performing I/O.
 *
 * Consumers should persist the returned state only when commands occur. While
 * running, the visible countdown is obtained with getRemainingMs/getSnapshot.
 */
export function reducePomodoro(
  state: PomodoroState,
  command: PomodoroCommand,
  settings: PomodoroSettings,
): PomodoroTransition {
  validatePomodoroSettings(settings);

  switch (command.type) {
    case "start":
      return withoutEvents(start(state, toTimestamp(command.at), command.taskId));
    case "pause":
      return pauseOrFinish(state, settings, toTimestamp(command.at));
    case "resume":
      return withoutEvents(resume(state, toTimestamp(command.at)));
    case "complete":
      return finish(state, settings, toTimestamp(command.at), "completed");
    case "reset":
      return withoutEvents(reset(state, settings));
    case "skip":
      return skip(state, settings, toTimestamp(command.at));
    case "tick":
      return tick(state, settings, toTimestamp(command.at));
  }
}

export function getRemainingMs(
  state: PomodoroState,
  now: PomodoroTimestamp,
): number {
  const timestamp = toTimestamp(now);

  if (state.status === "running") {
    return Math.max(0, state.endsAt - timestamp);
  }

  return state.remainingMs;
}

export function getSnapshot(
  state: PomodoroState,
  now: PomodoroTimestamp,
): PomodoroSnapshot {
  return {
    phase: state.phase,
    status: state.status,
    taskId: state.taskId,
    completedFocusSessions: state.completedFocusSessions,
    focusSessionsSinceLongBreak: state.focusSessionsSinceLongBreak,
    remainingMs: getRemainingMs(state, now),
    startedAt: state.startedAt,
    endsAt: state.endsAt,
  };
}

function start(
  state: PomodoroState,
  at: number,
  taskId: string | null | undefined,
): RunningPomodoroState {
  assertTimestamp(at, "start.at");
  assertStatus(state, "idle", "start");

  return {
    phase: state.phase,
    status: "running",
    taskId: taskId === undefined ? state.taskId : taskId,
    completedFocusSessions: state.completedFocusSessions,
    focusSessionsSinceLongBreak: state.focusSessionsSinceLongBreak,
    startedAt: at,
    segmentStartedAt: at,
    endsAt: at + state.remainingMs,
    elapsedMs: 0,
    remainingMs: null,
  };
}

function pause(state: PomodoroState, at: number): PausedPomodoroState {
  assertTimestamp(at, "pause.at");
  assertStatus(state, "running", "pause");
  assertNotBefore(at, state.segmentStartedAt, "pause.at");

  const segmentElapsedMs = Math.min(
    at - state.segmentStartedAt,
    state.endsAt - state.segmentStartedAt,
  );

  return {
    phase: state.phase,
    status: "paused",
    taskId: state.taskId,
    completedFocusSessions: state.completedFocusSessions,
    focusSessionsSinceLongBreak: state.focusSessionsSinceLongBreak,
    startedAt: state.startedAt,
    pausedAt: at,
    endsAt: null,
    elapsedMs: state.elapsedMs + segmentElapsedMs,
    remainingMs: Math.max(0, state.endsAt - at),
  };
}

function pauseOrFinish(
  state: PomodoroState,
  settings: PomodoroSettings,
  at: number,
): PomodoroTransition {
  assertStatus(state, "running", "pause");

  if (at >= state.endsAt) {
    return finish(state, settings, state.endsAt, "completed");
  }

  return withoutEvents(pause(state, at));
}

function resume(state: PomodoroState, at: number): RunningPomodoroState {
  assertTimestamp(at, "resume.at");
  assertStatus(state, "paused", "resume");
  assertNotBefore(at, state.pausedAt, "resume.at");

  return {
    phase: state.phase,
    status: "running",
    taskId: state.taskId,
    completedFocusSessions: state.completedFocusSessions,
    focusSessionsSinceLongBreak: state.focusSessionsSinceLongBreak,
    startedAt: state.startedAt,
    segmentStartedAt: at,
    endsAt: at + state.remainingMs,
    elapsedMs: state.elapsedMs,
    remainingMs: null,
  };
}

function reset(
  state: PomodoroState,
  settings: PomodoroSettings,
): IdlePomodoroState {
  return createIdleState(
    state.phase,
    settings,
    state.taskId,
    state.completedFocusSessions,
    state.focusSessionsSinceLongBreak,
  );
}

function tick(
  state: PomodoroState,
  settings: PomodoroSettings,
  at: number,
): PomodoroTransition {
  assertTimestamp(at, "tick.at");

  if (state.status !== "running" || at < state.endsAt) {
    return withoutEvents(state);
  }

  // Use the scheduled end, not a delayed tick time, so session duration is
  // deterministic even if the process was suspended.
  return finish(state, settings, state.endsAt, "completed");
}

function skip(
  state: PomodoroState,
  settings: PomodoroSettings,
  at: number,
): PomodoroTransition {
  assertTimestamp(at, "skip.at");

  if (state.status === "idle") {
    return advanceWithoutSession(state, settings, "skipped");
  }

  return finish(state, settings, at, "skipped");
}

function finish(
  state: PomodoroState,
  settings: PomodoroSettings,
  endedAt: number,
  outcome: "completed" | "skipped",
): PomodoroTransition {
  assertTimestamp(endedAt, `${outcome}.at`);

  if (state.status === "idle") {
    throw new PomodoroTransitionError(
      `Cannot ${outcome === "completed" ? "complete" : "skip"} an idle timer`,
    );
  }

  const session = createSessionDraft(state, endedAt, outcome);
  const counters = nextCounters(state, settings, outcome);
  const nextPhase = nextPhaseAfter(state.phase, counters.useLongBreak);
  const nextState = createIdleState(
    nextPhase,
    settings,
    state.taskId,
    counters.completedFocusSessions,
    counters.focusSessionsSinceLongBreak,
  );

  const events: readonly PomodoroEvent[] = [
    { type: "sessionFinished", session },
    {
      type: "phaseChanged",
      from: state.phase,
      to: nextPhase,
      reason: outcome,
    },
  ];

  return { state: nextState, events };
}

function advanceWithoutSession(
  state: IdlePomodoroState,
  settings: PomodoroSettings,
  reason: "skipped",
): PomodoroTransition {
  const nextPhase = nextPhaseAfter(state.phase, false);
  const nextState = createIdleState(
    nextPhase,
    settings,
    state.taskId,
    state.completedFocusSessions,
    state.focusSessionsSinceLongBreak,
  );

  return {
    state: nextState,
    events: [
      {
        type: "phaseChanged",
        from: state.phase,
        to: nextPhase,
        reason,
      },
    ],
  };
}

function createSessionDraft(
  state: RunningPomodoroState | PausedPomodoroState,
  endedAt: number,
  outcome: "completed" | "skipped",
): PomodoroSessionDraft {
  const elapsedDurationMs =
    state.status === "running"
      ? state.elapsedMs +
        clamp(endedAt - state.segmentStartedAt, 0, state.endsAt - state.segmentStartedAt)
      : state.elapsedMs;

  if (state.status === "running") {
    assertNotBefore(endedAt, state.segmentStartedAt, `${outcome}.at`);
  } else {
    assertNotBefore(endedAt, state.pausedAt, `${outcome}.at`);
  }

  return {
    taskId: state.taskId,
    phase: state.phase,
    startedAt: state.startedAt,
    endedAt,
    plannedDurationMs:
      state.status === "running"
        ? state.elapsedMs + (state.endsAt - state.segmentStartedAt)
        : state.elapsedMs + state.remainingMs,
    elapsedDurationMs,
    outcome,
    focusSessionNumber:
      state.phase === "focus" && outcome === "completed"
        ? state.completedFocusSessions + 1
        : null,
  };
}

function nextCounters(
  state: RunningPomodoroState | PausedPomodoroState,
  settings: PomodoroSettings,
  outcome: "completed" | "skipped",
): {
  readonly completedFocusSessions: number;
  readonly focusSessionsSinceLongBreak: number;
  readonly useLongBreak: boolean;
} {
  if (state.phase !== "focus" || outcome !== "completed") {
    return {
      completedFocusSessions: state.completedFocusSessions,
      focusSessionsSinceLongBreak: state.focusSessionsSinceLongBreak,
      useLongBreak: false,
    };
  }

  const completedFocusSessions = state.completedFocusSessions + 1;
  const cycleCount = state.focusSessionsSinceLongBreak + 1;
  const useLongBreak = cycleCount >= settings.sessionsUntilLongBreak;

  return {
    completedFocusSessions,
    focusSessionsSinceLongBreak: useLongBreak ? 0 : cycleCount,
    useLongBreak,
  };
}

function nextPhaseAfter(
  phase: PomodoroPhase,
  useLongBreak: boolean,
): PomodoroPhase {
  if (phase === "focus") {
    return useLongBreak ? "longBreak" : "shortBreak";
  }

  return "focus";
}

function createIdleState(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
  taskId: string | null,
  completedFocusSessions: number,
  focusSessionsSinceLongBreak: number,
): IdlePomodoroState {
  return {
    phase,
    status: "idle",
    taskId,
    completedFocusSessions,
    focusSessionsSinceLongBreak,
    startedAt: null,
    endsAt: null,
    elapsedMs: 0,
    remainingMs: phaseDurationMs(phase, settings),
  };
}

function withoutEvents(state: PomodoroState): PomodoroTransition {
  return { state, events: [] };
}

function assertPositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertTimestamp(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isFinite(new Date(value).getTime())) {
    throw new RangeError(`${name} must be a valid finite timestamp`);
  }
}

function toTimestamp(value: PomodoroTimestamp): number {
  const timestamp = value instanceof Date ? value.getTime() : value;
  assertTimestamp(timestamp, "timestamp");
  return timestamp;
}

function assertNotBefore(value: number, lowerBound: number, name: string): void {
  if (value < lowerBound) {
    throw new RangeError(`${name} cannot be before the current timer segment`);
  }
}

function assertStatus<TStatus extends PomodoroState["status"]>(
  state: PomodoroState,
  status: TStatus,
  command: string,
): asserts state is Extract<PomodoroState, { readonly status: TStatus }> {
  if (state.status !== status) {
    throw new PomodoroTransitionError(
      `Cannot ${command} a timer with status ${state.status}`,
    );
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
