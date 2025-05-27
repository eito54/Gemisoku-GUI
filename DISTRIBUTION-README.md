# 🚀 Gemisoku-GUI - 配布版

このElectronアプリは、環境のないユーザーでもMK8DXのレース結果を自動取得できるスタンドアロン版です。

## 📦 ビルド方法

### 前提条件
- Node.js 22.10.0以上
- pnpm（推奨）またはnpm

### 1. 依存関係のインストール
```bash
pnpm install
```

### 2. 配布用ビルド
```bash
# Windows実行ファイル(.exe)を作成
pnpm run gui:build-win

# macOS用アプリケーション(.dmg)を作成
pnpm run gui:build-mac

# Linux用AppImage(.AppImage)を作成
pnpm run gui:build-linux

# 現在のプラットフォーム用のビルド
pnpm run gui:build
```

### 3. 配布ファイルの場所
ビルド完了後、`dist-gui/` フォルダに実行ファイルが生成されます：

```
dist-gui/
├── Gemisoku-GUI Setup 0.1.0.exe  (Windows)
├── Gemisoku-GUI-0.1.0.dmg        (macOS)
└── Gemisoku-GUI-0.1.0.AppImage   (Linux)
```

## 🎯 配布版の特徴

### ✅ 完全スタンドアロン
- **Node.js不要**: エンドユーザーにNode.js環境は不要
- **pnpm不要**: パッケージマネージャーのインストール不要
- **依存関係込み**: 必要なライブラリはすべて内蔵

### ✅ 内蔵Webサーバー
- **Express.js組み込み**: 軽量なWebサーバーを内蔵
- **ポート自動選択**: 3001番ポートから自動で空きポートを検索
- **API完全互換**: 既存のNext.jsアプリと同じAPIを提供

### ✅ 設定の永続化
- **JSON設定ファイル**: アプリ終了後も設定を保持
- **初回セットアップ**: 簡単な設定ガイド
- **設定検証**: 入力値の自動検証

## 🖥️ エンドユーザー向け使用方法

### 1. インストール
1. 配布された実行ファイルをダウンロード
2. Windows: `.exe`を実行してインストール
3. macOS: `.dmg`をマウントしてアプリケーションフォルダにドラッグ
4. Linux: `.AppImage`に実行権限を付与して実行

### 2. 初回設定
アプリを起動すると、設定画面が表示されます：

```
OBS WebSocket設定:
├── IPアドレス: localhost (同じPC) または実際のIP
├── パスワード: OBSで設定したWebSocketパスワード
└── ソース名: キャプチャソースの名前

Gemini API設定:
└── APIキー: Google AI Studioで取得したAPIキー
```

### 3. 使用手順
1. **設定保存**: 「💾 設定を保存」をクリック
2. **接続テスト**: 「🔗 接続テスト」で動作確認
3. **オーバーレイ表示**: 「🖥️ オーバーレイを開く」でブラウザが開く
4. **OBS設定**: そのURLをOBSのブラウザソースに追加
5. **レース分析**: ゲーム中に「📊 レース結果を取得」ボタンを押す

## 🔧 技術仕様

### アーキテクチャ
```
Electronアプリ
├── メインプロセス (gui/main.js)
│   ├── 内蔵Express.jsサーバー
│   ├── 設定管理システム
│   └── IPC通信ハンドラー
├── レンダラープロセス (gui/index.html)
│   └── ユーザーインターフェース
└── 静的オーバーレイ (gui/static/index.html)
    └── OBS用スコア表示
```

### 内蔵API
- `POST /api/obs` - OBSスクリーンショット取得
- `POST /api/gemini` - Gemini AI分析
- `POST /api/fetch-race-results` - レース結果分析
- `GET|POST /api/scores` - スコア取得・保存
- `GET /api/localIp` - ローカルIP取得

### データ保存
```
アプリディレクトリ/
├── config.json     (設定ファイル)
├── scores.json     (スコアデータ)
└── logs/          (ログファイル)
```

## ⚠️ 制限事項

### API制限
- **Gemini API**: Google AI Studioの利用制限に依存
- **OBS WebSocket**: OBS 28.0以降が必要

### システム要件
- **Windows**: Windows 10以降 (x64)
- **macOS**: macOS 10.15以降
- **Linux**: Ubuntu 18.04以降または同等のディストリビューション

### ネットワーク
- **インターネット接続**: Gemini API利用時に必要
- **ローカルネットワーク**: OBS接続時に必要

## 🐛 トラブルシューティング

### よくある問題

#### 1. アプリが起動しない
- ウイルス対策ソフトのブロックを確認
- Windowsの場合：「不明な発行元」の警告を許可
- macOSの場合：セキュリティ設定で実行を許可

#### 2. OBS接続エラー
```
エラー: WebSocket connection failed
解決: OBSのWebSocketサーバー設定を確認
- ツール → WebSocketサーバー設定
- サーバーを有効にする ✅
- パスワードを設定
```

#### 3. Gemini APIエラー
```
エラー: Invalid API key
解決: Google AI StudioでAPIキーを再確認
- https://makersuite.google.com/
- 新しいAPIキーを生成
- 利用制限を確認
```

#### 4. ポートが使用中
```
エラー: Port 3001 already in use
解決: アプリが自動で別のポートを検索
- 通常は3002, 3003...と自動増加
- 複数起動していないか確認
```

## 📋 配布前チェックリスト

### ビルド前確認
- [ ] アイコンファイル（logo.jpeg）が存在する
- [ ] package.jsonのバージョンが正しい
- [ ] 必要な依存関係がインストール済み
- [ ] 開発環境での動作確認済み

### ビルド後確認
- [ ] 各プラットフォームで実行可能
- [ ] 設定の保存・読み込みが正常
- [ ] OBS接続とGemini API呼び出しが正常
- [ ] オーバーレイ表示が正常
- [ ] アプリのアンインストールが正常

### 配布時の注意
- [ ] システム要件を明記
- [ ] セットアップ手順書を同梱
- [ ] トラブルシューティングガイドを提供
- [ ] サポート連絡先を明記

---

## 📞 サポート

技術的な問題や質問がある場合は、プロジェクトのIssuesページでお知らせください。

**注意**: この配布版は、元のNext.jsアプリケーションと独立して動作しますが、同じ機能を提供します。