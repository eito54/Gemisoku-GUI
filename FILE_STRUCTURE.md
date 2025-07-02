# ファイル構成・役割一覧

## ルートディレクトリ

- **package.json**  
  プロジェクトの依存関係・スクリプト・ビルド設定などを管理。

- **package-lock.json / pnpm-lock.yaml**  
  依存パッケージのバージョン固定ファイル。

- **README.md / GUI-README.md / ARCHITECTURE.md / MIGRATION-GUIDE.md / REFACTORING-SUMMARY.md / DISTRIBUTION-README.md**  
  各種ドキュメント。プロジェクト概要、設計、移行手順、配布方法など。

- **LICENSE**  
  ライセンス情報。

- **.env.example**  
  環境変数のサンプル。

- **start-gui.bat**  
  Windows用GUI起動バッチ。

- **assets/**  
  画像・アイコン等の静的アセット。

---

## gui/ ディレクトリ

- **main.js**  
  Electronのメインプロセス。ウィンドウ生成、IPC、サーバ起動、アプリ全体の制御。

- **preload.js**  
  レンダラープロセスとメインプロセス間の安全な橋渡し（contextBridge等）。

- **renderer.js**  
  レンダラープロセス（UI側）のロジック。ボタン操作、設定管理、オーバーレイ起動、UIイベント処理。

- **server.js**  
  内蔵Webサーバ。オーバーレイやAPIの提供、OBS連携等のバックエンド処理。

- **config-manager.js**  
  設定ファイルの読み書き・管理。

- **i18n.js**  
  多言語対応（国際化）処理。

- **index.html / edit-window.html**  
  メインウィンドウ・得点編集ウィンドウのHTML。

- **locales/**  
  多言語リソース（en.json, ja.json）。

- **static/index.html**  
  オーバーレイ用のHTML。配信ソフトのブラウザソースで利用。

- **views/**  
  追加のHTMLビュー（edit-window.html, index.html等）。

---

## assets/

- **a.png, b.png, ex.gif, logo.jpeg**  
  アプリやオーバーレイで使用する画像・ロゴ。

---

### 備考

- 各JS/HTMLファイルは役割ごとに分離されており、Electronアプリの構成・配信・オーバーレイ表示・OBS連携・設定管理・多言語対応などを担っています。
- 詳細な処理内容は各ファイルの先頭コメントやドキュメントも参照してください。