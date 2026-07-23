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
  private connecting: Promise<void> | undefined;
  private retryAfter = 0;

  async update(input: PresenceInput): Promise<void> {
    if (!input.enabled || input.clientId.length === 0) {
      this.disconnect();
      return;
    }
    if (
      input.clientId === this.clientId &&
      !this.client &&
      Date.now() < this.retryAfter
    ) {
      return;
    }

    try {
      await this.connect(input.clientId);
      if (!this.client) return;

      const activity = this.activity(input);
      const serialized = JSON.stringify(activity);
      if (serialized === this.lastPayload) return;

      await this.client.setActivity(activity);
      this.lastPayload = serialized;
    } catch (error) {
      // Discord is optional. A closed client must never interrupt local work.
      console.warn("Discord Rich Presence is unavailable", error);
      this.disposeClient();
      this.retryAfter = Date.now() + 15_000;
    }
  }

  disconnect(): void {
    this.disposeClient();
    this.clientId = "";
    this.lastPayload = "";
    this.retryAfter = 0;
  }

  private async connect(clientId: string): Promise<void> {
    if (this.client && this.clientId === clientId) return;
    if (this.connecting && this.clientId === clientId) {
      await this.connecting;
      return;
    }

    this.disposeClient();
    this.clientId = clientId;
    this.retryAfter = 0;
    const client = new DiscordRPC.Client({ transport: "ipc" });
    this.client = client;
    client.on("disconnected", () => {
      if (this.client === client) {
        this.disposeClient();
        this.retryAfter = Date.now() + 15_000;
      }
    });
    this.connecting = client
      .login({ clientId })
      .then(() => undefined)
      .finally(() => {
        this.connecting = undefined;
      });
    await this.connecting;
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
      largeImageKey: input.phase === "focus" ? "focus" : "break",
      largeImageText: input.phase === "focus" ? "集中時間" : "休憩時間",
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

  private disposeClient(): void {
    const current = this.client;
    this.client = undefined;
    if (current) {
      try {
        current.destroy();
      } catch {
        // It may already have been closed by Discord.
      }
    }
  }
}
