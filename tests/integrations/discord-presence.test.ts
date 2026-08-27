import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDiscordApplicationId,
  resolveDiscordApplicationId
} from "../../src/integrations/discord/constants";
import { DiscordPresence } from "../../src/integrations/discord/discord-presence";

const discordRpc = vi.hoisted(() => ({
  clients: [] as Array<{
    listeners: Map<string, () => void>;
    login: ReturnType<typeof vi.fn>;
    setActivity: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock("discord-rpc", () => ({
  default: {
    Client: class {
      listeners = new Map<string, () => void>();
      login = vi.fn().mockResolvedValue(undefined);
      setActivity = vi.fn().mockResolvedValue(undefined);
      destroy = vi.fn().mockResolvedValue(undefined);

      constructor() {
        discordRpc.clients.push(this);
      }

      on(event: string, listener: () => void) {
        this.listeners.set(event, listener);
        return this;
      }
    }
  }
}));

describe("Discord Application ID", () => {
  const realApplicationId = "1530312919642804335";

  it("17〜20桁の数字だけを有効と判定する", () => {
    expect(isDiscordApplicationId(realApplicationId)).toBe(true);
    expect(isDiscordApplicationId("")).toBe(false);
    expect(isDiscordApplicationId("0000000000000000")).toBe(false);
    expect(isDiscordApplicationId("1530312919642804335x")).toBe(false);
  });

  it("既定IDに実IDを設定したら有効になる", () => {
    expect(
      resolveDiscordApplicationId({
        defaultApplicationId: realApplicationId
      })
    ).toEqual({
      applicationId: realApplicationId,
      candidate: realApplicationId,
      source: "default",
      valid: true
    });
  });

  it("設定画面、環境変数、既定値の順に優先する", () => {
    expect(
      resolveDiscordApplicationId({
        settingsApplicationId: " 12345678901234567 ",
        environmentApplicationId: "123456789012345678",
        defaultApplicationId: realApplicationId
      }).source
    ).toBe("settings");
    expect(
      resolveDiscordApplicationId({
        environmentApplicationId: "123456789012345678",
        defaultApplicationId: realApplicationId
      }).source
    ).toBe("environment");
  });

  it("未設定または不正形式なら空文字へ解決する", () => {
    expect(resolveDiscordApplicationId({}).applicationId).toBe("");
    expect(
      resolveDiscordApplicationId({ settingsApplicationId: "invalid" })
    ).toMatchObject({ applicationId: "", valid: false });
  });
});

describe("Discord Presence", () => {
  const input = {
    enabled: true,
    clientId: "1530312919642804335",
    privacy: "generic" as const,
    completedSubtasks: 0,
    totalSubtasks: 0,
    phase: "focus" as const,
    status: "idle" as const,
    completedFocusSessions: 0
  };

  beforeEach(() => {
    discordRpc.clients.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("接続完了後にアセットなしの Presence を送信する", async () => {
    const presence = new DiscordPresence();

    await presence.update(input);

    const client = discordRpc.clients[0];
    expect(client?.login).toHaveBeenCalledWith({ clientId: input.clientId });
    expect(client?.setActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        details: "タスクに集中しています — タスクを進行中",
        state: "ポモドーロ 1",
        instance: false
      })
    );
    expect(client?.setActivity.mock.calls[0]?.[0]).not.toHaveProperty(
      "largeImageKey"
    );
  });

  it("切断後は同じペイロードでも再接続して再送する", async () => {
    const presence = new DiscordPresence();
    await presence.update(input);
    discordRpc.clients[0]?.listeners.get("disconnected")?.();
    vi.advanceTimersByTime(15_000);

    await presence.update(input);

    expect(discordRpc.clients).toHaveLength(2);
    expect(discordRpc.clients[1]?.setActivity).toHaveBeenCalledOnce();
  });
});
