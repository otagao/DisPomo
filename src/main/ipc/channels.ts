export const IPC = {
  getSnapshot: "dispomo:get-snapshot",
  createProject: "dispomo:create-project",
  createTask: "dispomo:create-task",
  createSubtask: "dispomo:create-subtask",
  toggleTask: "dispomo:toggle-task",
  toggleSubtask: "dispomo:toggle-subtask",
  deleteProject: "dispomo:delete-project",
  deleteTask: "dispomo:delete-task",
  deleteSubtask: "dispomo:delete-subtask",
  pomodoroCommand: "dispomo:pomodoro-command",
  saveSettings: "dispomo:save-settings",
  snapshotChanged: "dispomo:snapshot-changed"
} as const;

export type PomodoroCommandName =
  | "start"
  | "pause"
  | "resume"
  | "reset"
  | "skip";
