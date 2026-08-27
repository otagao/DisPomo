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
3. Discord 連携を有効にし、表示範囲を選びます。

配布版で共通の Application ID を組み込む場合は、
`src/integrations/discord/constants.ts` の
`DEFAULT_DISCORD_APPLICATION_ID` に実 ID を記述します。空文字は未設定を表し、
実 ID に置き換えた時点で既定値として有効になります。Application ID は起動時の
`DISPOMO_DISCORD_APP_ID` 環境変数でも指定でき、設定画面、環境変数、既定値の順に
優先されます。不正な形式や未設定の場合は Discord へ接続しません。

画像アセットは送信に必須ではありません。DisPomo は未登録アセットによって
Presence 全体が失敗しないよう、Application のアイコンとテキストだけを使います。
Discord が終了していても、タスク管理とタイマーはそのまま動作します。

表示されない場合は Discord デスクトップ版を起動し、アクティビティ共有を有効に
したうえで、詳細ログを有効にして DisPomo を起動します。

```bash
DISPOMO_DEBUG_DISCORD=1 npm start
```

ログで Application ID の値・取得元・有効判定、接続の成否、`setActivity` の
ペイロードと送信結果を順に確認してください。失敗時はメッセージと Discord RPC の
エラーコードが表示されます。

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
