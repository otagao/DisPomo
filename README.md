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

有効な既定Application IDを同梱した配布版では、DisPomoをインストールして
Discordを起動するだけで、集中状況が自動的にRich Presenceへ反映されます。
OAuth認証、client secret、追加スコープの設定は必要ありません。

「設定 → Discord Rich Presence」では、連携の有効・無効と表示範囲を選べます。
表示範囲は、正確なタスク名、プロジェクト名のみ、一般テキストから選択できます。
タスク情報を表示したくない場合は、Discord連携を無効にしてください。

通常、Application ID欄は空のままで構いません。独自のDiscord Applicationと
Rich Presence Assetsを使いたい場合だけ、そのApplication IDを詳細設定欄へ
入力します。`DISPOMO_DISCORD_APP_ID`は実行時に読み込まれ、開発時や自前ビルドを
起動する際の上書きに利用できます。設定画面の値が優先されます。

配布版へ既定IDを恒久的に埋め込む場合は、
`src/integrations/discord/constants.ts`のプレースホルダーを実際のApplication IDへ
置き換えてからビルドします。プレースホルダー、空文字、明らかに不正な形式のIDでは
Discordへの接続を試みません。

Discordが終了している、または利用できない場合も、タスク管理とタイマーは
そのまま動作し、再接続可能になった時点で自動的に連携を再開します。

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
