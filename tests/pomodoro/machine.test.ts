import { describe, expect, it } from "vitest";

import {
  PomodoroTransitionError,
  createPomodoroState,
  getRemainingMs,
  reducePomodoro,
  toCreatePomodoroSessionInput,
  type PomodoroSettings,
  type PomodoroState,
} from "../../src/pomodoro";

const settings: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

const minute = 60_000;

function command(
  state: PomodoroState,
  value: Parameters<typeof reducePomodoro>[1],
) {
  return reducePomodoro(state, value, settings);
}

describe("pomodoro state machine", () => {
  it("starts a task-linked focus session and derives remaining time", () => {
    const idle = createPomodoroState(settings);
    const { state, events } = command(idle, {
      type: "start",
      at: 1_000,
      taskId: "task-1",
    });

    expect(state).toMatchObject({
      phase: "focus",
      status: "running",
      taskId: "task-1",
      startedAt: 1_000,
      endsAt: 1_000 + 25 * minute,
    });
    expect(getRemainingMs(state, 1_000 + 4 * minute)).toBe(21 * minute);
    expect(events).toEqual([]);
  });

  it("accepts Date values while keeping state JSON-serializable", () => {
    const { state } = command(createPomodoroState(settings), {
      type: "start",
      at: new Date(5_000),
    });

    expect(state.startedAt).toBe(5_000);
    expect(getRemainingMs(state, new Date(5_000 + minute))).toBe(24 * minute);
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("pauses and resumes without counting paused wall-clock time", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 0,
    }).state;
    const paused = command(started, {
      type: "pause",
      at: 5 * minute,
    }).state;

    expect(paused).toMatchObject({
      status: "paused",
      elapsedMs: 5 * minute,
      remainingMs: 20 * minute,
    });
    expect(getRemainingMs(paused, 100 * minute)).toBe(20 * minute);

    const resumed = command(paused, {
      type: "resume",
      at: 10 * minute,
    }).state;
    expect(resumed).toMatchObject({
      status: "running",
      startedAt: 0,
      endsAt: 30 * minute,
      elapsedMs: 5 * minute,
    });
  });

  it("does not transition on tick before the scheduled end", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 0,
    }).state;
    const result = command(started, {
      type: "tick",
      at: 24 * minute,
    });

    expect(result.state).toBe(started);
    expect(result.events).toEqual([]);
  });

  it("finishes instead of entering a zero-time pause at the scheduled end", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 0,
    }).state;
    const result = command(started, {
      type: "pause",
      at: 25 * minute,
    });

    expect(result.state).toMatchObject({
      status: "idle",
      phase: "shortBreak",
    });
    expect(result.events[0]).toMatchObject({
      type: "sessionFinished",
      session: { outcome: "completed" },
    });
  });

  it("completes on a delayed tick using the scheduled end timestamp", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 1_000,
      taskId: "task-1",
    }).state;
    const result = command(started, {
      type: "tick",
      at: 40 * minute,
    });

    expect(result.state).toMatchObject({
      phase: "shortBreak",
      status: "idle",
      completedFocusSessions: 1,
      focusSessionsSinceLongBreak: 1,
      remainingMs: 5 * minute,
      taskId: "task-1",
    });
    expect(result.events[0]).toEqual({
      type: "sessionFinished",
      session: {
        taskId: "task-1",
        phase: "focus",
        startedAt: 1_000,
        endedAt: 1_000 + 25 * minute,
        plannedDurationMs: 25 * minute,
        elapsedDurationMs: 25 * minute,
        outcome: "completed",
        focusSessionNumber: 1,
      },
    });
    expect(result.events[1]).toEqual({
      type: "phaseChanged",
      from: "focus",
      to: "shortBreak",
      reason: "completed",
    });
  });

  it("uses a long break after the configured number of completed focuses", () => {
    let state = createPomodoroState(settings);

    for (let focusNumber = 1; focusNumber <= 4; focusNumber += 1) {
      state = command(state, { type: "start", at: focusNumber * 100_000 }).state;
      state = command(state, {
        type: "complete",
        at: focusNumber * 100_000 + 1,
      }).state;

      if (focusNumber < 4) {
        expect(state.phase).toBe("shortBreak");
        state = command(state, {
          type: "skip",
          at: focusNumber * 100_000 + 2,
        }).state;
      }
    }

    expect(state).toMatchObject({
      phase: "longBreak",
      status: "idle",
      completedFocusSessions: 4,
      focusSessionsSinceLongBreak: 0,
      remainingMs: 15 * minute,
    });
  });

  it("completes a paused session with only active elapsed time", () => {
    let state = command(createPomodoroState(settings, "task-2"), {
      type: "start",
      at: 0,
    }).state;
    state = command(state, { type: "pause", at: 3 * minute }).state;
    const result = command(state, {
      type: "complete",
      at: 20 * minute,
    });

    expect(result.events[0]).toMatchObject({
      type: "sessionFinished",
      session: {
        taskId: "task-2",
        elapsedDurationMs: 3 * minute,
        endedAt: 20 * minute,
        outcome: "completed",
      },
    });
  });

  it("keeps the session's original planned duration if settings change", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 0,
    }).state;
    const changedSettings = { ...settings, focusMinutes: 50 };
    const result = reducePomodoro(
      started,
      { type: "complete", at: minute },
      changedSettings,
    );

    expect(result.events[0]).toMatchObject({
      type: "sessionFinished",
      session: { plannedDurationMs: 25 * minute },
    });
    expect(result.state.remainingMs).toBe(5 * minute);
  });

  it("records a running skip without incrementing focus completion counters", () => {
    const started = command(createPomodoroState(settings), {
      type: "start",
      at: 0,
    }).state;
    const result = command(started, { type: "skip", at: 2 * minute });

    expect(result.state).toMatchObject({
      phase: "shortBreak",
      completedFocusSessions: 0,
      focusSessionsSinceLongBreak: 0,
    });
    expect(result.events[0]).toMatchObject({
      type: "sessionFinished",
      session: {
        outcome: "skipped",
        elapsedDurationMs: 2 * minute,
        focusSessionNumber: null,
      },
    });
  });

  it("converts completion data into the persisted domain input", () => {
    const started = command(createPomodoroState(settings, "task-4"), {
      type: "start",
      at: Date.UTC(2026, 6, 23, 10),
    }).state;
    const result = command(started, {
      type: "complete",
      at: Date.UTC(2026, 6, 23, 10, 25),
    });
    const event = result.events[0];

    expect(event?.type).toBe("sessionFinished");
    if (event?.type !== "sessionFinished") {
      throw new Error("Expected sessionFinished event");
    }

    expect(toCreatePomodoroSessionInput(event.session)).toEqual({
      taskId: "task-4",
      phase: "focus",
      outcome: "completed",
      startedAt: "2026-07-23T10:00:00.000Z",
      endedAt: "2026-07-23T10:25:00.000Z",
      plannedDurationSeconds: 1_500,
      elapsedSeconds: 1_500,
      focusSessionNumber: 1,
    });
  });

  it("skips an idle phase without creating a session record", () => {
    const result = command(createPomodoroState(settings), {
      type: "skip",
      at: 0,
    });

    expect(result.state.phase).toBe("shortBreak");
    expect(result.events).toEqual([
      {
        type: "phaseChanged",
        from: "focus",
        to: "shortBreak",
        reason: "skipped",
      },
    ]);
  });

  it("resets the current phase and keeps counters and task linkage", () => {
    let state = command(createPomodoroState(settings, "task-3"), {
      type: "start",
      at: 0,
    }).state;
    state = command(state, { type: "pause", at: minute }).state;
    const reset = command(state, { type: "reset" }).state;

    expect(reset).toEqual(createPomodoroState(settings, "task-3"));
  });

  it("rejects invalid transitions and settings", () => {
    expect(() =>
      command(createPomodoroState(settings), { type: "pause", at: 0 }),
    ).toThrow(PomodoroTransitionError);

    expect(() =>
      createPomodoroState({ ...settings, sessionsUntilLongBreak: 0 }),
    ).toThrow(RangeError);
  });
});
