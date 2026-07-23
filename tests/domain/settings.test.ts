import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISCORD_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
  applySettingsUpdate,
  createDefaultSettings,
} from "../../src/domain";

describe("settings", () => {
  it("creates complete default settings", () => {
    const first = createDefaultSettings("settings-1", "2026-07-23T00:00:00Z");

    expect(first).toMatchObject(DEFAULT_POMODORO_SETTINGS);
    expect(first).toMatchObject(DEFAULT_DISCORD_SETTINGS);
    expect(first.id).toBe("settings-1");
  });

  it("applies patches without mutating existing settings", () => {
    const current = createDefaultSettings(
      "settings-1",
      "2026-07-23T00:00:00Z",
    );
    const updated = applySettingsUpdate(
      current,
      {
        focusMinutes: 50,
        discordPrivacy: "generic",
      },
      "2026-07-23T01:00:00Z",
    );

    expect(updated.focusMinutes).toBe(50);
    expect(updated.shortBreakMinutes).toBe(5);
    expect(updated.discordPrivacy).toBe("generic");
    expect(updated.updatedAt).toBe("2026-07-23T01:00:00Z");
    expect(current.focusMinutes).toBe(25);
    expect(current.discordPrivacy).toBe("task");
  });

  it("is JSON serializable for IPC", () => {
    const settings = createDefaultSettings(
      "settings-1",
      "2026-07-23T00:00:00Z",
    );

    expect(JSON.parse(JSON.stringify(settings))).toEqual(settings);
  });
});
