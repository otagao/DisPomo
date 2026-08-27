import DiscordRPC from "discord-rpc";

export type DiscordPrivacy = "task" | "project" | "generic";

export interface PresenceInput {
  enabled: boolean;
  clientId: string;
  privacy: DiscordPrivacy;
  taskTitle?: string;
  projectName?: string;
  completedSubtasks: number;
  totalSubtasks: number;
  phase: "focus" | "shortBreak" | "longBreak";
  status: "idle" | "running" | "paused";
  completedFocusSessions: number;
  estimatedFocusSessions?: number;
  startedAt?: number;
  endsAt?: number;
}

export class DiscordPresence {
  private client: DiscordRPC.Client | undefined;
  private clientId = "";
  private lastPayload = "";
  private connecting:
    | {
        clientId: string;
        client: DiscordRPC.Client;
        promise: Promise<DiscordRPC.Client>;
      }
    | undefined;
  private retryAfter = 0;

  async update(input: PresenceInput): Promise<void> {
    if (!input.enabled || input.clientId.length === 0) {
      discordDebug(
        input.enabled
          ? "Application ID が無効または未設定のため送信をスキップします"
          : "Discord 連携が無効なため送信をスキップします"
      );
      this.disconnect();
      return;
    }
    if (
      input.clientId === this.clientId &&
      !this.client &&
      Date.now() < this.retryAfter
    ) {
      discordDebug("再接続待機中のため送信をスキップします", {
        applicationId: input.clientId,
        retryAfter: new Date(this.retryAfter).toISOString()
      });
      return;
    }

    let client: DiscordRPC.Client | undefined;
    try {
      client = await this.connect(input.clientId);
      if (this.client !== client) {
        discordDebug("接続先が更新されたため古い送信をスキップします");
        return;
      }

      const activity = this.activity(input);
      const serialized = JSON.stringify(activity);
      if (serialized === this.lastPayload) {
        discordDebug("前回と同一のペイロードのため送信をスキップします");
        return;
      }

      discordDebug("setActivity を送信します", activity);
      await client.setActivity(activity);
      this.lastPayload = serialized;
      discordDebug("setActivity の送信に成功しました");
    } catch (error) {
      // Discord は任意機能なので、接続失敗によってローカル作業を中断しない。
      console.warn(
        `[Discord] Rich Presence を利用できません: ${formatDiscordError(error)}`
      );
      if (client) this.disposeClient(client);
      this.retryAfter = Date.now() + 15_000;
    }
  }

  disconnect(): void {
    this.disposeClient();
    this.clientId = "";
    this.lastPayload = "";
    this.retryAfter = 0;
  }

  private async connect(clientId: string): Promise<DiscordRPC.Client> {
    if (this.client && this.clientId === clientId && !this.connecting) {
      return this.client;
    }
    if (this.connecting?.clientId === clientId) {
      return this.connecting.promise;
    }

    this.disposeClient();
    this.clientId = clientId;
    this.retryAfter = 0;
    const client = new DiscordRPC.Client({ transport: "ipc" });
    this.client = client;
    discordDebug("Discord への接続を開始します", { applicationId: clientId });
    client.on("disconnected", () => {
      if (this.client === client) {
        discordDebug("Discord から切断されました");
        this.disposeClient();
        this.retryAfter = Date.now() + 15_000;
      }
    });
    const connection = {
      clientId,
      client,
      promise: Promise.resolve(client)
    };
    connection.promise = client
      .login({ clientId })
      .then(() => {
        discordDebug("Discord への接続に成功しました", {
          applicationId: clientId
        });
        return client;
      })
      .catch((error: unknown) => {
        if (this.client === client) this.disposeClient(client);
        throw error;
      })
      .finally(() => {
        if (this.connecting === connection) this.connecting = undefined;
      });
    this.connecting = connection;
    return connection.promise;
  }

  private activity(input: PresenceInput): DiscordRPC.Presence {
    const details =
      input.privacy === "task"
        ? input.taskTitle ?? "タスクに集中しています"
        : input.privacy === "project"
          ? input.projectName ?? "プロジェクトに集中しています"
          : "タスクに集中しています";
    const progress =
      input.totalSubtasks > 0
        ? `サブタスク ${input.completedSubtasks}/${input.totalSubtasks}`
        : "タスクを進行中";
    const phase =
      input.phase === "focus"
        ? "ポモドーロ"
        : input.phase === "shortBreak"
          ? "短い休憩"
          : "長い休憩";
    const sessionProgress =
      input.estimatedFocusSessions === undefined
        ? `${input.completedFocusSessions + 1}`
        : `${Math.min(input.completedFocusSessions + 1, input.estimatedFocusSessions)}/${input.estimatedFocusSessions}`;

    const activity: DiscordRPC.Presence = {
      details: `${details} — ${progress}`,
      state:
        input.status === "paused"
          ? `${phase} — 一時停止中`
          : `${phase} ${sessionProgress}`,
      instance: false
    };
    if (input.status === "running" && input.endsAt !== undefined) {
      activity.endTimestamp = new Date(input.endsAt);
    }
    if (input.status === "running" && input.startedAt !== undefined) {
      activity.startTimestamp = new Date(input.startedAt);
    }
    return activity;
  }

  private disposeClient(target?: DiscordRPC.Client): void {
    const current = this.client;
    if (target && current !== target) return;
    this.client = undefined;
    this.connecting = undefined;
    this.lastPayload = "";
    if (current) {
      void current.destroy().catch(() => {
        // Discord 側ですでに切断済みの場合がある。
      });
    }
  }
}

function discordDebug(message: string, detail?: unknown): void {
  if (process.env.DISPOMO_DEBUG_DISCORD !== "1") return;
  if (detail === undefined) {
    console.debug(`[Discord] ${message}`);
  } else {
    console.debug(`[Discord] ${message}`, detail);
  }
}

function formatDiscordError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as Error & { code?: unknown }).code;
  return code === undefined
    ? error.message
    : `${error.message} (code: ${String(code)})`;
}
