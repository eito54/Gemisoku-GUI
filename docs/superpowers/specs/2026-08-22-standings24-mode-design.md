# 24人スタンド読取モード 設計仕様

- 日付: 2026-08-22
- ステータス: 承認済み
- 対象: Grosoq (MK8DXレース結果自動取得アプリ)

## 背景

Grosoqは12人ロビーのレース結果画面を前提として設計されている（OCRプロンプト・配点計算・残りレース数計算がすべて12人固定）。ユーザーは24人規模のイベントに対応したい。

対象となる画面は**レース結果画面ではなく、レース開始前に表示されるプレイヤー情報（スタンド）**であり:

- キャプチャ1枚の**左半分**に24人分の名前と累計ポイントがすべて表示される
- 表示される点数は**常に累計値**であるため、順位からの配点加算は行わない
- 自チームの自動判別は該当画面では不可能 → 既存の手動自チーム選択機能で後から設定する

## 要件

1. 設定で「解析モード」を選択できる: `標準（12人・レース結果）` または `24人スタンド（左半分クロップ）`
2. 24人スタンドモードでは:
   - スクリーンショットの左半分のみをAI OCRに渡す
   - 最大24行の「名前＋累計スコア」を読み取り、**読み取った値でスコアテーブルを上書き**する（加算しない）
   - ダッシュボードの取得ボタン・F1/F2ショートカットはすべてこの動作になる
3. 標準モードの既存動作（F1=加算 / F2=上書き）は一切変更しない
4. 新規依存パッケージは追加しない

## 非要件（明示的にやらないこと）

- 右半分の解析
- 24人用配点表の導入（累計値を直接読むため不要）
- 24人モードでの自チーム自動検出（手動選択で代替）
- オーバーレイの24行最適化（現状のジェネリック描画で機能する）

## アーキテクチャ

採用アプローチ: **モード設定式（案1）**。既存のF2経路（useTotalScore=true の上書きフロー）を最大限再利用する。

### 1. 設定 (`src/main/config-manager.ts`)

```ts
// Config インターフェースに追加
analysisMode: 'standard12' | 'standings24'   // デフォルト: 'standard12'
```

- `getDefaultConfig()` にデフォルト値を追加
- 深いマージにより既存ユーザーの config.json は自動補完される（移行処理不要）

### 2. メインプロセス (`src/main/api-manager.ts`)

**クロップ関数**:

```ts
private cropLeftHalf(dataUrl: string): string {
  // nativeImage.createFromBuffer(base64部分) → getSize()で実寸取得
  // → crop({ x: 0, y: 0, width: floor(w/2), height: h })
  // → toJPEG(90) → data URL 再構築
  // デコード失敗時は元画像をそのまま返す（フォールバック）
}
```

- スクリーンショットは OBS 側で 1920×1080 に固定スケールされるため、左半分 = 960×1080 で確定的
- 実寸は `getSize()` から動的取得（ソース解像度変更にも耐える）

**スタンド解析プロンプト**（新規。既存2種とは別）:

- 「レース開始前に表示されるスタンド画面であること」「最大24行」「各行は名前＋累計スコア」を指示
- 出力スキーマ: `{ results: [{ name: string, score: number, isCurrentPlayer: boolean }] }`
- rank / team フィールドは要求しない（チーム名は既存の player-mappings 機構が processRaceResults 後段で適用される）
- 抽出行数が24超の場合は `slice(0, 24)`、score 欠損は 0 として正規化

**分岐** (`analyzeRace`):

```ts
const useTotalScoreEffective = useTotalScore || config.analysisMode === 'standings24'
```

- standings24 モードでは renderer が false を渡してもメインプロセス側で強制（二重保証）
- キャッシュハッシュ（MD5）にはモード文字列も含め、モード切替直後の誤キャッシュヒットを防ぐ
- `isAnalyzing` 排他ガード等の既存機構はそのまま流用

### 3. レンダラ (`src/renderer/src/App.tsx`)

