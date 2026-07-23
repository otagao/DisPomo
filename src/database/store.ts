import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultSettings,
  type PomodoroSession,
  type Project,
  type Settings,
  type Subtask,
  type Task
} from "../domain";
import type { PomodoroSessionDraft, PomodoroState } from "../pomodoro";

type SqlRow = Record<string, unknown>;

export interface StoredSnapshot {
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  history: PomodoroSession[];
  settings: Settings;
  pomodoroState: PomodoroState | null;
}

export class AppStore {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  close(): void {
    this.database.close();
  }

  snapshot(): StoredSnapshot {
    return {
      projects: this.rows(
        "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY sort_order, created_at"
      ).map(projectFromRow),
      tasks: this.rows(
        "SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY sort_order, created_at"
      ).map(taskFromRow),
      subtasks: this.rows(
        "SELECT * FROM subtasks WHERE deleted_at IS NULL ORDER BY sort_order, created_at"
      ).map(subtaskFromRow),
      history: this.rows(
        "SELECT * FROM pomodoro_sessions WHERE deleted_at IS NULL ORDER BY ended_at DESC LIMIT 100"
      ).map(sessionFromRow),
      settings: this.getSettings(),
      pomodoroState: this.getPomodoroState()
    };
  }

  createProject(input: { name: string; color?: string }): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: null,
      color: input.color ?? null,
      sortOrder: this.nextSortOrder("projects"),
      archived: false,
      ...metadata(now)
    };
    this.database
      .prepare(
        `INSERT INTO projects (
          id, name, description, color, sort_order, archived,
          created_at, updated_at, deleted_at, schema_version,
          owner_id, device_id, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        project.id,
        project.name,
        project.description,
        project.color,
        project.sortOrder,
        0,
        project.createdAt,
        project.updatedAt,
        null,
        project.schemaVersion,
        null,
        null,
        project.syncVersion
      );
    return project;
  }

  createTask(input: {
    projectId: string;
    title: string;
    estimatedPomodoros: number;
  }): Task {
    this.requireActive("projects", input.projectId);
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      projectId: input.projectId,
      title: input.title,
      description: null,
      status: "todo",
      completedAt: null,
      estimatedPomodoros: input.estimatedPomodoros,
      sortOrder: this.nextSortOrder("tasks", "project_id", input.projectId),
      ...metadata(now)
    };
    this.database
      .prepare(
        `INSERT INTO tasks (
          id, project_id, title, description, status, completed_at,
          estimated_pomodoros, sort_order, created_at, updated_at, deleted_at,
          schema_version, owner_id, device_id, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.status,
        null,
        task.estimatedPomodoros,
        task.sortOrder,
        task.createdAt,
        task.updatedAt,
        null,
        task.schemaVersion,
        null,
        null,
        task.syncVersion
      );
    return task;
  }

  createSubtask(input: { taskId: string; title: string }): Subtask {
    this.requireActive("tasks", input.taskId);
    const now = new Date().toISOString();
    const subtask: Subtask = {
      id: randomUUID(),
      taskId: input.taskId,
      title: input.title,
      isCompleted: false,
      completedAt: null,
      sortOrder: this.nextSortOrder("subtasks", "task_id", input.taskId),
      ...metadata(now)
    };
    this.database
      .prepare(
        `INSERT INTO subtasks (
          id, task_id, title, is_completed, completed_at, sort_order,
          created_at, updated_at, deleted_at, schema_version,
          owner_id, device_id, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        subtask.id,
        subtask.taskId,
        subtask.title,
        0,
        null,
        subtask.sortOrder,
        subtask.createdAt,
        subtask.updatedAt,
        null,
        subtask.schemaVersion,
        null,
        null,
        subtask.syncVersion
      );
    return subtask;
  }

  toggleTask(targetId: string): void {
    const row = this.requireActive("tasks", targetId);
    const completed = row.status === "completed";
    const now = new Date().toISOString();
    this.database
      .prepare(
        "UPDATE tasks SET status = ?, completed_at = ?, updated_at = ?, sync_version = sync_version + 1 WHERE id = ?"
      )
      .run(completed ? "todo" : "completed", completed ? null : now, now, targetId);
  }

  toggleSubtask(targetId: string): void {
    const row = this.requireActive("subtasks", targetId);
    const completed = toBoolean(row.is_completed);
    const now = new Date().toISOString();
    this.database
      .prepare(
        "UPDATE subtasks SET is_completed = ?, completed_at = ?, updated_at = ?, sync_version = sync_version + 1 WHERE id = ?"
      )
      .run(completed ? 0 : 1, completed ? null : now, now, targetId);
  }

  softDelete(kind: "project" | "task" | "subtask", targetId: string): void {
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (kind === "project") {
        this.requireActive("projects", targetId);
        this.database
          .prepare(
            `UPDATE subtasks SET deleted_at = ?, updated_at = ?
             WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
             AND deleted_at IS NULL`
          )
          .run(now, now, targetId);
        this.database
          .prepare(
            "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL"
          )
          .run(now, now, targetId);
        this.database
          .prepare(
            "UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?"
          )
          .run(now, now, targetId);
      } else if (kind === "task") {
        this.requireActive("tasks", targetId);
        this.database
          .prepare(
            "UPDATE subtasks SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND deleted_at IS NULL"
          )
          .run(now, now, targetId);
        this.database
          .prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?")
          .run(now, now, targetId);
      } else {
        this.requireActive("subtasks", targetId);
        this.database
          .prepare(
            "UPDATE subtasks SET deleted_at = ?, updated_at = ? WHERE id = ?"
          )
          .run(now, now, targetId);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getSettings(): Settings {
    const row = this.database
      .prepare("SELECT value FROM app_state WHERE key = 'settings'")
      .get() as SqlRow | undefined;
    if (row && typeof row.value === "string") {
      return JSON.parse(row.value) as Settings;
    }
    const now = new Date().toISOString();
    const settings = createDefaultSettings(randomUUID(), now);
    this.setJson("settings", settings);
    return settings;
  }

  saveSettings(patch: Partial<Settings>): Settings {
    const current = this.getSettings();
    const next: Settings = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      schemaVersion: current.schemaVersion,
      syncVersion: current.syncVersion + 1
    };
    this.setJson("settings", next);
    return next;
  }

  getPomodoroState(): PomodoroState | null {
    const row = this.database
      .prepare("SELECT value FROM app_state WHERE key = 'pomodoro'")
      .get() as SqlRow | undefined;
    return row && typeof row.value === "string"
      ? (JSON.parse(row.value) as PomodoroState)
      : null;
  }

  savePomodoroState(state: PomodoroState): void {
    this.setJson("pomodoro", state);
  }

  addPomodoroSession(
    draft: PomodoroSessionDraft
  ): PomodoroSession {
    const now = new Date().toISOString();
    const session: PomodoroSession = {
      id: randomUUID(),
      taskId: draft.taskId,
      phase:
        draft.phase === "focus"
          ? "focus"
          : draft.phase === "shortBreak"
            ? "short_break"
            : "long_break",
      outcome: draft.outcome === "completed" ? "completed" : "interrupted",
      startedAt: new Date(draft.startedAt).toISOString(),
      endedAt: new Date(draft.endedAt).toISOString(),
      plannedDurationSeconds: Math.round(draft.plannedDurationMs / 1000),
      elapsedSeconds: Math.round(draft.elapsedDurationMs / 1000),
      focusSessionNumber: draft.focusSessionNumber,
      ...metadata(now)
    };
    this.database
      .prepare(
        `INSERT INTO pomodoro_sessions (
          id, task_id, phase, outcome, started_at, ended_at,
          planned_duration_seconds, elapsed_seconds, focus_session_number,
          created_at, updated_at, deleted_at, schema_version,
          owner_id, device_id, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.taskId,
        session.phase,
        session.outcome,
        session.startedAt,
        session.endedAt,
        session.plannedDurationSeconds,
        session.elapsedSeconds,
        session.focusSessionNumber,
        session.createdAt,
        session.updatedAt,
        null,
        session.schemaVersion,
        null,
        null,
        session.syncVersion
      );
    return session;
  }

  private setJson(key: string, value: unknown): void {
    this.database
      .prepare(
        `INSERT INTO app_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, JSON.stringify(value));
  }

  private rows(sql: string): SqlRow[] {
    return this.database.prepare(sql).all() as SqlRow[];
  }

  private requireActive(table: string, targetId: string): SqlRow {
    const allowed = ["projects", "tasks", "subtasks"];
    if (!allowed.includes(table)) throw new Error("Unsupported table");
    const row = this.database
      .prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`)
      .get(targetId) as SqlRow | undefined;
    if (!row) throw new Error(`${table.slice(0, -1)} not found`);
    return row;
  }

  private nextSortOrder(
    table: "projects" | "tasks" | "subtasks",
    column?: "project_id" | "task_id",
    parentId?: string
  ): number {
    const statement =
      column && parentId
        ? this.database.prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table} WHERE ${column} = ?`
          )
        : this.database.prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table}`
          );
    const row = (parentId ? statement.get(parentId) : statement.get()) as SqlRow;
    return Number(row.next);
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, color TEXT,
        sort_order INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
        schema_version INTEGER NOT NULL, owner_id TEXT, device_id TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id),
        title TEXT NOT NULL, description TEXT, status TEXT NOT NULL,
        completed_at TEXT, estimated_pomodoros INTEGER, sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
        schema_version INTEGER NOT NULL, owner_id TEXT, device_id TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
        title TEXT NOT NULL, is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT, sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
        schema_version INTEGER NOT NULL, owner_id TEXT, device_id TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id TEXT PRIMARY KEY, task_id TEXT REFERENCES tasks(id), phase TEXT NOT NULL,
        outcome TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
        planned_duration_seconds INTEGER NOT NULL, elapsed_seconds INTEGER NOT NULL,
        focus_session_number INTEGER, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, deleted_at TEXT, schema_version INTEGER NOT NULL,
        owner_id TEXT, device_id TEXT, sync_version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id, deleted_at);
      CREATE INDEX IF NOT EXISTS subtasks_task_idx ON subtasks(task_id, deleted_at);
      CREATE INDEX IF NOT EXISTS sessions_task_idx
        ON pomodoro_sessions(task_id, ended_at);
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (1, datetime('now'));
    `);
  }
}

function metadata(now: string) {
  return {
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    ownerId: null,
    deviceId: null,
    syncVersion: 0
  } as const;
}

function stringValue(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Invalid database ${key}`);
  return value;
}

