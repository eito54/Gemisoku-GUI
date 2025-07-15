console.log('Loading Electron...');
const electron = require('electron');
console.log('Electron module:', Object.keys(electron));
const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
const path = require('path');
const Store = require('electron-store');
const https = require('https');
// グローバルショートカット用
const { globalShortcut } = require('electron');
const http = require('http');
const ConfigManager = require('./config-manager');
const EmbeddedServer = require('./server');

// 自動アップデート機能
const { autoUpdater } = require('electron-updater');

// 開発環境では自動アップデートを無効化
if (process.env.NODE_ENV === 'development') {
  autoUpdater.updateConfigPath = null;
  autoUpdater.checkForUpdatesAndNotify = () => Promise.resolve();
}
// プロダクション環境では手動でアップデートチェックを制御

// 設定ストア（後方互換性のため保持）
const store = new Store();
// 新しい設定管理システム
const configManager = new ConfigManager();
// 内蔵サーバー
const embeddedServer = new EmbeddedServer();

let mainWindow;
let editWindow;
let reopenManagerWindow;
let serverPort = 3001;
let lastScreenshot = null; // 直近のスクリーンショットを保持する変数

// 自動アップデート設定
autoUpdater.logger = console;

// アップデートイベントの設定
autoUpdater.on('checking-for-update', () => {
  console.log('アップデートをチェック中...');
});

autoUpdater.on('update-available', (info) => {
  console.log('アップデートが利用可能です:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('アップデートはありません');
});

autoUpdater.on('error', (err) => {
  console.log('アップデートエラー:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`ダウンロード進行中: ${Math.round(progressObj.percent)}%`);
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('アップデートのダウンロードが完了しました');
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/logo.jpeg'),
    title: 'Gemisoku-GUI'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // グローバルショートカット登録（ウィンドウ生成後に確実に登録）
  globalShortcut.unregisterAll();
  globalShortcut.register('F1', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-fetch-race-results');
    }
  });
  globalShortcut.register('F2', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-fetch-overall-scores');
    }
  });

  // 開発環境でのみDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createEditWindow() {
  if (editWindow) {
    editWindow.focus();
    return;
  }

  editWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    parent: mainWindow,
    modal: true,
    title: '得点編集',
    resizable: false,
    minimizable: false,
    maximizable: false
  });

  editWindow.loadFile(path.join(__dirname, 'edit-window.html'));

  editWindow.on('closed', () => {
    editWindow = null;
  });

  // 開発環境でのみDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    editWindow.webContents.openDevTools();
  }
}

function createReopenManagerWindow() {
  if (reopenManagerWindow) {
    reopenManagerWindow.focus();
    return;
  }

  reopenManagerWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    parent: mainWindow,
    title: 'リオープン管理 - Gemisoku-GUI',
    resizable: true,
    minimizable: true,
    maximizable: true,
    icon: path.join(__dirname, '../assets/logo.jpeg')
  });

  reopenManagerWindow.loadFile(path.join(__dirname, 'views', 'reopen-manager.html'));

  reopenManagerWindow.on('closed', () => {
    reopenManagerWindow = null;
  });

  // 開発環境でのみDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    reopenManagerWindow.webContents.openDevTools();
  }
}

// 内蔵サーバーを起動
async function startEmbeddedServer() {
  try {
    serverPort = await embeddedServer.start();
    console.log(`Embedded server started on port ${serverPort}`);
  } catch (error) {
    console.error('Failed to start embedded server:', error);
  }
}

