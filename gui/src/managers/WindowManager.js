const { BrowserWindow } = require('electron');
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * ウィンドウの作成と管理を担当するクラス
 */
class WindowManager {
  constructor() {
    this.logger = new Logger('WindowManager');
    this.mainWindow = null;
    this.editWindow = null;
  }

  /**
   * メインウィンドウを作成
   */
  async createMainWindow() {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.focus();
        return this.mainWindow;
      }

      this.mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '..', 'preload.js')
        },
        icon: path.join(__dirname, '..', '..', '..', 'assets', 'logo.jpeg'),
        show: false
      });

      // ウィンドウが準備完了後に表示
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow.show();
        this.logger.info('Main window displayed');
      });

      // ウィンドウが閉じられた時のイベント
      this.mainWindow.on('closed', () => {
        this.mainWindow = null;
        this.logger.info('Main window closed');
      });

      // HTMLファイルを読み込み
      const htmlPath = path.join(__dirname, '..', '..', 'views', 'index.html');
      await this.mainWindow.loadFile(htmlPath);

      this.logger.info('Main window created successfully');
      return this.mainWindow;
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
      if (this.editWindow && !this.editWindow.isDestroyed()) {
        this.editWindow.focus();
        return this.editWindow;
      }

      this.editWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        parent: this.mainWindow,
        modal: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '..', 'preload.js')
        },
        icon: path.join(__dirname, '..', '..', '..', 'assets', 'logo.jpeg'),
        show: false
      });

      // ウィンドウが準備完了後に表示
      this.editWindow.once('ready-to-show', () => {
        this.editWindow.show();
        this.logger.info('Edit window displayed');
      });

      // ウィンドウが閉じられた時のイベント
      this.editWindow.on('closed', () => {
        this.editWindow = null;
        this.logger.info('Edit window closed');
      });

      // HTMLファイルを読み込み
      const htmlPath = path.join(__dirname, '..', '..', 'views', 'edit-window.html');
      await this.editWindow.loadFile(htmlPath);

      this.logger.info('Edit window created successfully');
      return this.editWindow;
    } catch (error) {
      this.logger.error('Failed to create edit window:', error);
      throw error;
    }
  }

  /**
   * メインウィンドウにフォーカス
   */
  focusMainWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.focus();
      this.logger.info('Main window focused');
    }
  }

  /**
   * 編集ウィンドウを閉じる
   */
  closeEditWindow() {
    if (this.editWindow && !this.editWindow.isDestroyed()) {
      this.editWindow.close();
      this.logger.info('Edit window closed');
    }
  }

  /**
   * メインウィンドウのインスタンスを取得
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * 編集ウィンドウのインスタンスを取得
   */
  getEditWindow() {
    return this.editWindow;
  }

  /**
   * 全てのウィンドウが存在するかチェック
   */
  hasActiveWindows() {
    return (this.mainWindow && !this.mainWindow.isDestroyed()) || 
           (this.editWindow && !this.editWindow.isDestroyed());
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    try {
      this.logger.info('Cleaning up WindowManager...');
      
      if (this.editWindow && !this.editWindow.isDestroyed()) {
        this.editWindow.close();
      }
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.close();
      }
      
      this.logger.info('WindowManager cleanup completed');
    } catch (error) {
      this.logger.error('Error during WindowManager cleanup:', error);
    }
  }
}

module.exports = WindowManager;