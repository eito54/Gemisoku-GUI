const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 設定関連
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // レース結果取得
  fetchRaceResults: () => ipcRenderer.invoke('fetch-race-results'),
  fetchOverallScores: () => ipcRenderer.invoke('fetch-overall-scores'),
  
  // オーバーレイ表示
  openOverlay: () => ipcRenderer.invoke('open-overlay'),
  
  // 外部URL開く
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 編集ウィンドウを開く
  openEditWindow: () => ipcRenderer.invoke('open-edit-window'),
  
  // スコア取得・保存
  getScores: () => ipcRenderer.invoke('get-scores'),
  saveScores: (scores) => ipcRenderer.invoke('save-scores', scores),
  
  // サーバーポート取得
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  
  // メッセージ表示
  showMessage: (type, title, message) => ipcRenderer.invoke('show-message', type, title, message),
  
  // アップデート関連API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openDownloadPage: (url) => ipcRenderer.invoke('open-download-page', url),
  downloadUpdateCustom: (asset) => ipcRenderer.invoke('download-update-custom', asset),
  installDownloadedUpdate: (filePath) => ipcRenderer.invoke('install-downloaded-update', filePath),
  
  // アップデートイベントリスナー
// グローバルショートカットイベント受信
  on: (channel, callback) => ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
  // グローバルショートカットからIPC呼び出し
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onDownloadProgressCustom: (callback) => ipcRenderer.on('download-progress-custom', callback),
  removeAllUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('download-progress-custom');
  }
});