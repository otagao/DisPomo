export {};

declare global {
  type PomodoroPhase = "focus" | "shortBreak" | "longBreak";
  type PomodoroStatus = "idle" | "running" | "paused";
  type PomodoroCommandType = "start" | "pause" | "resume" | "reset" | "skip";
  type DiscordPrivacy = "task" | "project" | "generic";

  interface Project {
    id: string;
    name: string;
    color?: string;
    createdAt: string;
    updatedAt: string;
  }

  interface Subtask {
    id: string;
    taskId: string;
    title: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }

  interface Task {
    id: string;
    projectId: string;
    title: string;
    notes?: string;
    estimatedPomodoros?: number;
    completedPomodoros?: number;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    subtasks: Subtask[];
  }

  interface PomodoroState {
    phase: PomodoroPhase;
    status: PomodoroStatus;
    taskId: string | null;
    durationMs: number;
    remainingMs: number;
    completedFocusSessions: number;
    startedAt: number | null;
    endsAt: number | null;
  }

  interface PomodoroHistoryEntry {
    id: string;
    taskId: string | null;
    taskTitle?: string;
    phase: PomodoroPhase;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    outcome?: "completed" | "skipped" | "reset";
  }

  interface AppSettings {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    sessionsUntilLongBreak: number;
    discordEnabled: boolean;
    discordPrivacy: DiscordPrivacy;
    discordClientId: string;
  }

  interface AppSnapshot {
    projects: Project[];
    tasks: Task[];
    pomodoro: PomodoroState;
    history: PomodoroHistoryEntry[];
    settings: AppSettings;
    selectedTaskId?: string | null;
  }

  interface DisPomoApi {
    getSnapshot: () => Promise<AppSnapshot>;
    createProject: (input: {
      name: string;
      color?: string;
    }) => Promise<AppSnapshot | void>;
    createTask: (input: {
      projectId: string;
      title: string;
      estimatedPomodoros?: number;
    }) => Promise<AppSnapshot | void>;
    createSubtask: (input: {
      taskId: string;
      title: string;
    }) => Promise<AppSnapshot | void>;
    toggleTask: (id: string) => Promise<AppSnapshot | void>;
    toggleSubtask: (id: string) => Promise<AppSnapshot | void>;
    deleteProject: (id: string) => Promise<AppSnapshot | void>;
    deleteTask: (id: string) => Promise<AppSnapshot | void>;
    deleteSubtask: (id: string) => Promise<AppSnapshot | void>;
    pomodoroCommand: (command: {
      type: PomodoroCommandType;
      taskId?: string;
    }) => Promise<AppSnapshot | void>;
    saveSettings: (settings: AppSettings) => Promise<AppSnapshot | void>;
    onSnapshot: (listener: (snapshot: AppSnapshot) => void) => (() => void) | void;
  }

  interface Window {
    dispomo: DisPomoApi;
  }
}
