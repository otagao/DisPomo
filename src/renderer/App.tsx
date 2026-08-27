import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getDisplayedSeconds } from "./timer-display";

const DEFAULT_SETTINGS: AppSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  discordEnabled: true,
  discordPrivacy: "task",
  discordClientId: "",
};

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: "集中",
  shortBreak: "短い休憩",
  longBreak: "長い休憩",
};

const COLORS = ["#ff6b5f", "#ffb657", "#6dd6a7", "#66a6ff", "#ae8bff"];

type IconName =
  | "archive"
  | "check"
  | "chevron"
  | "clock"
  | "discord"
  | "folder"
  | "gear"
  | "history"
  | "pause"
  | "play"
  | "plus"
  | "reset"
  | "skip"
  | "target"
  | "trash";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    archive: <path d="M4 7h16v13H4V7Zm-1-4h18v4H3V3Zm6 8h6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    discord: (
      <path d="M8.7 8.3a8 8 0 0 1 6.6 0m-7.7 7.3c3.4 1.6 5.4 1.6 8.8 0M9 14h.01M15 14h.01M7.1 5.8C4.7 9.3 4 12.5 4.2 16c1.5 1.1 2.9 1.7 4.3 2l1-1.5m7.4-10.7c2.4 3.5 3.1 6.7 2.9 10.2a13 13 0 0 1-4.3 2l-1-1.5" />
    ),
    folder: <path d="M3 6h7l2 2h9v11H3V6Z" />,
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l4 2" />,
    pause: <path d="M8 5v14m8-14v14" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    reset: <path d="M4 8V3m0 5h5M5.8 17.7A9 9 0 1 0 4 8" />,
    skip: <path d="m5 5 10 7L5 19V5Zm12 0v14" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
    trash: <path d="M5 7h14m-9-3h4l1 3H9l1-3Zm-3 3 1 13h8l1-13M10 11v5m4-5v5" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}分`;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function progressOf(task: Task) {
  if (!task.subtasks.length) return task.completedAt ? 1 : 0;
  return task.subtasks.filter((item) => item.completedAt).length / task.subtasks.length;
}

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"tasks" | "history" | "settings">("tasks");
  const [projectName, setProjectName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [subtaskName, setSubtaskName] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const hydrate = useCallback((next: AppSnapshot) => {
    // A newly-started timer carries a fresh endsAt. Synchronize the renderer
    // clock in the same React update so its first frame cannot use the clock
    // value captured when the app was initially opened.
    setNow(Date.now());
    setSnapshot(next);
    // 設定画面で編集中の値は、タイマーなどのスナップショット更新で上書きしない。
    if (activePanel !== "settings") {
      setSettingsDraft(next.settings);
    }
    setSelectedProjectId((current) => {
      if (current && next.projects.some((project) => project.id === current)) return current;
      const taskProject = next.tasks.find((task) => task.id === next.selectedTaskId)?.projectId;
      return taskProject ?? next.projects[0]?.id ?? null;
    });
    setSelectedTaskId((current) => {
      if (current && next.tasks.some((task) => task.id === current)) return current;
      if (next.selectedTaskId && next.tasks.some((task) => task.id === next.selectedTaskId)) {
        return next.selectedTaskId;
      }
      return next.tasks.find((task) => !task.completedAt)?.id ?? next.tasks[0]?.id ?? null;
    });
  }, [activePanel]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | void;

    window.dispomo
      .getSnapshot()
      .then((next) => {
        if (mounted) hydrate(next);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : "データを読み込めませんでした");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    unsubscribe = window.dispomo.onSnapshot((next) => {
      if (mounted) hydrate(next);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [hydrate]);

  useEffect(() => {
    if (snapshot?.pomodoro.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot?.pomodoro.status]);

  const run = useCallback(
    async (key: string, operation: () => Promise<AppSnapshot | void>) => {
      setPendingAction(key);
      setError(null);
      try {
        const result = await operation();
        if (result) hydrate(result);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "操作を完了できませんでした");
      } finally {
        setPendingAction(null);
      }
    },
    [hydrate],
  );

  const projects = snapshot?.projects ?? [];
  const allTasks = snapshot?.tasks ?? [];
  const projectTasks = useMemo(
    () => allTasks.filter((task) => task.projectId === selectedProjectId),
    [allTasks, selectedProjectId],
  );
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedTask = allTasks.find((task) => task.id === selectedTaskId) ?? null;
  const timerTask = allTasks.find((task) => task.id === snapshot?.pomodoro.taskId) ?? selectedTask;

  const displayedSeconds = useMemo(() => {
    const timer = snapshot?.pomodoro;
    if (!timer) return 0;
    return getDisplayedSeconds(timer, now);
  }, [now, snapshot?.pomodoro]);

  const addProject = (event: FormEvent) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const color = COLORS[projects.length % COLORS.length] ?? "#ff6b5f";
    void run("create-project", () => window.dispomo.createProject({ name, color })).then(() => {
      setProjectName("");
      setShowProjectForm(false);
    });
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    const title = taskName.trim();
    if (!title || !selectedProjectId) return;
    void run("create-task", () =>
      window.dispomo.createTask({ projectId: selectedProjectId, title }),
    ).then(() => setTaskName(""));
  };

  const addSubtask = (event: FormEvent) => {
    event.preventDefault();
    const title = subtaskName.trim();
    if (!title || !selectedTaskId) return;
    void run("create-subtask", () =>
      window.dispomo.createSubtask({ taskId: selectedTaskId, title }),
    ).then(() => setSubtaskName(""));
  };

  const command = (type: PomodoroCommandType) => {
    void run(`pomodoro-${type}`, () =>
      window.dispomo.pomodoroCommand({
        type,
        ...(type === "start" && selectedTaskId ? { taskId: selectedTaskId } : {}),
      }),
    );
  };

  const deleteProject = (project: Project) => {
    if (!window.confirm(`「${project.name}」と含まれるタスクを削除しますか？`)) return;
    void run("delete-project", () => window.dispomo.deleteProject(project.id));
  };

  const deleteTask = (task: Task) => {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
    void run("delete-task", () => window.dispomo.deleteTask(task.id));
  };

  const saveSettings = (event: FormEvent) => {
    event.preventDefault();
    const normalizedSettings = {
      ...settingsDraft,
      discordClientId: settingsDraft.discordClientId.trim(),
    };
    setSettingsDraft(normalizedSettings);
    void run("save-settings", () => window.dispomo.saveSettings(normalizedSettings));
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <p>集中する準備をしています…</p>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="loading-screen">
        <div className="empty-illustration"><Icon name="archive" size={30} /></div>
        <h1>DisPomoを開けませんでした</h1>
        <p>{error ?? "アプリを再起動してください。"}</p>
        <button className="button primary" onClick={() => window.location.reload()} type="button">
          再読み込み
        </button>
      </main>
    );
  }

  const timer = snapshot.pomodoro;
  const timerProgress =
    timer.durationMs > 0 ? 1 - displayedSeconds / (timer.durationMs / 1_000) : 0;
  const completedToday = snapshot.history.filter((entry) => {
    const date = new Date(entry.endedAt);
    const today = new Date();
    return (
      entry.phase === "focus" &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <strong>DisPomo</strong>
            <small>Quiet focus, clear progress.</small>
          </div>
        </header>

        <nav className="main-nav" aria-label="メインメニュー">
          <button
            className={activePanel === "tasks" ? "active" : ""}
            onClick={() => setActivePanel("tasks")}
            type="button"
          >
            <Icon name="target" />
            今日のフォーカス
          </button>
          <button
            className={activePanel === "history" ? "active" : ""}
            onClick={() => setActivePanel("history")}
            type="button"
          >
            <Icon name="history" />
            セッション履歴
          </button>
          <button
            className={activePanel === "settings" ? "active" : ""}
            onClick={() => setActivePanel("settings")}
            type="button"
          >
            <Icon name="gear" />
            設定
          </button>
        </nav>

        <div className="sidebar-heading">
          <span>プロジェクト</span>
          <button
            aria-label="プロジェクトを追加"
            className="icon-button subtle"
            onClick={() => setShowProjectForm((value) => !value)}
            type="button"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        {showProjectForm && (
          <form className="quick-form project-form" onSubmit={addProject}>
            <input
              aria-label="新しいプロジェクト名"
              autoFocus
              maxLength={60}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="プロジェクト名"
              value={projectName}
            />
            <button disabled={!projectName.trim() || pendingAction === "create-project"} type="submit">
              追加
            </button>
          </form>
        )}

        <div className="project-list">
          {projects.map((project, index) => {
            const tasks = allTasks.filter((task) => task.projectId === project.id);
            const done = tasks.filter((task) => task.completedAt).length;
            return (
              <div className="project-row" key={project.id}>
                <button
                  className={project.id === selectedProjectId ? "project-button active" : "project-button"}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    const firstTask = allTasks.find(
                      (task) => task.projectId === project.id && !task.completedAt,
                    );
                    setSelectedTaskId(firstTask?.id ?? tasks[0]?.id ?? null);
                    setActivePanel("tasks");
                  }}
                  type="button"
                >
                  <span
                    className="project-dot"
                    style={{ backgroundColor: project.color ?? COLORS[index % COLORS.length] }}
                  />
                  <span className="project-label">{project.name}</span>
                  <span className="project-count">{done}/{tasks.length}</span>
                </button>
                <button
                  aria-label={`${project.name}を削除`}
                  className="row-action"
                  onClick={() => deleteProject(project)}
                  type="button"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })}
          {!projects.length && (
            <button className="empty-project" onClick={() => setShowProjectForm(true)} type="button">
              <Icon name="plus" size={16} /> 最初のプロジェクトを作成
            </button>
          )}
        </div>

        <div className="sidebar-status">
          <span className={snapshot.settings.discordEnabled ? "status-dot online" : "status-dot"} />
          <Icon name="discord" size={17} />
          <div>
            <strong>Discord</strong>
            <small>{snapshot.settings.discordEnabled ? "Rich Presence 有効" : "連携オフ"}</small>
          </div>
        </div>
      </aside>

      <main className="workspace">
        {activePanel === "tasks" && (
          <>
            <header className="workspace-header">
              <div>
                <span className="eyebrow">ワークスペース</span>
                <h1>{selectedProject?.name ?? "プロジェクトを選択"}</h1>
              </div>
              <div className="daily-stat">
                <span>{completedToday}</span>
                <div><strong>今日のセッション</strong><small>集中したポモドーロ</small></div>
              </div>
            </header>

            {selectedProject ? (
              <section className="task-layout">
                <div className="task-column">
                  <div className="section-heading">
                    <div>
                      <h2>タスク</h2>
                      <span>{projectTasks.filter((task) => !task.completedAt).length}件 未完了</span>
                    </div>
                  </div>

                  <form className="new-task-form" onSubmit={addTask}>
                    <span className="new-task-plus"><Icon name="plus" size={17} /></span>
                    <input
                      aria-label="新しいタスク名"
                      maxLength={120}
                      onChange={(event) => setTaskName(event.target.value)}
                      placeholder="新しいタスクを追加…"
                      value={taskName}
                    />
                    <button disabled={!taskName.trim() || pendingAction === "create-task"} type="submit">
                      追加
                    </button>
                  </form>

                  <div className="task-list">
                    {projectTasks.map((task) => {
                      const progress = progressOf(task);
                      const doneSubtasks = task.subtasks.filter((item) => item.completedAt).length;
                      return (
                        <article
                          className={[
                            "task-card",
                            task.id === selectedTaskId ? "selected" : "",
                            task.completedAt ? "completed" : "",
                          ].join(" ")}
                          key={task.id}
                        >
                          <button
                            aria-label={task.completedAt ? "タスクを未完了に戻す" : "タスクを完了"}
                            className="check-button"
                            onClick={() =>
                              void run(`toggle-task-${task.id}`, () => window.dispomo.toggleTask(task.id))
                            }
                            type="button"
                          >
                            {task.completedAt && <Icon name="check" size={14} />}
                          </button>
                          <button
                            className="task-content"
                            onClick={() => setSelectedTaskId(task.id)}
                            type="button"
                          >
                            <strong>{task.title}</strong>
                            <span>
                              {task.subtasks.length
                                ? `${doneSubtasks}/${task.subtasks.length} サブタスク`
                                : "サブタスクなし"}
                              {typeof task.completedPomodoros === "number" &&
                                ` · ${task.completedPomodoros} ポモドーロ`}
                            </span>
                            <i><b style={{ width: `${progress * 100}%` }} /></i>
                          </button>
                          <button
                            aria-label={`${task.title}を削除`}
                            className="row-action task-delete"
                            onClick={() => deleteTask(task)}
                            type="button"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                          <Icon name="chevron" size={16} />
                        </article>
                      );
                    })}
                    {!projectTasks.length && (
                      <div className="empty-state compact">
                        <div className="empty-illustration"><Icon name="folder" size={25} /></div>
                        <strong>最初のタスクを追加しましょう</strong>
                        <p>小さく具体的な一歩から始めるのがおすすめです。</p>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="detail-column">
                  {selectedTask ? (
                    <>
                      <div className="detail-kicker">選択中のタスク</div>
                      <h2 className={selectedTask.completedAt ? "is-complete" : ""}>
                        {selectedTask.title}
                      </h2>
                      <div className="detail-meta">
                        <span><Icon name="clock" size={15} /> {selectedTask.completedPomodoros ?? 0} セッション完了</span>
                      </div>
                      <div className="subtask-heading">
                        <strong>チェックリスト</strong>
                        <span>
                          {selectedTask.subtasks.filter((item) => item.completedAt).length}/
                          {selectedTask.subtasks.length}
                        </span>
                      </div>
                      <div className="subtask-list">
                        {selectedTask.subtasks.map((subtask) => (
                          <div className={subtask.completedAt ? "subtask done" : "subtask"} key={subtask.id}>
                            <button
                              aria-label={subtask.completedAt ? "未完了に戻す" : "完了にする"}
                              className="check-button small"
                              onClick={() =>
                                void run(`toggle-subtask-${subtask.id}`, () =>
                                  window.dispomo.toggleSubtask(subtask.id),
                                )
                              }
                              type="button"
                            >
                              {subtask.completedAt && <Icon name="check" size={12} />}
                            </button>
                            <span>{subtask.title}</span>
                            <button
                              aria-label={`${subtask.title}を削除`}
                              className="row-action"
                              onClick={() =>
                                void run(`delete-subtask-${subtask.id}`, () =>
                                  window.dispomo.deleteSubtask(subtask.id),
                                )
                              }
                              type="button"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <form className="add-subtask-form" onSubmit={addSubtask}>
                        <Icon name="plus" size={15} />
                        <input
                          aria-label="サブタスク名"
                          maxLength={120}
                          onChange={(event) => setSubtaskName(event.target.value)}
                          placeholder="サブタスクを追加"
                          value={subtaskName}
                        />
                      </form>
                    </>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-illustration"><Icon name="check" size={28} /></div>
                      <strong>タスクを選択</strong>
                      <p>詳細とチェックリストをここで管理できます。</p>
                    </div>
                  )}
                </aside>
              </section>
            ) : (
              <section className="welcome-state">
                <div className="empty-illustration large"><Icon name="folder" size={34} /></div>
                <span className="eyebrow">はじめましょう</span>
                <h2>集中したいことを、ひとつの場所に。</h2>
                <p>プロジェクトを作成して、最初のタスクを整理しましょう。</p>
                <button className="button primary" onClick={() => setShowProjectForm(true)} type="button">
                  <Icon name="plus" size={17} /> プロジェクトを作成
                </button>
              </section>
            )}
          </>
        )}

        {activePanel === "history" && (
          <section className="content-panel">
            <header className="workspace-header">
              <div><span className="eyebrow">振り返り</span><h1>セッション履歴</h1></div>
              <div className="daily-stat">
                <span>{snapshot.history.filter((entry) => entry.phase === "focus").length}</span>
                <div><strong>総フォーカス</strong><small>記録されたセッション</small></div>
              </div>
            </header>
            <div className="history-list">
              {snapshot.history.map((entry) => (
                <article className="history-row" key={entry.id}>
                  <span className={`phase-icon ${entry.phase}`}><Icon name={entry.phase === "focus" ? "target" : "clock"} size={18} /></span>
                  <div>
                    <strong>{entry.taskTitle || PHASE_LABELS[entry.phase]}</strong>
                    <small>{PHASE_LABELS[entry.phase]} · {formatHistoryDate(entry.endedAt)}</small>
                  </div>
                  <span className="history-duration">{formatDuration(entry.durationSeconds)}</span>
                </article>
              ))}
              {!snapshot.history.length && (
                <div className="empty-state panel-empty">
                  <div className="empty-illustration"><Icon name="history" size={27} /></div>
                  <strong>まだ履歴はありません</strong>
                  <p>最初の集中セッションを完了すると、ここに記録されます。</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activePanel === "settings" && (
          <section className="content-panel settings-panel">
            <header className="workspace-header">
              <div><span className="eyebrow">カスタマイズ</span><h1>設定</h1></div>
            </header>
            <form onSubmit={saveSettings}>
              <div className="settings-card">
                <div className="settings-card-title">
                  <span className="settings-icon"><Icon name="clock" /></span>
                  <div><h2>タイマー</h2><p>自分に合う集中と休憩のリズムを設定します。</p></div>
                </div>
                <div className="duration-grid">
                  {([
                    ["focusMinutes", "集中"],
                    ["shortBreakMinutes", "短い休憩"],
                    ["longBreakMinutes", "長い休憩"],
                    ["sessionsUntilLongBreak", "長い休憩まで"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <div className="number-input">
                        <input
                          max={key === "sessionsUntilLongBreak" ? 12 : 120}
                          min={1}
                          onChange={(event) =>
                            setSettingsDraft((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                          type="number"
                          value={settingsDraft[key]}
                        />
                        <small>{key === "sessionsUntilLongBreak" ? "回" : "分"}</small>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-title">
                  <span className="settings-icon discord"><Icon name="discord" /></span>
                  <div><h2>Discord Rich Presence</h2><p>集中状況をDiscordのプロフィールに表示します。</p></div>
                  <label className="switch">
                    <input
                      checked={settingsDraft.discordEnabled}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          discordEnabled: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span />
                  </label>
                </div>
                <fieldset disabled={!settingsDraft.discordEnabled}>
                  <label className="client-id-field">
                    <span>Discord Application ID（詳細設定・任意）</span>
                    <input
                      autoComplete="off"
                      maxLength={64}
                      onChange={(event) =>
                        setSettingsDraft((current) => ({
                          ...current,
                          discordClientId: event.target.value,
                        }))
                      }
                      placeholder="空欄の場合はDisPomo既定のアプリを使用"
                      spellCheck={false}
                      type="text"
                      value={settingsDraft.discordClientId}
                    />
                    <small>
                      通常は空のままで構いません（DisPomo既定のアプリが使われます）。
                      独自の表示アセットを使う場合のみ入力してください。
                    </small>
                  </label>
                  <legend>Discordに表示する内容</legend>
                  {([
                    ["task", "タスク名", "現在のタスク名とプロジェクト名を表示"],
                    ["project", "プロジェクト名のみ", "具体的なタスク名は表示しない"],
                    ["generic", "一般的な表示", "「タスクに集中しています」と表示"],
                  ] as const).map(([value, title, description]) => (
                    <label className="radio-row" key={value}>
                      <input
                        checked={settingsDraft.discordPrivacy === value}
                        name="privacy"
                        onChange={() =>
                          setSettingsDraft((current) => ({ ...current, discordPrivacy: value }))
                        }
                        type="radio"
                      />
                      <span className="radio-dot" />
                      <span><strong>{title}</strong><small>{description}</small></span>
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="settings-actions">
                <button
                  className="button primary"
                  disabled={pendingAction === "save-settings"}
                  type="submit"
                >
                  {pendingAction === "save-settings" ? "保存中…" : "設定を保存"}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      <aside className="focus-panel" aria-label="ポモドーロタイマー">
        <div className="focus-topline">
          <span className={`phase-pill ${timer.phase}`}><i /> {PHASE_LABELS[timer.phase]}</span>
          <span className="session-count">{timer.completedFocusSessions}/{settingsDraft.sessionsUntilLongBreak}</span>
        </div>
        <div
          aria-label={`残り${formatTimer(displayedSeconds)}`}
          className="timer-ring"
          role="timer"
          style={{ "--timer-progress": `${Math.min(1, Math.max(0, timerProgress)) * 360}deg` } as React.CSSProperties}
        >
          <div className="timer-inner">
            <span>{formatTimer(displayedSeconds)}</span>
            <small>
              {timer.status === "running"
                ? "残り時間"
                : timer.status === "paused"
                  ? "一時停止中"
                  : "準備完了"}
            </small>
          </div>
        </div>
        <div className="focus-task">
          <small>{timer.status === "idle" ? "次のフォーカス" : "フォーカス中"}</small>
          <strong>{timerTask?.title ?? "タスクを選択してください"}</strong>
          {timerTask && (
            <span>
              {projects.find((project) => project.id === timerTask.projectId)?.name ?? "プロジェクト"}
            </span>
          )}
        </div>
        <div className="timer-controls">
          <button
            aria-label="タイマーをリセット"
            className="timer-secondary"
            disabled={timer.status === "idle" || pendingAction?.startsWith("pomodoro")}
            onClick={() => command("reset")}
            type="button"
          >
            <Icon name="reset" size={19} />
          </button>
          {timer.status === "running" ? (
            <button
              className="timer-primary"
              disabled={Boolean(pendingAction?.startsWith("pomodoro"))}
              onClick={() => command("pause")}
              type="button"
            >
              <Icon name="pause" size={22} /> 一時停止
            </button>
          ) : timer.status === "paused" ? (
            <button
              className="timer-primary"
              disabled={Boolean(pendingAction?.startsWith("pomodoro"))}
              onClick={() => command("resume")}
              type="button"
            >
              <Icon name="play" size={21} /> 再開
            </button>
          ) : (
            <button
              className="timer-primary"
              disabled={!selectedTask || Boolean(pendingAction?.startsWith("pomodoro"))}
              onClick={() => command("start")}
              type="button"
            >
              <Icon name="play" size={21} /> スタート
            </button>
          )}
          <button
            aria-label="次のフェーズへスキップ"
            className="timer-secondary"
            disabled={pendingAction?.startsWith("pomodoro")}
            onClick={() => command("skip")}
            type="button"
          >
            <Icon name="skip" size={19} />
          </button>
        </div>
        <div className="cycle-track" aria-label="ポモドーロ進捗">
          {Array.from({ length: settingsDraft.sessionsUntilLongBreak }, (_, index) => (
            <span className={index < timer.completedFocusSessions ? "done" : index === timer.completedFocusSessions ? "current" : ""} key={index} />
          ))}
        </div>
        <p className="focus-hint">
          {timer.phase === "focus"
            ? "通知を閉じて、ひとつのことに集中しましょう。"
            : "少し席を離れて、頭と身体を休めましょう。"}
        </p>
      </aside>

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button aria-label="閉じる" onClick={() => setError(null)} type="button">×</button>
        </div>
      )}
    </div>
  );
}
