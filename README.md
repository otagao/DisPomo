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

有効な既定 Application ID を同梱した配布版では、DisPomo をインストールして
Discord を起動するだけで、集中状況が自動的に Rich Presence に反映されます。
OAuth 認証、client secret、追加スコープの設定は不要です。

「設定 → Discord Rich Presence」では、連携の有効・無効と表示範囲を選べます。
表示範囲は「正確なタスク名」「プロジェクト名のみ」「一般テキスト」から選択でき、
タスク情報を出したくない場合は連携を無効にできます。Application ID 入力欄は任意の
詳細設定です。通常は空のままでよく、独自の Discord Application を使いたい場合のみ
入力してください。

配布ビルドへ共通の Application ID を埋め込むには、
`src/integrations/discord/constants.ts` の `DEFAULT_DISCORD_APPLICATION_ID` に実 ID を
記述します。空文字は「未設定」を意味し、実 ID に置き換えた時点で既定値として有効に
なります。Application ID は、設定画面の値、`DISPOMO_DISCORD_APP_ID` 環境変数、
既定値の順に優先されます。環境変数は実行時に読み込まれ、開発時や自前ビルドの起動時に
上書きするために使えます。選ばれた値が未設定、または Discord のスノーフレークである
17〜20 桁の数字ではない場合、Discord への接続は試みません。

画像アセットの登録は必須ではありません。未登録アセットが原因で Presence 全体が
失敗しないよう、アセットキーは送信していません。Discord が終了している、または
利用できない場合も、タスク管理とタイマーはそのまま動作し、再接続可能になった時点で
自動的に連携を再開します。

表示されない場合は Discord デスクトップ版を起動し、ユーザー設定で「現在の実行中の
アクティビティをステータスに表示する」設定が有効になっていることを確認してください。
そのうえで、詳細ログを有効にして DisPomo を起動します。

```bash
DISPOMO_DEBUG_DISCORD=1 npm start
```

ログでは Application ID の値・取得元・有効判定、接続の成否、`setActivity` の
ペイロードと送信結果を順に確認できます。失敗時はメッセージと Discord RPC の
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
