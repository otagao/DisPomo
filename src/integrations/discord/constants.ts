/**
 * 配布版で共通利用する Discord Application ID。
 * 共通 ID を使う場合は、空文字を Developer Portal で発行した実 ID に置き換える。
 * 空文字のままなら未設定として扱う。
 */
export const DEFAULT_DISCORD_APPLICATION_ID = "1530312919642804335";

export type DiscordApplicationIdSource =
  | "settings"
  | "environment"
  | "default";

export interface DiscordApplicationIdResolution {
  applicationId: string;
  candidate: string;
  source: DiscordApplicationIdSource;
  valid: boolean;
}

export function isDiscordApplicationId(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

export function resolveDiscordApplicationId(options: {
  settingsApplicationId?: string | undefined;
  environmentApplicationId?: string | undefined;
  defaultApplicationId?: string | undefined;
}): DiscordApplicationIdResolution {
  const settingsApplicationId = options.settingsApplicationId?.trim() ?? "";
  const environmentApplicationId =
    options.environmentApplicationId?.trim() ?? "";
  const defaultApplicationId = (
    options.defaultApplicationId ?? DEFAULT_DISCORD_APPLICATION_ID
  ).trim();

  const selected = settingsApplicationId
    ? { candidate: settingsApplicationId, source: "settings" as const }
    : environmentApplicationId
      ? { candidate: environmentApplicationId, source: "environment" as const }
      : { candidate: defaultApplicationId, source: "default" as const };
  const valid = isDiscordApplicationId(selected.candidate);

  return {
    applicationId: valid ? selected.candidate : "",
    candidate: selected.candidate,
    source: selected.source,
    valid
  };
}
