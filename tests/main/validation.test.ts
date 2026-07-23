import { describe, expect, it } from "vitest";
import {
  commandInput,
  createTaskInput,
  settingsInput
} from "../../src/main/ipc/validation";

describe("IPC validation", () => {
  it("normalizes valid task input", () => {
    expect(
      createTaskInput({ projectId: "project", title: "  Task  " })
    ).toEqual({
      projectId: "project",
      title: "Task",
      estimatedPomodoros: 1
    });
  });

  it("rejects malformed timer commands", () => {
    expect(() => commandInput({ type: "complete" })).toThrow(
      "Unsupported pomodoro command"
    );
  });

  it("rejects out-of-range timer settings", () => {
    expect(() =>
      settingsInput({
        focusMinutes: 0,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsUntilLongBreak: 4,
        discordEnabled: true,
        discordPrivacy: "task",
        discordClientId: ""
      })
    ).toThrow("focusMinutes");
  });
});
