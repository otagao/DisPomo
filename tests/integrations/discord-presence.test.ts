import { describe, expect, it } from "vitest";

import {
  isDiscordApplicationId,
  resolveDiscordApplicationId
} from "../../src/integrations/discord/constants";
import {
  createDiscordActivity,
  type PresenceInput
} from "../../src/integrations/discord/discord-presence";

const BASE_INPUT: PresenceInput = {
  enabled: true,
  clientId: "123456789012345678",
  privacy: "task",
  taskTitle: "レポート作成",
  projectName: "仕事",
  completedSubtasks: 3,
  totalSubtasks: 5,
  phase: "focus",
  status: "running",
  completedFocusSessions: 1,
  estimatedFocusSessions: 4,
  startedAt: 1_000,
  endsAt: 1_501_000
};

describe("Discord Rich Presence", () => {
  it("プレースホルダーや不正なApplication IDを接続対象にしない", () => {
    expect(resolveDiscordApplicationId("", "000000000000000000")).toBe("");
    expect(resolveDiscordApplicationId("000000000000000000")).toBe("");
    expect(resolveDiscordApplicationId("not-an-application-id")).toBe("");
    expect(isDiscordApplicationId("000000000000000000")).toBe(false);
  });

  it("実Application IDを設定した場合は接続対象にする", () => {
    expect(
      resolveDiscordApplicationId(
        "  123456789012345678  ",
        "234567890123456789"
      )
    ).toBe("123456789012345678");
    expect(resolveDiscordApplicationId("", "234567890123456789")).toBe(
      "234567890123456789"
    );
    expect(isDiscordApplicationId("123456789012345678")).toBe(true);
  });

  it("実行中の集中セッション用Presenceペイロードを生成する", () => {
    expect(createDiscordActivity(BASE_INPUT)).toEqual({
      details: "レポート作成 — サブタスク 3/5",
      state: "ポモドーロ 2/4",
      largeImageKey: "focus",
      largeImageText: "集中時間",
      instance: false,
      startTimestamp: new Date(1_000),
      endTimestamp: new Date(1_501_000)
    });
  });

  it("一時停止中はタイムスタンプを送らずプライバシー設定を反映する", () => {
    expect(
      createDiscordActivity({
        ...BASE_INPUT,
        privacy: "generic",
        phase: "shortBreak",
        status: "paused"
      })
    ).toEqual({
      details: "タスクに集中しています — サブタスク 3/5",
      state: "短い休憩 — 一時停止中",
      largeImageKey: "break",
      largeImageText: "休憩時間",
      instance: false
    });
  });
});
