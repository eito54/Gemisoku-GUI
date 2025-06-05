const { BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const ConfigManager = require('../config/ConfigManager');
const EmbeddedServer = require('../server/EmbeddedServer');
const WindowManager = require('./WindowManager');
const UpdateManager = require('./UpdateManager');
const ApiManager = require('./ApiManager');
const Logger = require('../utils/Logger');

/**
 * アプリケーション全体を管理するメインクラス
 */
class AppManager {
  constructor() {
    this.logger = new Logger('AppManager');
    this.store = new Store();
    this.configManager = new ConfigManager();
    this.embeddedServer = new EmbeddedServer();
    this.windowManager = new WindowManager();
    this.updateManager = new UpdateManager();
    this.apiManager = new ApiManager();
    
    this.serverPort = 3001;
    this.isInitialized = false;
  }

  /**
   * アプリケーションを初期化
   */
  async initialize() {
    try {
      this.logger.info('Initializing AppManager...');

      // 各マネージャーの初期化
      await this.configManager.initialize();
      await this.embeddedServer.initialize();
      this.updateManager.initialize();
      this.setupIpcHandlers();

      // メインウィンドウを作成
      await this.createMainWindow();
      
      // サーバーを開始
      await this.startEmbeddedServer();

      this.isInitialized = true;
      this.logger.info('AppManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AppManager:', error);
      throw error;
    }
  }

  /**
   * メインウィンドウを作成
   */
  async createMainWindow() {
    try {
      await this.windowManager.createMainWindow();
      this.logger.info('Main window created');
    } catch (error) {
      this.logger.error('Failed to create main window:', error);
      throw error;
    }
  }

  /**
   * 編集ウィンドウを作成
   */
  async createEditWindow() {
    try {
      await this.windowManager.createEditWindow();
      this.logger.info('Edit window created');
    } catch (error) {
      this.logger.error('Failed to create edit window:', error);
      throw error;
    }
  }

  /**
   * メインウィンドウにフォーカス
   */
  focusMainWindow() {
    this.windowManager.focusMainWindow();
  }

  /**
   * 内蔵サーバーを開始
   */
  async startEmbeddedServer() {
    try {
      await this.embeddedServer.start(this.serverPort);
      this.logger.info(`Embedded server started on port ${this.serverPort}`);
    } catch (error) {
      this.logger.error('Failed to start embedded server:', error);
      throw error;
    }
  }

  /**
   * 内蔵サーバーを停止
   */
  async stopEmbeddedServer() {
    try {
      await this.embeddedServer.stop();
      this.logger.info('Embedded server stopped');
    } catch (error) {
      this.logger.error('Failed to stop embedded server:', error);
    }
  }

  /**
   * IPCハンドラーを設定
   */
  setupIpcHandlers() {
    // 設定関連
    ipcMain.handle('get-config', async () => {
      return await this.configManager.loadConfig();
    });

    ipcMain.handle('save-config', async (event, config) => {
      return await this.configManager.saveConfig(config);
    });

    ipcMain.handle('test-gemini-api', async (event, apiKey) => {
      return await this.configManager.testGeminiApiKey(apiKey);
    });

    // サーバー関連
    ipcMain.handle('get-server-port', () => {
      return this.serverPort;
    });

    // ウィンドウ関連
    ipcMain.handle('open-edit-window', async () => {
      await this.createEditWindow();
    });

    ipcMain.handle('close-edit-window', () => {
      this.windowManager.closeEditWindow();
    });

    // API関連
    ipcMain.handle('fetch-race-results', async (event, useTotalScore) => {
      return await this.apiManager.fetchRaceResults(useTotalScore);
    });

    ipcMain.handle('reset-scores', async () => {
      return await this.apiManager.resetScores();
    });

    // アップデート関連
    ipcMain.handle('check-for-updates', async () => {
      return await this.updateManager.checkForUpdates();
    });

    ipcMain.handle('download-update', async () => {
      return await this.updateManager.downloadUpdate();
    });

    ipcMain.handle('install-update', async () => {
      return await this.updateManager.installUpdate();
    });

    // ユーティリティ
    ipcMain.handle('open-external-url', async (event, url) => {
      shell.openExternal(url);
    });

    ipcMain.handle('show-message-box', async (event, options) => {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        return await dialog.showMessageBox(mainWindow, options);
      }
    });

    this.logger.info('IPC handlers setup completed');
  }

  /**
   * アプリケーションのクリーンアップ
   */
  cleanup() {
    try {
      this.logger.info('Cleaning up AppManager...');
      
      if (this.embeddedServer) {
        this.embeddedServer.stop();
      }
      
      if (this.windowManager) {
        this.windowManager.cleanup();
      }
      
      this.logger.info('AppManager cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = AppManager;