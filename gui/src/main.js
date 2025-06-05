console.log('Loading Electron...');
const { app, BrowserWindow } = require('electron');
const path = require('path');

// アプリケーション管理クラス
const AppManager = require('./managers/AppManager');

let appManager;

// シングルインスタンス化
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (appManager) {
      appManager.focusMainWindow();
    }
  });

  // アプリ準備完了時
  app.whenReady().then(async () => {
    console.log('Electron app ready');
    
    try {
      appManager = new AppManager();
      await appManager.initialize();
      
      console.log('AppManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AppManager:', error);
      app.quit();
    }
  });

  // 全ウィンドウが閉じられた時
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (appManager) {
        appManager.cleanup();
      }
      app.quit();
    }
  });

  // アプリがアクティブになった時
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (appManager) {
        await appManager.createMainWindow();
      }
    }
  });

  // アプリ終了前
  app.on('before-quit', () => {
    if (appManager) {
      appManager.cleanup();
    }
  });
}