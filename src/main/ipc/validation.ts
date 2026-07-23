import type { PomodoroCommandName } from "./channels";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

export function id(value: unknown, label = "id"): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function text(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new Error(`${label} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

function optionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === "") return undefined;
  return text(value, label, maxLength);
}

function integer(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function createProjectInput(value: unknown): {
  name: string;
  color?: string;
} {
  const input = object(value, "project");
  const name = text(input.name, "project.name", 120);
  const color = optionalText(input.color, "project.color", 32);
  return color === undefined ? { name } : { name, color };
}

export function createTaskInput(value: unknown): {
  projectId: string;
  title: string;
  estimatedPomodoros: number;
} {
  const input = object(value, "task");
  return {
    projectId: id(input.projectId, "task.projectId"),
    title: text(input.title, "task.title", 240),
    estimatedPomodoros:
      input.estimatedPomodoros === undefined
        ? 1
        : integer(input.estimatedPomodoros, "task.estimatedPomodoros", 1, 99)
  };
}

export function createSubtaskInput(value: unknown): {
  taskId: string;
  title: string;
} {
  const input = object(value, "subtask");
  return {
    taskId: id(input.taskId, "subtask.taskId"),
    title: text(input.title, "subtask.title", 240)
  };
}

export function commandInput(value: unknown): {
  type: PomodoroCommandName;
  taskId?: string;
} {
  const input = object(value, "pomodoro command");
  const commands: PomodoroCommandName[] = [
    "start",
    "pause",
    "resume",
    "reset",
    "skip"
  ];
  if (
    typeof input.type !== "string" ||
    !commands.includes(input.type as PomodoroCommandName)
  ) {
    throw new Error("Unsupported pomodoro command");
  }
  const type = input.type as PomodoroCommandName;
  const taskId =
    input.taskId === undefined ? undefined : id(input.taskId, "taskId");
  return taskId === undefined ? { type } : { type, taskId };
}

export interface SettingsInput {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  discordEnabled: boolean;
  discordPrivacy: "task" | "project" | "generic";
  discordClientId: string;
}

export function settingsInput(value: unknown): SettingsInput {
  const input = object(value, "settings");
  if (typeof input.discordEnabled !== "boolean") {
    throw new Error("settings.discordEnabled must be a boolean");
  }
  const privacy = input.discordPrivacy;
  if (
    privacy !== "task" &&
    privacy !== "project" &&
    privacy !== "generic"
  ) {
    throw new Error("Unsupported Discord privacy mode");
  }
  const clientId =
    input.discordClientId === undefined
      ? ""
      : typeof input.discordClientId === "string"
        ? input.discordClientId.trim()
        : null;
  if (clientId === null || clientId.length > 64) {
    throw new Error("settings.discordClientId must be a string");
  }
  return {
    focusMinutes: integer(input.focusMinutes, "focusMinutes", 1, 180),
    shortBreakMinutes: integer(
      input.shortBreakMinutes,
      "shortBreakMinutes",
      1,
      60
    ),
    longBreakMinutes: integer(
      input.longBreakMinutes,
      "longBreakMinutes",
      1,
      120
    ),
    sessionsUntilLongBreak: integer(
      input.sessionsUntilLongBreak,
      "sessionsUntilLongBreak",
      1,
      12
    ),
    discordEnabled: input.discordEnabled,
    discordPrivacy: privacy,
    discordClientId: clientId
  };
}
