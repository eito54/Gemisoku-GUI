# Grosoq 現状ステータス

- 更新日: 2026-08-22
- 基準コミット: `bc7c3f9`（v3.2.0タグから **39コミット**。**すべてローカル・未push**）

## 1. リリース済み

| 版 | 状態 |
|---|---|
| **v3.2.0** | GitHub Releases公開済み。インストーラ95.9MB + blockmap + latest.yml配信中（既存ユーザーへ自動更新適用） |

## 2. 未リリースの作業（v3.2.0以降の39コミット）

### 2.1 24人スタンド読取モード ✅ 実装完了・手動検証待ち

- 設定 `analysisMode: standard12 | standings24`
- 列A/B個別クロップ（X: 0〜100%、Y: 共通帯）→ **2画像を1リクエスト送信**
- スタンド専用OCRプロンプト（最大24行・累計値をそのまま採用・ステッカー数字無視指示）
- 校正UI: OBSキャプチャプレビュー上に列範囲を青/緑枠可視化＋数値入力
- 残りレース数計算はstandings24では無効化（オーバーレイ自動非表示）
- 取得ボタンは1つに統合（「24人スタンドを取得」）、F1/F2も同一動作
- 仕様書: `docs/superpowers/specs/2026-08-22-standings24-mode-design.md`

### 2.2 スタンド24最適化 B-1〜B-4 ✅ 実装完了

| ID | 内容 |
|---|---|
| B-1 | キャリブレーション（上述） |
| B-2 | 変化ハイライト: addedScore=前回差分（初回読取は0） |
| B-3 | 欠席プレイヤー保持: 最終値のまま50%減色＋「不在」バッジ、演出スキップ |
| B-4 | **dc対策**: 減少検出→確認モーダル→オフセット永続化(`reconnect-offsets.json`)、以後自動加算 |

バックログ: `docs/superpowers/specs/2026-08-22-standings24-backlog.md`

### 2.3 デザイン刷新 ✅ 実装完了

- 監査所見 F-001〜F-007 をすべて修正（ネストスクロール解消/コントラストCR≥4.5/12px下限/32pxクリック領域/絵文字撤去/半径統一/surface色トークン）
- A化ロードマップ Phase1〜3 実施:
  - レーシングアクセント配色（MK8DXレッド由来`accent`スケール、blue全面スイープ）
  - surface/raised/deep色トークン、`:focus-visible`全要素、`prefers-reduced-motion`対応
  - スプラッシュ2.5s→**1.4s＋クリックスキップ**（設定編集でウィザード再発火する潜在バグも修正）
  - **DESIGN.md**新設（Racing HUD原則の明文化）
- フォント: カスタム書体3種を試験導入したが**いずれも不採用**→システムスタックへ戻し済み。
  DESIGN.mdに「再挑戦時はユーザー事前承認必須」と明記
- 監査レポート: `.gstack/design-reports/design-audit-grosoq-20260822.md`（スコア C+/C → B/C+、フォント戻し後は要再評価）

### 2.4 i18n完全英語化 🔄 進行中（約60%）

| チャンク | 対象 | 状態 |
|---|---|---|
| ブランディング | サブタイトル「MK8DX・MKWorld即時集計」等 | ✅ `33e73da` |
| A | サイドバー/設定サブタブ/オーバーレイサブタブ/About見出し | ✅ `3af989f` |
| B | ダッシュボード見出し・確認モーダルprops・プレビューパネル見出し | ✅ `e55ddb6` |
| C | ログメッセージ約40種＋GUIダイアログ約12種（補間含む） | ✅ `bc7c3f9` |
| **D** | 初期設定ウィザード全文言＋レビュー修正＋**校正ステップ挿入（5ステップ化）** | ✅ `c6db690`+`9f71064`+`b44f514` |
| **E** | SlotModal / ConfirmModalデフォルト / ScoreItemラベル | ✅ `581b197` |
| **F** | 残存108行: 設定系ラベル・オーバーレイ詳細・リオープン画面・アップデートUI・編集ボタン類 | ⬜ 未着手 |

検証ツール: `node scripts/check-jp-strings.cjs`（コメント行を除くユーザー表示日本語の残存を検出）

### 2.5 その他

- design-review用Electronキャプチャ/監査スクリプト追加（`scripts/design-capture.cjs` / `design-audit.cjs`）
- pnpm設定: `pnpm-workspace.yaml`に `blockExoticSubdeps: false`（electron-builderのgit依存のため）

## 3. 既知の残課題

| # | 内容 | 優先度 |
|---|---|---|
| R-1 | i18nチャンクD（ウィザード）・E（コンポーネント） | 高（現行作業） |
| R-2 | 24人モードの手動検証（校正→読取精度→dc対策→回帰） | 高（リリース前必須） |
| R-3 | 39コミット未push | 中 |
| R-4 | ステッカー数字の誤認識 — 校正機能で解決見込み、実機確認のみ | 中 |
| R-5 | 「v→v」バッジのコントラスト CR≈4.24 | 低 |
| R-6 | App.tsx約3,200行の分割 / ESLint・CI整備 / 単体テスト | 低〜中 |
| R-7 | mainプロセス側の日本語メッセージ（dialog/エラー文言）はi18n対象外のまま | 低 |

## 4. ドキュメント索引

- `DESIGN.md` — デザイン原則（Racing HUD・トークン表・禁止事項）
- `docs/superpowers/specs/2026-08-22-standings24-mode-design.md`
- `docs/superpowers/specs/2026-08-22-dc-countermeasure-design.md`
- `docs/superpowers/specs/2026-08-22-standings24-backlog.md`
- `docs/superpowers/plans/2026-08-22-standings24-mode.md`
- `.gstack/design-reports/design-audit-grosoq-20260822.md`

## 5. 次のアクション（推奨順）

1. i18nチャンクD・Eを完了させる
2. `pnpm dev`で手動検証チェックリスト消化（24人モード/回帰）
3. 全件OKなら push → `package.json`を3.3.0へ → README更新 → `npm run release-win` でv3.3.0公開
