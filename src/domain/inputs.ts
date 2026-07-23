import type { IsoDateTime, UUID } from "./common";
import type {
  DesktopSettings,
  DiscordSettings,
  PomodoroPhase,
  PomodoroSessionOutcome,
  PomodoroSettings,
  TaskStatus,
} from "./entities";

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
  archived?: boolean;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
  archived?: boolean;
};

export type CreateTaskInput = {
  projectId?: UUID | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  completedAt?: IsoDateTime | null;
  estimatedPomodoros?: number | null;
  sortOrder?: number;
};

export type UpdateTaskInput = {
  projectId?: UUID | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completedAt?: IsoDateTime | null;
  estimatedPomodoros?: number | null;
  sortOrder?: number;
};

export type CreateSubtaskInput = {
  taskId: UUID;
  title: string;
  isCompleted?: boolean;
  completedAt?: IsoDateTime | null;
  sortOrder?: number;
};

export type UpdateSubtaskInput = {
  title?: string;
  isCompleted?: boolean;
  completedAt?: IsoDateTime | null;
  sortOrder?: number;
};

export type CreatePomodoroSessionInput = {
  taskId?: UUID | null;
  phase: PomodoroPhase;
  outcome: PomodoroSessionOutcome;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime;
  plannedDurationSeconds: number;
  elapsedSeconds: number;
  focusSessionNumber?: number | null;
};

export type UpdatePomodoroSessionInput = {
  taskId?: UUID | null;
  phase?: PomodoroPhase;
  outcome?: PomodoroSessionOutcome;
  startedAt?: IsoDateTime;
  endedAt?: IsoDateTime;
  plannedDurationSeconds?: number;
  elapsedSeconds?: number;
  focusSessionNumber?: number | null;
};

export type UpdatePomodoroSettingsInput = Partial<PomodoroSettings>;

export type UpdateDiscordSettingsInput = Partial<DiscordSettings>;

export type UpdateDesktopSettingsInput = Partial<DesktopSettings>;

export type CreateSettingsInput = PomodoroSettings &
  DiscordSettings &
  DesktopSettings;

export type UpdateSettingsInput = Partial<CreateSettingsInput>;

/** A deliberate aggregate replace shape for imports and migrations. */
export type ReplaceSettingsInput = CreateSettingsInput;
