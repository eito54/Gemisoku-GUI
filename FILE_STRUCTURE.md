# ファイル構成・役割一覧

## ルートディレクトリ

- **package.json** — 依存関係・スクリプト・electron-builder設定
- **pnpm-lock.yaml** — 依存のバージョン固定（パッケージマネージャはpnpm）
- **electron.vite.config.ts** — electron-vite設定（main/preload/renderer）
- **tailwind.config.js** — GUI用Tailwind設定
- **tailwind.overlay.config.js** — オーバーレイ用Tailwind設定（`npm run build:overlay`で使用）
- **postcss.config.js** — PostCSS設定
- **tsconfig.json** — TypeScriptソリューションファイル（各プロセスのtsconfigへの参照）
- **start-gui.bat** — Windows用開発起動バッチ（`pnpm dev`）
- **grosoq.code-workspace** — VS Codeワークスペース設定
- **README.md / ARCHITECTURE.md / FILE_STRUCTURE.md / DISTRIBUTION-README.md / GUI-README.md** — ドキュメント
- **.env.example** — 環境変数サンプル
- **assets/** — ロゴ等の静的アセット
- **public/overlay/** — OBSブラウザソース用オーバーレイ（index.html + ビルド済みtailwind.css + フォント）

## src/main/ （Electronメインプロセス）

- **index.ts** — エントリポイント。ウィンドウ生成、グローバルショートカット(F1/F2)、サーバー起動（ポート競合時は代替ポートを自動探索）、IPC登録
- **config-manager.ts** — 設定の型定義・デフォルト値・深いマージによる読み書き（`userData/config.json`）
- **api-manager.ts** — Groq API呼び出し。OCR解析プロンプト、チーム推論、モデル一覧取得（画像認識対応判定つき）
- **obs-manager.ts** — OBS WebSocket接続管理（シングルトン）。スクリーンショット取得、ソース検出、オーバーレイ自動セットアップ
- **server.ts** — Express内蔵サーバー。SSE配信、スコア/マッピング/スロットAPI、オーバーレイ静的配信。**localhost限定リッスン**
- **ipc-handlers.ts** — 全IPCハンドラ。設定入出力、OBS操作、自動更新(electron-updater)
- **utils.ts** — HTTPクライアント(タイムアウト付き)、バージョン比較

## src/preload/

- **index.ts** — contextBridgeでIPCチャンネルホワイトリストのみを公開

## src/renderer/src/ （GUI・React）

- **main.tsx / App.tsx** — エントリとメイン画面（ダッシュボード/リオープン/マッピング/オーバーレイ/設定/Aboutタブ）
- **components/** — UI部品（モーダル類、ScoreItem、GroqModelList、BackgroundEffect ほか）
- **i18n.ts / locales/{ja,en}.json** — 国際化
- **types/index.ts, utils.ts** — 共有型・ユーティリティ
