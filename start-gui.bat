@echo off
chcp 65001 >nul
echo MK8DX Bot Controller を起動しています...
echo.

REM Node.jsとpnpmがインストールされているかチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo エラー: Node.jsがインストールされていません。
    echo https://nodejs.org/ からNode.jsをダウンロードしてインストールしてください。
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo pnpmがインストールされていません。インストールしています...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo エラー: pnpmのインストールに失敗しました。
        pause
        exit /b 1
    )
)

REM 必要な依存関係がインストールされているかチェック
if not exist "node_modules\electron" (
    echo Electron依存関係をインストールしています...
    pnpm run gui:install
    if %errorlevel% neq 0 (
        echo エラー: 依存関係のインストールに失敗しました。
        pause
        exit /b 1
    )
)

REM GUIアプリケーションを起動
echo GUIアプリケーションを起動中...
echo 注意: ターミナルに文字化けした出力が表示される場合がありますが、
echo GUIアプリケーションは正常に動作します。
echo.
pnpm run gui:dev

pause