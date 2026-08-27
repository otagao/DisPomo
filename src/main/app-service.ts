import type { BrowserWindow } from "electron";
import { Notification } from "electron";
import { calculateTaskProgress, type Settings } from "../domain";
import { AppStore } from "../database/store";
import { DiscordPresence } from "../integrations/discord/discord-presence";
import { resolveDiscordApplicationId } from "../integrations/discord/constants";
import {
  createPomodoroState,
  getSnapshot as getPomodoroSnapshot,
  reducePomodoro,
  type PomodoroEvent,
  type PomodoroState
} from "../pomodoro";
import type { PomodoroCommandName } from "./ipc/channels";
import { IPC } from "./ipc/channels";

export interface RendererSnapshot {
  projects: Array<{
    id: string;
    name: string;
    color?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    estimatedPomodoros?: number;
    completedPomodoros: number;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    subtasks: Array<{
      id: string;
      taskId: string;
      title: string;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  pomodoro: {
    phase: "focus" | "shortBreak" | "longBreak";
    status: "idle" | "running" | "paused";
    taskId: string | null;
    durationMs: number;
    remainingMs: number;
    completedFocusSessions: number;
    startedAt: number | null;
    endsAt: number | null;
  };
  history: Array<{
    id: string;
    taskId: string | null;
    taskTitle?: string;
    phase: "focus" | "shortBreak" | "longBreak";
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    outcome: "completed" | "skipped";
  }>;
  settings: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    sessionsUntilLongBreak: number;
    discordEnabled: boolean;
    discordPrivacy: "task" | "project" | "generic";
    discordClientId: string;
  };
  selectedTaskId: string | null;
}

export class AppService {
  private state: PomodoroState;
  private readonly presence = new DiscordPresence();

  constructor(
    private readonly store: AppStore,
    private readonly windows: () => BrowserWindow[]
  ) {
    const persisted = store.getPomodoroState();
    this.state =
      persisted ?? createPomodoroState(this.pomodoroSettings(store.getSettings()));
    if (!persisted) store.savePomodoroState(this.state);
  }

  snapshot(now = Date.now()): RendererSnapshot {
    const data = this.store.snapshot();
    const taskTitles = new Map(data.tasks.map((task) => [task.id, task.title]));
    const completedFocusCounts = new Map<string, number>();
    for (const session of data.history) {
      if (
        session.taskId &&
        session.phase === "focus" &&
        session.outcome === "completed"
      ) {
        completedFocusCounts.set(
          session.taskId,
          (completedFocusCounts.get(session.taskId) ?? 0) + 1
        );
      }
    }
    const pomodoro = getPomodoroSnapshot(this.state, now);
    const durationMinutes =
      pomodoro.phase === "focus"
        ? data.settings.focusMinutes
        : pomodoro.phase === "shortBreak"
          ? data.settings.shortBreakMinutes
          : data.settings.longBreakMinutes;

    return {
      projects: data.projects.map((project) => {
        const value = {
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        };
        return project.color === null
          ? value
          : { ...value, color: project.color };
      }),
      tasks: data.tasks
        .filter((task) => task.projectId !== null)
        .map((task) => {
          const subtasks = data.subtasks
            .filter((subtask) => subtask.taskId === task.id)
            .map((subtask) => ({
              id: subtask.id,
              taskId: subtask.taskId,
              title: subtask.title,
              completedAt: subtask.completedAt,
              createdAt: subtask.createdAt,
              updatedAt: subtask.updatedAt
            }));
          const value = {
            id: task.id,
            projectId: task.projectId as string,
            title: task.title,
            completedPomodoros: completedFocusCounts.get(task.id) ?? 0,
            completedAt: task.completedAt,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            subtasks
          };
          return task.estimatedPomodoros === null
            ? value
            : { ...value, estimatedPomodoros: task.estimatedPomodoros };
        }),
      pomodoro: {
        ...pomodoro,
        durationMs: durationMinutes * 60_000
      },
      history: data.history.map((session) => {
        const value = {
          id: session.id,
          taskId: session.taskId,
          phase:
            session.phase === "short_break"
              ? ("shortBreak" as const)
              : session.phase === "long_break"
                ? ("longBreak" as const)
                : ("focus" as const),
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds: session.elapsedSeconds,
          outcome:
            session.outcome === "completed"
              ? ("completed" as const)
              : ("skipped" as const)
        };
        const taskTitle =
          session.taskId === null ? undefined : taskTitles.get(session.taskId);
        return taskTitle === undefined ? value : { ...value, taskTitle };
      }),
      settings: settingsDto(data.settings),
      selectedTaskId: pomodoro.taskId
    };
  }

  async mutate(action: () => void): Promise<RendererSnapshot> {
    action();
    return this.publish();
  }

  async command(
    command: { type: PomodoroCommandName; taskId?: string },
    now = Date.now()
  ): Promise<RendererSnapshot> {
    const settings = this.store.getSettings();
    const transition = reducePomodoro(
      this.state,
      command.type === "reset"
        ? { type: "reset" }
        : command.type === "start"
          ? command.taskId === undefined
            ? { type: "start", at: now }
            : { type: "start", at: now, taskId: command.taskId }
          : { type: command.type, at: now },
      this.pomodoroSettings(settings)
    );
    this.applyTransition(transition.state, transition.events, settings);
    return this.publish();
  }

