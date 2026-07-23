import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppStore } from "../../src/database/store";

const directories: string[] = [];

function createStore(): AppStore {
  const directory = mkdtempSync(join(tmpdir(), "dispomo-store-"));
  directories.push(directory);
  return new AppStore(join(directory, "test.sqlite"));
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("AppStore", () => {
  it("persists a project, task, subtask and their completion state", () => {
    const store = createStore();
    const project = store.createProject({ name: "DisPomo", color: "#66a6ff" });
    const task = store.createTask({
      projectId: project.id,
      title: "MVPを作る",
      estimatedPomodoros: 3
    });
    const subtask = store.createSubtask({
      taskId: task.id,
      title: "永続化を追加"
    });

    store.toggleSubtask(subtask.id);
    store.toggleTask(task.id);
    const snapshot = store.snapshot();

    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.tasks[0]?.status).toBe("completed");
    expect(snapshot.subtasks[0]?.isCompleted).toBe(true);
    store.close();
  });

  it("soft-deletes a project aggregate without deleting session history", () => {
    const store = createStore();
    const project = store.createProject({ name: "Work" });
    const task = store.createTask({
      projectId: project.id,
      title: "Report",
      estimatedPomodoros: 1
    });
    store.addPomodoroSession({
      taskId: task.id,
      phase: "focus",
      startedAt: 1_000,
      endedAt: 61_000,
      plannedDurationMs: 60_000,
      elapsedDurationMs: 60_000,
      outcome: "completed",
      focusSessionNumber: 1
    });

    store.softDelete("project", project.id);
    const snapshot = store.snapshot();

    expect(snapshot.projects).toEqual([]);
    expect(snapshot.tasks).toEqual([]);
    expect(snapshot.history).toHaveLength(1);
    store.close();
  });

  it("persists settings and active timer state", () => {
    const directory = mkdtempSync(join(tmpdir(), "dispomo-store-"));
    directories.push(directory);
    const filename = join(directory, "test.sqlite");
    const first = new AppStore(filename);
    first.saveSettings({ focusMinutes: 42, discordPrivacy: "generic" });
    first.savePomodoroState({
      phase: "focus",
      status: "idle",
      taskId: null,
      completedFocusSessions: 0,
      focusSessionsSinceLongBreak: 0,
      startedAt: null,
      endsAt: null,
      elapsedMs: 0,
      remainingMs: 42 * 60_000
    });
    first.close();

    const reopened = new AppStore(filename);
    expect(reopened.getSettings().focusMinutes).toBe(42);
    expect(reopened.getSettings().discordPrivacy).toBe("generic");
    expect(reopened.getPomodoroState()?.remainingMs).toBe(42 * 60_000);
    reopened.close();
  });
});
