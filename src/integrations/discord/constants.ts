const PLACEHOLDER_DISCORD_APPLICATION_ID = "000000000000000000";

/**
 * TODO: Discord Developer PortalでDisPomo配布用Applicationを発行したら、
 * プレースホルダーを実際のApplication IDに置き換える。
 * 開発時や自前ビルドの実行時はDISPOMO_DISCORD_APP_IDで上書きできる。
 */
export const DEFAULT_DISCORD_APPLICATION_ID =
  process.env.DISPOMO_DISCORD_APP_ID?.trim() ||
  PLACEHOLDER_DISCORD_APPLICATION_ID;

/**
 * プレースホルダーや明らかに不正な値ではDiscordへ接続しない。
 * Discord Application IDは17〜20桁の数字で表されるスノーフレーク。
 */
export function isDiscordApplicationId(value: string): boolean {
  return (
    value !== PLACEHOLDER_DISCORD_APPLICATION_ID &&
    /^\d{17,20}$/.test(value)
  );
}

export function resolveDiscordApplicationId(
  configuredClientId: string,
  defaultApplicationId = DEFAULT_DISCORD_APPLICATION_ID,
): string {
  const applicationId =
    configuredClientId.trim() || defaultApplicationId.trim();
  return isDiscordApplicationId(applicationId) ? applicationId : "";
}
