import { describe, expect, it } from "vitest";
import { getDisplayedSeconds } from "../../src/renderer/timer-display";

const minute = 60_000;

describe("getDisplayedSeconds", () => {
  it("never shows more than the configured duration with a stale clock", () => {
    const now = 100_000;

    expect(
      getDisplayedSeconds(
        {
          durationMs: 25 * minute,
          remainingMs: 25 * minute,
          status: "running",
          // Simulates starting after the renderer clock has been stale for 67s.
          endsAt: now + 26 * minute + 7_000
        },
        now
      )
    ).toBe(25 * 60);
  });

  it("derives a running countdown from the end timestamp", () => {
    const startedAt = 100_000;

    expect(
      getDisplayedSeconds(
        {
          durationMs: 25 * minute,
          remainingMs: 25 * minute,
          status: "running",
          endsAt: startedAt + 25 * minute
        },
        startedAt + 1_100
      )
    ).toBe(24 * 60 + 59);
  });

  it("rounds a paused timer up to the same visible second as a running timer", () => {
    expect(
      getDisplayedSeconds(
        {
          durationMs: 25 * minute,
          remainingMs: 12 * minute + 500,
          status: "paused",
          endsAt: null
        },
        999_999
      )
    ).toBe(721);
  });

  it("keeps the display consistent across the running and paused boundary", () => {
    const now = 100_000;
    const remainingMs = 24 * minute + 55_100;

    const runningSeconds = getDisplayedSeconds(
      {
        durationMs: 25 * minute,
        remainingMs,
        status: "running",
        endsAt: now + remainingMs
      },
      now
    );
    const pausedSeconds = getDisplayedSeconds(
      {
        durationMs: 25 * minute,
        remainingMs,
        status: "paused",
        endsAt: null
      },
      now
    );

    expect(runningSeconds).toBe(24 * 60 + 56);
    expect(pausedSeconds).toBe(runningSeconds);
  });

  it("uses the same rounding while idle", () => {
    expect(
      getDisplayedSeconds(
        {
          durationMs: 1_000,
          remainingMs: 500,
          status: "idle",
          endsAt: null
        },
        0
      )
    ).toBe(1);
  });
});
