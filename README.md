# DisPomo

DisPomo は、タスク管理・ポモドーロ・Discord Rich Presence をひとつにした
ローカルファーストのデスクトップアプリです。Electron、React、TypeScript、
SQLite で構築されています。

## MVP でできること

- プロジェクト、タスク、サブタスクの作成・完了・削除
- タスクごとの集中、短い休憩、長い休憩、一時停止、再開、リセット、スキップ
- 完了・スキップしたポモドーロセッションの履歴
- タスク名・プロジェクト名・一般テキストを選べる Discord プライバシー設定
- Discord が起動していない場合の安全な継続と再接続
- システムトレイ、デスクトップ通知
- Electron のユーザーデータディレクトリにある SQLite へのローカル保存
- macOS、Windows、Linux 向けパッケージ設定

## 開発

Node.js 22 以降を使います。

```bash
npm install
npm run dev
```

検証コマンド:

```bash
npm run typecheck
npm test
npm run build
npm run package:dir
```

インストーラーを作る場合は `npm run package` を実行します。成果物は
`release/` に生成されます。各 OS 用の署名・公証は配布環境で別途設定してください。

## Discord Rich Presence

1. Discord Developer Portal で Application を作成します。
2. Application ID を DisPomo の「設定 → Discord Application ID」に入力します。
3. 必要なら Rich Presence Assets に `focus` と `break` を登録します。
4. Discord 連携を有効にし、表示範囲を選びます。

Application ID は、起動時の `DISCORD_CLIENT_ID` 環境変数でも指定できます。
設定画面の値が優先されます。Discord が終了していても、タスク管理とタイマーは
そのまま動作します。

## アーキテクチャ

```text
src/
├── main/                    # Electron、IPC、ウィンドウ、トレイ
├── renderer/                # React UI（Node.js へ直接アクセスしない）
├── domain/                  # エンティティ、設定、進捗計算
├── database/                # SQLite とマイグレーション
├── pomodoro/                # 純粋なタイマー状態機械
└── integrations/discord/    # Discord RPC アダプター
```

レンダラーから利用できる機能は、コンテキスト分離された preload API に限定して
います。IPC 入力は main process で検証され、SQLite を唯一の永続的な情報源として
扱います。タイマーは毎秒データベースへ書かず、保存した終了時刻から残り時間を
計算します。
