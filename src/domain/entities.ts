import type { EntityMetadata, IsoDateTime, UUID } from "./common";

export type TaskStatus = "todo" | "in_progress" | "completed";
export type PomodoroPhase = "focus" | "short_break" | "long_break";
export type PomodoroSessionOutcome = "completed" | "interrupted";
export type PresencePrivacyMode = "task" | "project" | "generic";

export type Project = EntityMetadata & {
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  archived: boolean;
};

export type Task = EntityMetadata & {
  projectId: UUID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  completedAt: IsoDateTime | null;
  estimatedPomodoros: number | null;
  sortOrder: number;
};

export type Subtask = EntityMetadata & {
  taskId: UUID;
  title: string;
  isCompleted: boolean;
  completedAt: IsoDateTime | null;
  sortOrder: number;
};

/**
 * A persisted history record. The active countdown is intentionally a
 * separate runtime concern; a session is stored once it completes or stops.
 */
export type PomodoroSession = EntityMetadata & {
  taskId: UUID | null;
  phase: PomodoroPhase;
  outcome: PomodoroSessionOutcome;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime;
  plannedDurationSeconds: number;
  elapsedSeconds: number;
  focusSessionNumber: number | null;
};

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
};

export type DiscordSettings = {
  discordEnabled: boolean;
  discordPrivacy: PresencePrivacyMode;
  discordClientId: string;
  genericTaskText: string;
  showSubtaskProgress: boolean;
  showPomodoroProgress: boolean;
};

export type DesktopSettings = {
  minimizeToTray: boolean;
  closeToTray: boolean;
  notificationsEnabled: boolean;
};

/**
 * Settings are flat so they map directly to one local settings record and are
 * straightforward to expose through typed IPC.
 */
export type Settings = EntityMetadata &
  PomodoroSettings &
  DiscordSettings &
  DesktopSettings;
