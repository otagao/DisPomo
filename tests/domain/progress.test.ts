import { describe, expect, it } from "vitest";

import { calculateTaskProgress, type Subtask } from "../../src/domain";

function subtask(
  isCompleted: boolean,
  deletedAt: string | null = null,
): Subtask {
  return {
    id: crypto.randomUUID(),
    taskId: "task-id",
    title: "item",
    isCompleted,
    completedAt: isCompleted ? "2026-07-23T00:00:00.000Z" : null,
    sortOrder: 0,
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    deletedAt,
    schemaVersion: 1,
    ownerId: null,
    deviceId: null,
    syncVersion: 0,
  };
}

describe("calculateTaskProgress", () => {
  it("counts completion and returns ratio and percentage", () => {
    expect(
      calculateTaskProgress([subtask(true), subtask(false), subtask(true)]),
    ).toEqual({
      completedSubtasks: 2,
      totalSubtasks: 3,
      ratio: 2 / 3,
      percent: (2 / 3) * 100,
      isComplete: false,
    });
  });

  it("ignores logically deleted subtasks", () => {
    expect(
      calculateTaskProgress([
        subtask(true),
        subtask(false, "2026-07-23T01:00:00.000Z"),
      ]),
    ).toMatchObject({
      completedSubtasks: 1,
      totalSubtasks: 1,
      percent: 100,
      isComplete: true,
    });
  });

  it("defines an empty task as 0% subtask progress", () => {
    expect(calculateTaskProgress([])).toEqual({
      completedSubtasks: 0,
      totalSubtasks: 0,
      ratio: 0,
      percent: 0,
      isComplete: false,
    });
  });
});
