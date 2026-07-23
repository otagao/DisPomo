import {
  createEntityMetadata,
  type IsoDateTime,
  type UUID,
} from "./common";
import type {
  DesktopSettings,
  DiscordSettings,
  PomodoroSettings,
  Settings,
} from "./entities";
import type { UpdateSettingsInput } from "./inputs";

export const DEFAULT_POMODORO_SETTINGS: Readonly<PomodoroSettings> = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

export const DEFAULT_DISCORD_SETTINGS: Readonly<DiscordSettings> = {
  discordEnabled: true,
  discordPrivacy: "task",
  discordClientId: "",
  genericTaskText: "タスクに集中しています",
  showSubtaskProgress: true,
  showPomodoroProgress: true,
};

export const DEFAULT_DESKTOP_SETTINGS: Readonly<DesktopSettings> = {
  minimizeToTray: true,
  closeToTray: true,
  notificationsEnabled: true,
};

export function createDefaultSettings(
  id: UUID,
  now: IsoDateTime,
): Settings {
  return {
    ...createEntityMetadata({ id, createdAt: now }),
    ...DEFAULT_POMODORO_SETTINGS,
    ...DEFAULT_DISCORD_SETTINGS,
    ...DEFAULT_DESKTOP_SETTINGS,
  };
}

/**
 * Applies a settings patch immutably. Persistence code remains responsible for
 * supplying the new `updatedAt` timestamp.
 */
export function applySettingsUpdate(
  current: Settings,
  update: UpdateSettingsInput,
  updatedAt: IsoDateTime,
): Settings {
  return {
    ...current,
    ...update,
    updatedAt,
  };
}