// バックグラウンドアップデートチェック
async function startBackgroundUpdateCheck() {
  try {
    console.log('Starting background update check...');
    
    // 開発環境でもGitHub APIを使用してチェック
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: using GitHub API for update check');
    }
    
    // 通常のアップデートチェック処理と同じロジックを使用
    try {
      // プロダクション環境のみ通常のアップデートチェックを試行
      if (process.env.NODE_ENV !== 'development') {
        const result = await autoUpdater.checkForUpdates();
        console.log('Background auto-updater result:', result);
      } else {
        throw new Error('Development mode - skip auto-updater');
      }
    } catch (autoUpdaterError) {
      console.log('Auto-updater failed or skipped, trying manual check:', autoUpdaterError.message);
      
      // フォールバック: GitHub APIで手動チェック
      try {
        const latestRelease = await checkLatestReleaseManually();
        const currentVersion = app.getVersion();
        
        if (latestRelease) {
          const versionComparison = compareVersions(currentVersion, latestRelease.version);
          
          if (versionComparison < 0) {
            // 現在のバージョンが古い - アップデート利用可能
            console.log('Background check: Update available', latestRelease.version);
            
            // メインウィンドウにアップデート利用可能を通知（バックグラウンドチェックフラグ付き）
            if (mainWindow) {
              mainWindow.webContents.send('update-available', {
                version: latestRelease.version,
                releaseNotes: latestRelease.releaseNotes || 'リリースノートを確認してください。',
                downloadUrl: latestRelease.downloadUrl,
                currentVersion: currentVersion,
                isBackgroundCheck: true // バックグラウンドチェックであることを示すフラグ
              });
            }
          } else {
            console.log('Background check: Already up to date');
          }
        }
      } catch (fallbackError) {
        console.error('Background manual check also failed:', fallbackError);
      }
    }
  } catch (error) {
    console.error('Background update check failed:', error);
  }
}

// 内蔵サーバーを停止
async function stopEmbeddedServer() {
  try {
    console.log('Stopping embedded server...');
    await embeddedServer.stop();
    console.log('Embedded server stopped successfully');
  } catch (error) {
    console.error('Error stopping embedded server:', error);
    
    // 強制的にサーバーを停止する試行
    try {
      const serverInstance = embeddedServer.server;
      if (serverInstance) {
        console.log('Force closing server instance...');
        serverInstance.close(() => {
          console.log('Server force closed');
        });
        
        // 接続中のソケットも強制終了
        if (serverInstance.listening) {
          serverInstance.closeAllConnections?.();
        }
      }
    } catch (forceError) {
      console.error('Error during force server stop:', forceError);
    }
  }
// グローバルショートカット登録
app.whenReady().then(() => {
  globalShortcut.register('F1', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-fetch-race-results');
    }
  });
  globalShortcut.register('F2', () => {
    if (mainWindow) {
      mainWindow.webContents.send('trigger-fetch-overall-scores');
    }
  });
});
}

