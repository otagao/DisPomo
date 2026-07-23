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

  it("uses the persisted remaining time while paused", () => {
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
    ).toBe(720.5);
  });
});
