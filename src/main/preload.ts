import { contextBridge, ipcRenderer } from "electron";

// Keep the sandboxed preload self-contained: Electron's sandboxed preload
// loader only permits a small set of built-in modules.
const IPC = {
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

const api = {
  getSnapshot: (): Promise<unknown> => ipcRenderer.invoke(IPC.getSnapshot),
  createProject: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IPC.createProject, input),
  createTask: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IPC.createTask, input),
  createSubtask: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IPC.createSubtask, input),
  toggleTask: (targetId: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC.toggleTask, targetId),
  toggleSubtask: (targetId: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC.toggleSubtask, targetId),
  deleteProject: (targetId: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC.deleteProject, targetId),
  deleteTask: (targetId: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC.deleteTask, targetId),
  deleteSubtask: (targetId: string): Promise<unknown> =>
    ipcRenderer.invoke(IPC.deleteSubtask, targetId),
  pomodoroCommand: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IPC.pomodoroCommand, input),
  saveSettings: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke(IPC.saveSettings, input),
  onSnapshot: (listener: (snapshot: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => {
      listener(snapshot);
    };
    ipcRenderer.on(IPC.snapshotChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC.snapshotChanged, handler);
    };
  }
};

contextBridge.exposeInMainWorld("dispomo", api);