  async saveSettings(patch: Partial<Settings>): Promise<RendererSnapshot> {
    const settings = this.store.saveSettings(patch);
    if (this.state.status === "idle") {
      this.state = reducePomodoro(
        this.state,
        { type: "reset" },
        this.pomodoroSettings(settings)
      ).state;
      this.store.savePomodoroState(this.state);
    }
    return this.publish();
  }

  async tick(now = Date.now()): Promise<void> {
    const settings = this.store.getSettings();
    const transition = reducePomodoro(
      this.state,
      { type: "tick", at: now },
      this.pomodoroSettings(settings)
    );
    if (transition.state !== this.state) {
      this.applyTransition(transition.state, transition.events, settings);
    }
    await this.publish(now);
  }

  async publish(now = Date.now()): Promise<RendererSnapshot> {
    const snapshot = this.snapshot(now);
    for (const window of this.windows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.snapshotChanged, snapshot);
      }
    }
    await this.updatePresence(snapshot);
    return snapshot;
  }

  close(): void {
    this.presence.disconnect();
    this.store.close();
  }

  private applyTransition(
    state: PomodoroState,
    events: readonly PomodoroEvent[],
    settings: Settings
  ): void {
    this.state = state;
    this.store.savePomodoroState(state);
    for (const event of events) {
      if (event.type !== "sessionFinished") continue;
      this.store.addPomodoroSession(event.session);
      if (settings.notificationsEnabled && Notification.isSupported()) {
        new Notification({
          title: "DisPomo",
          body:
            event.session.phase === "focus"
              ? "集中セッションが終了しました。休憩しましょう。"
              : "休憩が終了しました。次のタスクを始めましょう。"
        }).show();
      }
    }
  }

  private async updatePresence(snapshot: RendererSnapshot): Promise<void> {
    const applicationId = resolveDiscordApplicationId({
      settingsApplicationId: snapshot.settings.discordClientId,
      environmentApplicationId: process.env.DISPOMO_DISCORD_APP_ID
    });
    if (process.env.DISPOMO_DEBUG_DISCORD === "1") {
      const source =
        applicationId.source === "settings"
          ? "設定画面"
          : applicationId.source === "environment"
            ? "環境変数"
            : "既定値";
      console.debug("[Discord] Application ID を解決しました", {
        applicationId: applicationId.candidate || "(未設定)",
        source,
        valid: applicationId.valid
      });
    }
    const task =
      snapshot.pomodoro.taskId === null
        ? undefined
        : snapshot.tasks.find(
            (candidate) => candidate.id === snapshot.pomodoro.taskId
          );
    const project =
      task === undefined
        ? undefined
        : snapshot.projects.find((candidate) => candidate.id === task.projectId);
    const progress =
      task === undefined
        ? {
            completedSubtasks: 0,
            totalSubtasks: 0,
            ratio: 0,
            percent: 0,
            isComplete: false
          }
        : calculateTaskProgress(
            task.subtasks.map((subtask) => ({
              isCompleted: subtask.completedAt !== null,
              deletedAt: null
            }))
          );
    await this.presence.update({
      enabled: snapshot.settings.discordEnabled,
      clientId: applicationId.applicationId,
      privacy: snapshot.settings.discordPrivacy,
      ...(task ? { taskTitle: task.title } : {}),
      ...(project ? { projectName: project.name } : {}),
      completedSubtasks: progress.completedSubtasks,
      totalSubtasks: progress.totalSubtasks,
      phase: snapshot.pomodoro.phase,
      status: snapshot.pomodoro.status,
      completedFocusSessions: snapshot.pomodoro.completedFocusSessions,
      ...(task?.estimatedPomodoros === undefined
        ? {}
        : { estimatedFocusSessions: task.estimatedPomodoros }),
      ...(snapshot.pomodoro.startedAt === null
        ? {}
        : { startedAt: snapshot.pomodoro.startedAt }),
      ...(snapshot.pomodoro.endsAt === null
        ? {}
        : { endsAt: snapshot.pomodoro.endsAt })
    });
  }

  private pomodoroSettings(settings: Settings) {
    return {
      focusMinutes: settings.focusMinutes,
      shortBreakMinutes: settings.shortBreakMinutes,
      longBreakMinutes: settings.longBreakMinutes,
      sessionsUntilLongBreak: settings.sessionsUntilLongBreak
    };
  }
}

function settingsDto(settings: Settings): RendererSnapshot["settings"] {
  return {
    focusMinutes: settings.focusMinutes,
    shortBreakMinutes: settings.shortBreakMinutes,
    longBreakMinutes: settings.longBreakMinutes,
    sessionsUntilLongBreak: settings.sessionsUntilLongBreak,
    discordEnabled: settings.discordEnabled,
    discordPrivacy: settings.discordPrivacy,
    discordClientId: settings.discordClientId
  };
}