app.whenReady().then(async () => {
  try {
    console.log('App ready, initializing...');
    
    // 設定を初期化してロード
    console.log('Loading configuration...');
    const loadedConfig = await configManager.loadConfig();
    console.log('Configuration loaded:', loadedConfig);
    
    console.log('Starting embedded server...');
    await startEmbeddedServer();
    console.log('Server started successfully on port:', serverPort);
    
    // OBSブラウザソースの自動再読み込み
    setTimeout(async () => {
      try {
        console.log('Attempting to refresh OBS browser sources...');
        const refreshResponse = await makeHttpRequest(`http://localhost:${serverPort}/api/obs/refresh-browser-source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (refreshResponse.success) {
          console.log('OBS browser sources refreshed successfully:', refreshResponse.message);
        } else {
          console.warn('OBS browser source refresh failed:', refreshResponse.error);
        }
      } catch (error) {
        console.warn('Could not refresh OBS browser sources (OBS may not be running):', error.message);
      }
    }, 2000); // サーバー起動後2秒待って実行
    
    // サーバー起動を待ってからウィンドウを作成
    setTimeout(() => {
      createWindow();
      
      // ウィンドウ作成後、バックグラウンドでアップデートチェックを開始
      setTimeout(() => {
        startBackgroundUpdateCheck();
      }, 3000); // ウィンドウが完全に読み込まれた後に実行
    }, 1500);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    createWindow(); // 初期化に失敗してもウィンドウは作成
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// アプリケーション終了フラグ
let isQuitting = false;

app.on('window-all-closed', async () => {
  if (isQuitting) return;
  isQuitting = true;
  
  console.log('All windows closed, cleaning up...');
  await performCleanup();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (isQuitting) return;
  
  console.log('Before quit event received, performing cleanup...');
  event.preventDefault(); // 一時的に終了を防ぐ
  isQuitting = true;
  
  await performCleanup();
  
  // クリーンアップ完了後に再度終了を試行
  setTimeout(() => {
    app.exit(0);
  }, 1000);
});

// 統一されたクリーンアップ処理
async function performCleanup() {
  console.log('Starting application cleanup...');
  
  try {
    // 内蔵サーバーを停止
    await stopEmbeddedServer();
    console.log('Embedded server cleanup completed');
  } catch (serverError) {
    console.error('Error during server cleanup:', serverError);
  }

  try {
    // 全てのウィンドウを強制的に閉じる
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });
    console.log('All windows destroyed');
  } catch (windowError) {
    console.error('Error during window cleanup:', windowError);
  }

  // OBSプロセスは独立して動作させるため、強制終了は行わない
  console.log('OBS application will remain running independently');

  console.log('Application cleanup completed');
}

// プロセス終了時の確実なクリーンアップ
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, performing cleanup...');
  if (!isQuitting) {
    isQuitting = true;
    await performCleanup();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, performing cleanup...');
  if (!isQuitting) {
    isQuitting = true;
    await performCleanup();
  }
  process.exit(0);
});

// Windows固有の終了処理
if (process.platform === 'win32') {
  process.on('message', (data) => {
    if (data === 'graceful-exit') {
      console.log('Received graceful exit message');
      if (!isQuitting) {
        isQuitting = true;
        performCleanup().then(() => {
          process.exit(0);
        });
      }
    }
  });
}

// IPC handlers
ipcMain.handle('get-config', async () => {
  try {
    console.log('IPC: get-config called, serverPort:', serverPort);
    
    // まずConfigManagerから直接読み込みを試行
    try {
      const config = await configManager.loadConfig();
      console.log('IPC: get-config from ConfigManager:', config);
      return config;
    } catch (configManagerError) {
      console.error('ConfigManager error:', configManagerError);
    }
    
    // サーバーAPIからの読み込みを試行
    if (serverPort) {
      try {
        const result = await makeHttpRequest(`http://localhost:${serverPort}/api/config`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('IPC: get-config from server API:', result);
        return result;
      } catch (serverError) {
        console.error('Server API error:', serverError);
      }
    }
    
    // フォールバック：ディレクトから読み取り
    try {
      const fs = require('fs');
      const path = require('path');
      const { app } = require('electron');
      const userDataPath = app ? app.getPath('userData') : __dirname;
      const configPath = path.join(userDataPath, 'config.json');
      
      console.log('IPC: fallback config path:', configPath);
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        console.log('IPC: fallback config loaded:', config);
        return config;
      } else {
        console.log('IPC: no config file found at:', configPath);
      }
    } catch (fallbackError) {
      console.error('フォールバック設定読み込みエラー:', fallbackError);
    }
    
    // 最終的なデフォルト設定
    const defaultConfig = {
      obsIp: '127.0.0.1',
      obsPort: '4455',
      obsPassword: '',
      obsSourceName: '映像キャプチャデバイス',
      geminiApiKey: '',
      theme: 'light'
    };
    console.log('IPC: returning default config:', defaultConfig);
    return defaultConfig;
  } catch (error) {
    console.error('設定取得エラー:', error);
    return {
      obsIp: '127.0.0.1',
      obsPort: '4455',
      obsPassword: '',
      obsSourceName: '映像キャプチャデバイス',
      geminiApiKey: '',
      theme: 'light'
    };
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    console.log('IPC: save-config called');
    console.log('IPC: config to save:', config);
    
    // 設定の検証
    if (!config.obsIp || !config.obsPort || !config.obsSourceName || !config.geminiApiKey) {
      return {
        success: false,
        error: 'OBS IPアドレス、ポート、ソース名、Gemini APIキーは必須です'
      };
    }
    
    // まずConfigManagerで保存
    try {
      const saveResult = await configManager.saveConfig(config);
      if (saveResult) {
        console.log('IPC: ConfigManager save successful');
        
        // electron-storeにも保存（後方互換性）
        try {
          store.set('obsIp', config.obsIp);
          store.set('obsPort', config.obsPort);
          store.set('obsPassword', config.obsPassword);
          store.set('obsSourceName', config.obsSourceName);
          store.set('geminiApiKey', config.geminiApiKey);
          console.log('IPC: electron-store backup save completed');
        } catch (storeError) {
          console.warn('electron-store save failed:', storeError);
        }
        
        // サーバーAPIでも保存を試行
        if (serverPort) {
          try {
            const result = await makeHttpRequest(`http://localhost:${serverPort}/api/config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config)
            });
            console.log('IPC: server API save result:', result);
          } catch (serverError) {
            console.warn('Server API save failed:', serverError);
          }
        }
        
        return { success: true };
      } else {
        throw new Error('ConfigManager save failed');
      }
    } catch (configManagerError) {
      console.error('ConfigManager save error:', configManagerError);
      
      // フォールバック：直接ファイルに保存
      try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, 'config.json');
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('IPC: fallback config save completed');
        
        return { success: true };
      } catch (fallbackError) {
        console.error('フォールバック設定保存エラー:', fallbackError);
        return { success: false, error: fallbackError.message };
      }
    }
  } catch (error) {
    console.error('設定保存エラー:', error);
    return { success: false, error: error.message };
  }
});

// サーバーポート取得
ipcMain.handle('get-server-port', () => {
  console.log('IPC: get-server-port called, returning:', serverPort);
  return serverPort;
});

ipcMain.handle('fetch-race-results', async () => {
  console.log('IPC: fetch-race-results called');
  try {
    // 内蔵サーバーのAPIを呼び出し（IPv4で接続）
    const obsData = await makeHttpRequest(`http://127.0.0.1:${serverPort}/api/obs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!obsData.success) {
      throw new Error(obsData.error || 'OBSエラー');
    }
    lastScreenshot = obsData.screenshot; // スクリーンショットを保存
    
    // レース結果分析を実行（IPv4で接続）
    const result = await makeHttpRequest(`http://127.0.0.1:${serverPort}/api/fetch-race-results?useTotalScore=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: obsData.screenshot
      })
    });
    
    // 結果をスコアとして保存（レース結果）
    if (result.success && result.response && result.response.results) {
      const teamScores = await processRaceResults(result.response.results, false);
      await saveScores(teamScores, false); // 通常のレース結果
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fetch-overall-scores', async () => {
  console.log('IPC: fetch-overall-scores called');
  try {
    // 内蔵サーバーのAPIを呼び出し（IPv4で接続）
    const obsData = await makeHttpRequest(`http://127.0.0.1:${serverPort}/api/obs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!obsData.success) {
      throw new Error(obsData.error || 'OBSエラー');
    }
    lastScreenshot = obsData.screenshot; // スクリーンショットを保存
    
    // 総合スコア分析を実行（IPv4で接続）
    const result = await makeHttpRequest(`http://127.0.0.1:${serverPort}/api/fetch-race-results?useTotalScore=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: obsData.screenshot
      })
    });
    
    // 結果をスコアとして保存（合計点計測）
    if (result.success && result.response && result.response.results) {
      const teamScores = await processRaceResults(result.response.results, true);
      await saveScores(teamScores, true); // 合計点計測のフラグを設定
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-last-screenshot', () => {
  return lastScreenshot;
});

ipcMain.handle('open-overlay', async () => {
  try {
    if (!serverPort) {
      throw new Error('内蔵サーバーが起動していません');
    }
    await shell.openExternal(`http://localhost:${serverPort}/static/?overlay=true`);
    return { success: true };
  } catch (error) {
    console.error('Failed to open overlay:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-edit-window', () => {
  createEditWindow();
  return { success: true };
});

ipcMain.handle('open-reopen-manager', () => {
  createReopenManagerWindow();
  return { success: true };
});

ipcMain.handle('get-scores', async () => {
  try {
    const response = await makeHttpRequest(`http://localhost:${serverPort}/api/scores`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return { success: true, scores: response.scores || [] };
  } catch (error) {
    console.error('Failed to get scores:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-scores', async (event, scores, isOverallUpdate = false) => {
  try {
    const response = await saveScores(scores, isOverallUpdate);
    return response;
  } catch (error) {
    console.error('Failed to save scores via IPC:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-message', (event, type, title, message) => {
  dialog.showMessageBox(mainWindow, {
    type: type,
    title: title,
    message: message
  });
});

// アップデート関連のIPCハンドラー
ipcMain.handle('check-for-updates', async () => {
  try {
    // まず通常のアップデートチェックを試行
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (error) {
    console.error('自動アップデートチェックエラー:', error);
    
    // フォールバック: GitHub APIで手動チェック
    try {
      const latestRelease = await checkLatestReleaseManually();
      const currentVersion = app.getVersion();
      
      if (latestRelease) {
        const versionComparison = compareVersions(currentVersion, latestRelease.version);
        
        if (versionComparison < 0) {
          // 現在のバージョンが古い - アップデート利用可能
          return {
            success: true,
            manualUpdate: true,
            latestRelease: latestRelease,
            currentVersion: currentVersion
          };
        } else if (versionComparison > 0) {
          // 現在のバージョンが新しい
          // パッケージ版の場合は最新版として扱う（GitHub未リリースの正式版）
          const isPackaged = app.isPackaged;
          
          if (isPackaged) {
            // パッケージ版では最新版として表示
            return {
              success: true,
              upToDate: true,
              isNewerRelease: true, // GitHubより新しいリリース版
              currentVersion: currentVersion,
              latestVersion: latestRelease.version
            };
          } else {
            // 開発環境では開発版として表示
            return {
              success: true,
              upToDate: true,
              newerVersion: true,
              currentVersion: currentVersion,
              latestVersion: latestRelease.version
            };
          }
        } else {
          // バージョンが同じ - 最新版
          return {
            success: true,
            upToDate: true,
            currentVersion: currentVersion,
            latestVersion: latestRelease.version
          };
        }
      } else {
        return {
          success: true,
          upToDate: true,
          currentVersion: currentVersion
        };
      }
    } catch (fallbackError) {
      console.error('手動アップデートチェックもエラー:', fallbackError);
      return { success: false, error: `アップデートチェックに失敗しました: ${error.message}` };
    }
  }
});

// バージョン比較関数
function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  // 配列の長さを合わせる（例: 1.2 と 1.2.0）
  const maxLength = Math.max(v1parts.length, v2parts.length);
  while (v1parts.length < maxLength) v1parts.push(0);
  while (v2parts.length < maxLength) v2parts.push(0);
  
  for (let i = 0; i < maxLength; i++) {
    if (v1parts[i] < v2parts[i]) return -1; // version1 が古い
    if (v1parts[i] > v2parts[i]) return 1;  // version1 が新しい
  }
  return 0; // 同じバージョン
}

// GitHub APIで最新リリースをチェック（カスタム自動アップデート対応）
async function checkLatestReleaseManually() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/eito54/Gemisoku-GUI/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Gemisoku-GUI-Updater'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const release = JSON.parse(data);
            
            // プラットフォーム別のインストーラーを特定
            const platform = process.platform;
            let installerAsset = null;
            
            for (const asset of release.assets) {
              if (platform === 'win32' && asset.name.endsWith('.exe')) {
                installerAsset = asset;
                break;
              } else if (platform === 'darwin' && asset.name.endsWith('.dmg')) {
                installerAsset = asset;
                break;
              } else if (platform === 'linux' && asset.name.endsWith('.AppImage')) {
                installerAsset = asset;
                break;
              }
            }
            
            resolve({
              version: release.tag_name.replace(/^v/, ''),
              releaseNotes: release.body || '',
              downloadUrl: release.html_url,
              assets: release.assets,
              installerAsset: installerAsset,
              canAutoUpdate: !!installerAsset
            });
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode}`));
          }
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-download-page', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('ダウンロードページを開くエラー:', error);
    return { success: false, error: error.message };
  }
});

// カスタム自動ダウンロード機能（リダイレクト対応）
ipcMain.handle('download-update-custom', async (event, asset) => {
  try {
    const fs = require('fs');
    const os = require('os');
    const url = require('url');
    
    // 一時ディレクトリにダウンロード
    const tempDir = os.tmpdir();
    const fileName = asset.name;
    const filePath = path.join(tempDir, fileName);
    
    console.log(`ダウンロード開始: ${asset.browser_download_url} -> ${filePath}`);
    
    // ダウンロード進行状況を送信
    const downloadProgress = { percent: 0, transferred: 0, total: asset.size };
    mainWindow.webContents.send('download-progress-custom', downloadProgress);
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      let lastPercent = -1; // 進行状況の重複送信を避けるため
      
      // リダイレクトに対応したダウンロード関数
      const downloadFile = (downloadUrl, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('リダイレクト回数が上限を超えました'));
          return;
        }
        
        const parsedUrl = url.parse(downloadUrl);
        const httpModule = parsedUrl.protocol === 'https:' ? https : http;
        
        const request = httpModule.get(downloadUrl, {
          headers: {
            'User-Agent': 'Gemisoku-GUI-Updater',
            'Accept': 'application/octet-stream'
          }
        }, (response) => {
          console.log(`HTTP Status: ${response.statusCode}, URL: ${downloadUrl}`);
          
          // リダイレクトの処理
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              console.log(`リダイレクト: ${redirectUrl}`);
              response.destroy();
              downloadFile(redirectUrl, redirectCount + 1);
              return;
            } else {
              reject(new Error(`リダイレクトURLが見つかりません: ${response.statusCode}`));
              return;
            }
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`ダウンロードエラー: ${response.statusCode}`));
            return;
          }
          
          const totalSize = parseInt(response.headers['content-length'] || asset.size || '0');
          let downloadedSize = 0;
          
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const percent = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
            
            // 進行状況を送信（1%以上変化した場合のみ、またはダウンロード完了時）
            const progress = {
              percent: Math.min(percent, 100),
              transferred: downloadedSize,
              total: totalSize
            };
            
            const percentInt = Math.floor(progress.percent);
            if (percentInt !== lastPercent || percentInt === 100) {
              console.log(`ダウンロード進行状況: ${percentInt}%`);
              mainWindow.webContents.send('download-progress-custom', progress);
              lastPercent = percentInt;
            }
          });
          
          response.pipe(file);
          
          file.on('finish', () => {
            file.close(() => {
              console.log('ダウンロード完了:', filePath);
              resolve({
                success: true,
                filePath: filePath,
                fileName: fileName
              });
            });
          });
          
          file.on('error', (error) => {
            fs.unlink(filePath, () => {}); // ファイルを削除
            reject(error);
          });
        });
        
        request.on('error', (error) => {
          reject(error);
        });
        
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('ダウンロードタイムアウト'));
        });
      };
      
      // ダウンロード開始
      downloadFile(asset.browser_download_url);
    });
    
  } catch (error) {
    console.error('カスタムダウンロードエラー:', error);
    return { success: false, error: error.message };
  }
});

// インストーラーを実行
ipcMain.handle('install-downloaded-update', async (event, filePath) => {
  try {
    const { exec } = require('child_process');
    const { spawn } = require('child_process');
    const platform = process.platform;
    
    console.log('インストーラー実行:', filePath);
    
    return new Promise((resolve, reject) => {
      let installer;
      
      if (platform === 'win32') {
        // Windows: .exeファイルを実行
        installer = spawn(filePath, [], {
          detached: true,
          stdio: 'ignore'
        });
      } else if (platform === 'darwin') {
        // macOS: .dmgファイルをマウントして開く
        installer = spawn('open', [filePath], {
          detached: true,
          stdio: 'ignore'
        });
      } else if (platform === 'linux') {
        // Linux: .AppImageファイルに実行権限を付与して実行
        exec(`chmod +x "${filePath}"`, (chmodError) => {
          if (chmodError) {
            console.error('chmod error:', chmodError);
            reject({ success: false, error: chmodError.message });
            return;
          }
          
          installer = spawn(filePath, [], {
            detached: true,
            stdio: 'ignore'
          });
          
          installer.unref();
          
          // インストーラーが起動したことを確認してからアプリを終了
          setTimeout(() => {
            console.log('Linux installer started, quitting app...');
            app.quit();
          }, 3000);
          
          resolve({ success: true });
        });
        return;
      } else {
        reject({ success: false, error: 'Unsupported platform' });
        return;
      }
      
      installer.unref();
      
      installer.on('error', (error) => {
        console.error('インストーラー起動エラー:', error);
        reject({ success: false, error: error.message });
      });
      
      // インストーラーが正常に起動したことを確認
      setTimeout(() => {
        console.log('Installer started successfully, quitting app...');
        resolve({ success: true });
        
        // 少し待ってからアプリを終了
        setTimeout(() => {
          app.quit();
        }, 1000);
      }, 2000);
    });
  } catch (error) {
    console.error('インストーラー実行エラー:', error);
    return { success: false, error: error.message };
  }
});

// レース結果を処理してチームスコアに変換
async function processRaceResults(results, isOverallScore) {
  try {
    // チーム名の正規化と統合を行う関数
    function normalizeAndMergeTeams(teamMap) {
      // 先頭文字でグループ化
      const firstCharGroups = {};
      
      Object.entries(teamMap).forEach(([teamName, teamData]) => {
        const firstChar = teamName.charAt(0).toUpperCase();
        if (!firstCharGroups[firstChar]) {
          firstCharGroups[firstChar] = [];
        }
        firstCharGroups[firstChar].push({ name: teamName, data: teamData });
      });
      
      const mergedTeamMap = {};
      
      Object.entries(firstCharGroups).forEach(([firstChar, teams]) => {
        if (teams.length === 1) {
          // 同じ先頭文字のチームが1つだけの場合はそのまま
          const team = teams[0];
          mergedTeamMap[team.name] = team.data;
        } else {
          // 複数のチームがある場合は統合
          console.log(`Merging teams with first character '${firstChar}':`, teams.map(t => t.name));
          
          // スコアが最も高いチームを見つける
          let mainTeam = teams[0];
          teams.forEach(team => {
            if (team.data.score > mainTeam.data.score) {
              mainTeam = team;
            }
          });
          
          // 全チームのスコアとプレイヤー情報を統合
          const mergedData = {
            team: mainTeam.name,
            score: 0,
            addedScore: 0,
            isCurrentPlayer: false
          };
          
          teams.forEach(team => {
            mergedData.score += team.data.score;
            mergedData.addedScore += team.data.addedScore || 0;
            mergedData.isCurrentPlayer = mergedData.isCurrentPlayer || team.data.isCurrentPlayer;
          });
          
          console.log(`Merged team '${mainTeam.name}' total score: ${mergedData.score}`);
          mergedTeamMap[mainTeam.name] = mergedData;
        }
      });
      
      return mergedTeamMap;
    }

    if (isOverallScore) {
      // 総合スコアの場合は、既存スコアを上書き
      const teamMap = {};
      results.forEach(item => {
        const team = item.team || "UNKNOWN";
        const score = parseInt(item.totalScore || item.score, 10) || 0;
        const isCurrentPlayer = item.isCurrentPlayer || false;
        
        if (!teamMap[team]) {
          teamMap[team] = {
            team: team,
            score: 0,
            addedScore: 0,
            isCurrentPlayer: false
          };
        }
        
        teamMap[team].score += score;
        teamMap[team].isCurrentPlayer = teamMap[team].isCurrentPlayer || isCurrentPlayer;
      });
      
      // チーム統合を実行
      const normalizedTeamMap = normalizeAndMergeTeams(teamMap);
      return Object.values(normalizedTeamMap);
    } else {
      // レース結果の場合は、既存スコアに加算
      let currentScores = [];
      try {
        const currentScoresResponse = await makeHttpRequest(`http://localhost:${serverPort}/api/scores`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        currentScores = currentScoresResponse.scores || [];
      } catch (error) {
        console.log('No existing scores found, starting fresh');
      }

      // 今回のレース結果を処理
      const raceResults = {};
      results.forEach(item => {
        const team = item.team || "UNKNOWN";
        const rank = parseInt(item.rank, 10) || 12;
        const isCurrentPlayer = item.isCurrentPlayer || false;
        
        // 順位に基づく点数計算
        const racePointSheet = [
          { rank: 1, point: 15 }, { rank: 2, point: 12 }, { rank: 3, point: 10 }, { rank: 4, point: 9 },
          { rank: 5, point: 8 }, { rank: 6, point: 7 }, { rank: 7, point: 6 }, { rank: 8, point: 5 },
          { rank: 9, point: 4 }, { rank: 10, point: 3 }, { rank: 11, point: 2 }, { rank: 12, point: 1 }
        ];
        
        const pointEntry = racePointSheet.find(p => p.rank === rank);
        const raceScore = pointEntry ? pointEntry.point : 0;
        
        if (!raceResults[team]) {
          raceResults[team] = {
            score: 0,
            isCurrentPlayer: false
          };
        }
        
        raceResults[team].score += raceScore;
        raceResults[team].isCurrentPlayer = raceResults[team].isCurrentPlayer || isCurrentPlayer;
      });

      // 既存スコアと今回のレース結果を合算
      const teamMap = {};
      
      // 既存のチームスコアを復元
      currentScores.forEach(existingTeam => {
        teamMap[existingTeam.team] = {
          team: existingTeam.team,
          score: existingTeam.score,
          addedScore: 0,
          isCurrentPlayer: existingTeam.isCurrentPlayer
        };
      });

      // 今回のレース結果を加算
      Object.entries(raceResults).forEach(([team, raceData]) => {
        if (!teamMap[team]) {
          teamMap[team] = {
            team: team,
            score: 0,
            addedScore: 0,
            isCurrentPlayer: false
          };
        }
        
        teamMap[team].score += raceData.score;
        teamMap[team].addedScore = raceData.score;
        teamMap[team].isCurrentPlayer = teamMap[team].isCurrentPlayer || raceData.isCurrentPlayer;
      });
      
      // チーム統合を実行
      const normalizedTeamMap = normalizeAndMergeTeams(teamMap);
      return Object.values(normalizedTeamMap);
    }
  } catch (error) {
    console.error('Error processing race results:', error);
    return [];
  }
}

// スコアをサーバーに保存（アニメーション制御フラグ対応）
async function saveScores(teamScores, isOverallUpdate = false) {
  try {
    const queryParam = isOverallUpdate ? '?isOverallUpdate=true' : '';
    const saveResponse = await makeHttpRequest(`http://localhost:${serverPort}/api/scores${queryParam}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(teamScores)
    });
    
    console.log('Scores saved successfully with metadata:', { isOverallUpdate, response: saveResponse });
    return saveResponse;
  } catch (error) {
    console.error('Failed to save scores:', error);
    return { success: false, error: error.message };
  }
}

// HTTPリクエストのヘルパー関数
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}