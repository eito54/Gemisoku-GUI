# Grosoq アーキテクチャドキュメント

## 概要

Grosoqは、マリオカート8デラックス（MK8DX）のレース結果をAI-OCRで自動取得し、配信オーバーレイに表示するElectronアプリケーションです。electron-vite + TypeScriptで構成されています。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| アプリシェル | Electron 39（sandbox有効・contextIsolation有効） |
| ビルド | electron-vite 5 / Vite 7 |
| UI | React 19 + Tailwind CSS 3 + framer-motion |
| 国際化 | i18next / react-i18next |
| OBS連携 | obs-websocket-js 5 |
| 内蔵サーバー | Express 4（localhost限定） |
| AI解析 | Groq API（OpenAI互換エンドポイント） |

## プロセス構成

```
┌─────────────────────────────────────────────────┐
│ Main Process (src/main)                          │
│  ├─ index.ts         起動・ウィンドウ・ショートカット │
│  ├─ config-manager.ts 設定の読み書き(深いマージ)     │
│  ├─ api-manager.ts   Groq OCR解析・モデル一覧       │
│  ├─ obs-manager.ts   OBS WebSocket接続(シングルトン) │
│  ├─ server.ts        Express(SSE/スコアAPI/静的配信) │
│  └─ ipc-handlers.ts  IPCハンドラ登録・自動更新       │
├─────────────────────────────────────────────────┤
│ Preload (src/preload)                            │
│  └─ index.ts  IPCチャンネルホワイトリスト橋渡し        │
├─────────────────────────────────────────────────┤
│ Renderer (src/renderer)                          │
│  └─ App.tsx + components/*  GUI                  │
├─────────────────────────────────────────────────┤
│ Overlay (public/overlay/index.html)              │
│  └─ OBSブラウザソース用バニラJSページ               │
│     (内蔵サーバーのSSEでリアルタイム更新)            │
└─────────────────────────────────────────────────┘
```

## データフロー

### レース結果取得フロー
```
F1/F2キー or GUIボタン
  → IPC fetch-race-results
  → ObsManager.getScreenshot()   (OBS WebSocket)
  → ApiManager.analyzeRaceGroq() (Groq Vision OCR)
  → チーム推論(共通プレフィックス) + スコア加算
  → POST /api/scores             (内蔵サーバー経由で永続化)
  → SSE broadcast → オーバーレイ & GUI が即時更新
```

### オーバーレイ更新フロー
```
OBS Browser Source (http://localhost:{port}/?overlay=true)
  → EventSource /api/scores/events  (変更通知のみ)
  → GET /api/scores                 (実データ)
  → アニメーション付き再描画
```

## セキュリティ設計

1. **内蔵サーバーは `127.0.0.1` のみリッスン** — LAN上の他デバイスからAPIに到達不可
2. **`GET /api/config`はサニタイズ済み** — オーバーレイに必要なテーマ/色のみ返却し、APIキー・OBSパスワードは含めない
3. **CORSオリジン制限** — Electron本体(file://)とlocalhost系オリジンのみ許可し、同一マシン上の悪意あるWebページからのアクセスを遮断
4. **IPCチャンネルホワイトリスト** — preloadで呼び出し可能チャンネルを列挙し、レンダラ侵害時の被害を最小化
5. **`open-external`はhttp(s)のみ** — `shell.openExternal`への任意プロトコル渡しを禁止
6. **sandbox: true** — レンダラプロセスのサンドボックス有効

## 設定管理

- `ConfigManager`が単一の真実の源（Single Source of Truth）
- `userData/config.json` に保存、**深いマージ**によりネストした設定（overlayColors等）の一部欠損でもデフォルト値で補完
- レンダラ側にデフォルト値のコピーを持たない

## ビルド・配布

```bash
pnpm install          # 依存解決 (pnpm使用)
npm run dev           # 開発起動
npm run typecheck     # 型チェック (main/preload/renderer)
npm run build:overlay # オーバーレイ用Tailwind CSS生成
npm run build         # overlay CSS + electron-vite build
npm run build-win     # Windows NSISインストーラ
```

- オーバーレイはTailwind Play CDNに依存しない（ビルド済みCSSを同梱、オフライン配信でも動作）
- 配布はGitHub Releases + electron-updater（差分アップデート対応）

## 今後の改善候補

- App.tsx（約3,000行）のタブ単位コンポーネント分割
- ESLint/Prettier導入とCI整備
- 単体テスト（特にチーム推論ロジック）
