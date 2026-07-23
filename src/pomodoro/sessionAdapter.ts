import type { CreatePomodoroSessionInput } from "../domain";
import type { PomodoroPhase, PomodoroSessionDraft } from "./types";

/**
 * Converts a state-machine event payload into the domain/database creation
 * shape. Identity and entity metadata remain the persistence layer's concern.
 */
export function toCreatePomodoroSessionInput(
  draft: PomodoroSessionDraft,
): CreatePomodoroSessionInput {
  return {
    taskId: draft.taskId,
    phase: toPersistedPhase(draft.phase),
    outcome: draft.outcome === "completed" ? "completed" : "interrupted",
    startedAt: new Date(draft.startedAt).toISOString(),
    endedAt: new Date(draft.endedAt).toISOString(),
    plannedDurationSeconds: draft.plannedDurationMs / 1_000,
    elapsedSeconds: draft.elapsedDurationMs / 1_000,
    focusSessionNumber: draft.focusSessionNumber,
  };
}

function toPersistedPhase(
  phase: PomodoroPhase,
): CreatePomodoroSessionInput["phase"] {
  switch (phase) {
    case "focus":
      return "focus";
    case "shortBreak":
      return "short_break";
    case "longBreak":
      return "long_break";
  }
}
