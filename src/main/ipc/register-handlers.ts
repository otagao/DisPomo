import { ipcMain } from "electron";
import type { AppStore } from "../../database/store";
import type { AppService } from "../app-service";
import { IPC } from "./channels";
import {
  commandInput,
  createProjectInput,
  createSubtaskInput,
  createTaskInput,
  id,
  settingsInput
} from "./validation";

export function registerIpcHandlers(
  store: AppStore,
  service: AppService
): void {
  ipcMain.handle(IPC.getSnapshot, () => service.snapshot());
  ipcMain.handle(IPC.createProject, (_event, value: unknown) =>
    service.mutate(() => {
      store.createProject(createProjectInput(value));
    })
  );
  ipcMain.handle(IPC.createTask, (_event, value: unknown) =>
    service.mutate(() => {
      store.createTask(createTaskInput(value));
    })
  );
  ipcMain.handle(IPC.createSubtask, (_event, value: unknown) =>
    service.mutate(() => {
      store.createSubtask(createSubtaskInput(value));
    })
  );
  ipcMain.handle(IPC.toggleTask, (_event, value: unknown) =>
    service.mutate(() => {
      store.toggleTask(id(value));
    })
  );
  ipcMain.handle(IPC.toggleSubtask, (_event, value: unknown) =>
    service.mutate(() => {
      store.toggleSubtask(id(value));
    })
  );
  ipcMain.handle(IPC.deleteProject, (_event, value: unknown) =>
    service.mutate(() => {
      store.softDelete("project", id(value));
    })
  );
  ipcMain.handle(IPC.deleteTask, (_event, value: unknown) =>
    service.mutate(() => {
      store.softDelete("task", id(value));
    })
  );
  ipcMain.handle(IPC.deleteSubtask, (_event, value: unknown) =>
    service.mutate(() => {
      store.softDelete("subtask", id(value));
    })
  );
  ipcMain.handle(IPC.pomodoroCommand, (_event, value: unknown) =>
    service.command(commandInput(value))
  );
  ipcMain.handle(IPC.saveSettings, (_event, value: unknown) =>
    service.saveSettings(settingsInput(value))
  );
}
