import type { Subtask } from "./entities";

export type TaskProgress = {
  completedSubtasks: number;
  totalSubtasks: number;
  ratio: number;
  percent: number;
  isComplete: boolean;
};

type ProgressSubtask = Pick<Subtask, "isCompleted" | "deletedAt">;

/**
 * Calculates task progress from non-deleted subtasks.
 *
 * A task with no active subtasks has 0% subtask progress. Task-level completion
 * remains represented by `Task.status`, so callers do not need to invent a
 * synthetic completed subtask.
 */
export function calculateTaskProgress(
  subtasks: readonly ProgressSubtask[],
): TaskProgress {
  let totalSubtasks = 0;
  let completedSubtasks = 0;

  for (const subtask of subtasks) {
    if (subtask.deletedAt !== null) {
      continue;
    }

    totalSubtasks += 1;
    if (subtask.isCompleted) {
      completedSubtasks += 1;
    }
  }

  const ratio =
    totalSubtasks === 0 ? 0 : completedSubtasks / totalSubtasks;

  return {
    completedSubtasks,
    totalSubtasks,
    ratio,
    percent: ratio * 100,
    isComplete: totalSubtasks > 0 && completedSubtasks === totalSubtasks,
  };
}
