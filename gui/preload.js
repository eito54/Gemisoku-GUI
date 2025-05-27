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
  
  // サーバーポート取得
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  
  // メッセージ表示
  showMessage: (type, title, message) => ipcRenderer.invoke('show-message', type, title, message)
});