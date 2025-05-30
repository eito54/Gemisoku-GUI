console.log('Loading Electron...');
const electron = require('electron');
console.log('Electron module:', Object.keys(electron));
const { app, BrowserWindow, ipcMain, dialog, shell } = electron;
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
const path = require('path');
const Store = require('electron-store');
const https = require('https');
const http = require('http');
const ConfigManager = require('./config-manager');
const EmbeddedServer = require('./server');

// 設定ストア（後方互換性のため保持）
const store = new Store();
// 新しい設定管理システム
const configManager = new ConfigManager();
// 内蔵サーバー
const embeddedServer = new EmbeddedServer();

let mainWindow;
let editWindow;
let serverPort = 3001;

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

// 内蔵サーバーを起動
async function startEmbeddedServer() {
  try {
    serverPort = await embeddedServer.start();
    console.log(`Embedded server started on port ${serverPort}`);
  } catch (error) {
    console.error('Failed to start embedded server:', error);
  }
}

// 内蔵サーバーを停止
async function stopEmbeddedServer() {
  try {
    await embeddedServer.stop();
    console.log('Embedded server stopped');
  } catch (error) {
    console.error('Error stopping embedded server:', error);
  }
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
    
    // サーバー起動を待ってからウィンドウを作成
    setTimeout(() => {
      createWindow();
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

app.on('window-all-closed', async () => {
  await stopEmbeddedServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopEmbeddedServer();
});

// プロセス終了時の確実なクリーンアップ
process.on('exit', async () => {
  await stopEmbeddedServer();
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, stopping embedded server...');
  await stopEmbeddedServer();
  app.quit();
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, stopping embedded server...');
  await stopEmbeddedServer();
  app.quit();
});

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

// レース結果を処理してチームスコアに変換
async function processRaceResults(results, isOverallScore) {
  try {
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
      
      return Object.values(teamMap);
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
      
      return Object.values(teamMap);
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
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
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