- `handleFetchResults(useTotalScore)` 内で実効フラグを算出:
  `const effective = useTotalScore || config?.analysisMode === 'standings24'`
  以降の処理は既存の useTotalScore=true パス（マッピングリセット → 読み値で全上書き → POST）をそのまま使用
- ダッシュボードUI: standings24 モードでは取得ボタンを1つに統合し「24人スタンドを取得」と表示（レース結果/チーム合計点の2ボタンのうち片方を非表示）。
  F1/F2ショートカットは両方とも同じ動作のまま変更しない
- ログ文言・i18n は ja/en 両方に追記
  - 例: ja「24人スタンドを取得中...」/ en "Fetching 24-player standings..."

### 4. 設定UI (`App.tsx` AI設定タブ)

- ラジオボタン2択: 「標準（12人・レース結果）」/「24人スタンド（左半分クロップ）」
- フォーム項目名 `analysisMode`、`handleSaveConfig` の hasField 分岐に追加
- ヘルプテキスト: 「レース開始前のスタンド画面を解析します。左半分だけを切り取って読み取ります」

### 5. サーバー (`src/main/server.ts`)

- `/api/scores` の `remainingRaces` 計算は standard12 モードでのみ実施し、standings24 では `null` を返す
- オーバーレイは既存の null ハンドリングにより残りレース表示が自動非表示になる（変更不要）

### 6. オーバーレイ / プリロード / IPC

- 変更なし（オーバーレイは scores 配列をジェネリック描画するため24行もそのまま表示）
- 新規IPCチャンネルは設けない（`fetch-race-results` を再利用）

## データフロー（standings24 モード）

```
F1/F2 or ボタン
  → renderer: effective=true 判定 → マッピングリセット POST
  → IPC fetch-race-results(true)
  → ObsManager.getScreenshot()          (1920×1080 JPEG)
  → cropLeftHalf()                       (960×1080 JPEG)
  → analyzeStandingsGroq()               (Groq Vision, 最大24行)
  → processRaceResults()                 (名前正規化 + player-mappings適用)
  → renderer: tempMap 生成 → 全上書き POST /api/scores
  → SSE broadcast → オーバーレイ & GUI 更新
```

## エラー処理

| 状況 | 挙動 |
|---|---|
| クロップ用画像デコード失敗 | 元画像のまま解析へフォールバック + console.error |
| OCR結果が24行超 | 24行に切り捨て |
| score欠損・非数 | 0 として扱う |
| Groq APIエラー | 既存のエラー伝播（GUIモーダル表示） |

## 既知のトレードオフ（現行F2と同一仕様）

- スタンド読取のたびにプレイヤーマッピングがリセット→自動推論される。手動マッピングを使う場合は読取後に編集が必要
- 誤った画面（レース結果など）をスタンドモードで読むと現在のスコアを上書きしてしまう。ヘルプテキストで注意を促す

## 解像度ポリシー（Switch 2 WQHD/4K 対応）

- OBS `GetSourceScreenshot` は `imageWidth/imageHeight` パラメータにより、ソース解像度に関係なく
  常に **1920×1080 に正規化**して返す（Switch 2 の WQHD/4K 出力でも自動スケール）
- Groq の画像上限は 20MB/リクエストに対し、1080p JPEG は数百 KB — 余裕十分
- ビジョンモデルはエンコーダ内部でダウンスケールするため、それ以上の解像度は精度に寄与せず
  レイテンシのみ増加 → **1080p 正規化を意図的な設計点として維持する**
- 実装計画内で `obs-manager.ts` の 1920/1080 を名前付き定数化し、正規化ポイントである旨を文書化
- 左半分クロップ後の実効ペイロードは約 960×1080（フルフレーム比 約1/4）

## テスト方針

- `npm run typecheck` / `npm run build` 通過
- standard12 モードの回帰確認（既存フローが変わらないこと）
- 実機OBSでの精度検証はユーザー環境で実施（リリース前ゲート）

## 将来拡張（本仕様の範囲外）

- 解析モデルの設定UI選択化（CURRENT_VISION_MODEL 定数との接続）
- クロップ領域の比率調整UI
