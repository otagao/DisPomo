import type { JsonObject } from "./common";
import type {
  PomodoroSession,
  Project,
  Settings,
  Subtask,
  Task,
} from "./entities";

/**
 * Explicit DTO aliases for IPC contracts. Domain records contain only JSON
 * primitives, arrays, and plain objects, so no conversion step is required.
 */
export type SerializedProject = Project;
export type SerializedTask = Task;
export type SerializedSubtask = Subtask;
export type SerializedPomodoroSession = PomodoroSession;
export type SerializedSettings = Settings;

export type SerializableEntity =
  | SerializedProject
  | SerializedTask
  | SerializedSubtask
  | SerializedPomodoroSession
  | SerializedSettings;

export type DomainSnapshot = {
  schemaVersion: number;
  projects: SerializedProject[];
  tasks: SerializedTask[];
  subtasks: SerializedSubtask[];
  pomodoroSessions: SerializedPomodoroSession[];
  settings: SerializedSettings;
};

// Compile-time guards: a future non-JSON domain field fails at this boundary.
const projectIsSerializable: SerializedProject extends JsonObject ? true : false =
  true;
const taskIsSerializable: SerializedTask extends JsonObject ? true : false =
  true;
const subtaskIsSerializable: SerializedSubtask extends JsonObject ? true : false =
  true;
const sessionIsSerializable: SerializedPomodoroSession extends JsonObject
  ? true
  : false = true;
const settingsIsSerializable: SerializedSettings extends JsonObject
  ? true
  : false = true;

void projectIsSerializable;
void taskIsSerializable;
void subtaskIsSerializable;
void sessionIsSerializable;
void settingsIsSerializable;