function nullableString(row: SqlRow, key: string): string | null {
  const value = row[key];
  return value === null ? null : stringValue(row, key);
}

function numberValue(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Invalid database ${key}`);
  return value;
}

function toBoolean(value: unknown): boolean {
  return value === 1 || value === true;
}

function entityMetadata(row: SqlRow) {
  return {
    id: stringValue(row, "id"),
    createdAt: stringValue(row, "created_at"),
    updatedAt: stringValue(row, "updated_at"),
    deletedAt: nullableString(row, "deleted_at"),
    schemaVersion: numberValue(row, "schema_version"),
    ownerId: nullableString(row, "owner_id"),
    deviceId: nullableString(row, "device_id"),
    syncVersion: numberValue(row, "sync_version")
  };
}

function projectFromRow(row: SqlRow): Project {
  return {
    ...entityMetadata(row),
    name: stringValue(row, "name"),
    description: nullableString(row, "description"),
    color: nullableString(row, "color"),
    sortOrder: numberValue(row, "sort_order"),
    archived: toBoolean(row.archived)
  };
}

function taskFromRow(row: SqlRow): Task {
  const estimated = row.estimated_pomodoros;
  return {
    ...entityMetadata(row),
    projectId: nullableString(row, "project_id"),
    title: stringValue(row, "title"),
    description: nullableString(row, "description"),
    status: stringValue(row, "status") as Task["status"],
    completedAt: nullableString(row, "completed_at"),
    estimatedPomodoros: estimated === null ? null : Number(estimated),
    sortOrder: numberValue(row, "sort_order")
  };
}

function subtaskFromRow(row: SqlRow): Subtask {
  return {
    ...entityMetadata(row),
    taskId: stringValue(row, "task_id"),
    title: stringValue(row, "title"),
    isCompleted: toBoolean(row.is_completed),
    completedAt: nullableString(row, "completed_at"),
    sortOrder: numberValue(row, "sort_order")
  };
}

function sessionFromRow(row: SqlRow): PomodoroSession {
  const focusSessionNumber = row.focus_session_number;
  return {
    ...entityMetadata(row),
    taskId: nullableString(row, "task_id"),
    phase: stringValue(row, "phase") as PomodoroSession["phase"],
    outcome: stringValue(row, "outcome") as PomodoroSession["outcome"],
    startedAt: stringValue(row, "started_at"),
    endedAt: stringValue(row, "ended_at"),
    plannedDurationSeconds: numberValue(row, "planned_duration_seconds"),
    elapsedSeconds: numberValue(row, "elapsed_seconds"),
    focusSessionNumber:
      focusSessionNumber === null ? null : Number(focusSessionNumber)
  };
}
