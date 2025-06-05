const { autoUpdater } = require('electron-updater');
const { dialog, shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Logger = require('../utils/Logger');

/**
 * アプリケーションのアップデートを管理するクラス
 */
class UpdateManager {
  constructor() {
    this.logger = new Logger('UpdateManager');
    this.isInitialized = false;
    this.windowManager = null;
    this.downloadProgress = null;
  }

  /**
   * 初期化
   */
  initialize(windowManager = null) {
    try {
      this.windowManager = windowManager;

      // 開発環境では自動アップデートを無効化
      if (process.env.NODE_ENV === 'development') {
        autoUpdater.updateConfigPath = null;
        autoUpdater.checkForUpdatesAndNotify = () => Promise.resolve();
        this.logger.info('Auto-updater disabled in development mode');
        this.isInitialized = true;
        return;
      }

      // autoUpdaterの設定
      autoUpdater.logger = {
        info: (message) => this.logger.info(`AutoUpdater: ${message}`),
        warn: (message) => this.logger.warn(`AutoUpdater: ${message}`),
        error: (message) => this.logger.error(`AutoUpdater: ${message}`),
        debug: (message) => this.logger.debug(`AutoUpdater: ${message}`)
      };

      this.setupEventListeners();
      
      // 自動チェックを開始
      autoUpdater.checkForUpdatesAndNotify();
      
      this.isInitialized = true;
      this.logger.info('UpdateManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize UpdateManager:', error);
      throw error;
    }
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.logger.info('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      this.logger.info(`Update available: ${info.version}`);
      this.notifyUpdateAvailable(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.logger.info('No updates available');
    });

    autoUpdater.on('error', (error) => {
      this.logger.error('Update error:', error);
      this.notifyUpdateError(error);
    });

    autoUpdater.on('download-progress', (progress) => {
      this.downloadProgress = progress;
      this.logger.debug(`Download progress: ${progress.percent}%`);
      this.notifyDownloadProgress(progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info(`Update downloaded: ${info.version}`);
      this.notifyUpdateReady(info);
    });
  }

  /**
   * アップデートの確認（手動）
   */
  async checkForUpdates() {
    try {
      this.logger.info('Manually checking for updates...');
      
      if (process.env.NODE_ENV === 'development') {
        return await this.checkLatestReleaseManually();
      }

      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        return {
          success: true,
          hasUpdate: result.updateInfo.version !== require('../../../package.json').version,
          updateInfo: result.updateInfo
        };
      } else {
        return {
          success: true,
          hasUpdate: false,
          message: 'No updates available'
        };
      }
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
      return {
        success: false,
        message: `Failed to check for updates: ${error.message}`
      };
    }
  }

  /**
   * GitHub APIで最新リリースを手動確認
   */
  async checkLatestReleaseManually() {
    try {
      const currentVersion = require('../../../package.json').version;
      
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/repos/eito54/Gemisoku-GUI/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'Gemisoku-GUI-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const response = await this.makeHttpsRequest(options);
      const release = JSON.parse(response);

      if (release && release.tag_name) {
        const latestVersion = release.tag_name.replace(/^v/, '');
        const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

        this.logger.info(`Current: ${currentVersion}, Latest: ${latestVersion}, Has update: ${hasUpdate}`);

        return {
          success: true,
          hasUpdate,
          updateInfo: {
            version: latestVersion,
            releaseNotes: release.body,
            releaseDate: release.published_at,
            downloadUrl: this.getDownloadUrl(release)
          }
        };
      } else {
        throw new Error('Invalid release information');
      }
    } catch (error) {
      this.logger.error('Failed to check latest release manually:', error);
      return {
        success: false,
        message: `Failed to check for updates: ${error.message}`
      };
    }
  }

  /**
   * ダウンロードURLを取得
   */
  getDownloadUrl(release) {
    if (!release.assets || !Array.isArray(release.assets)) {
      return null;
    }

    const platform = process.platform;
    let assetName;

    switch (platform) {
      case 'win32':
        assetName = release.assets.find(asset => 
          asset.name.endsWith('.exe') || asset.name.includes('win')
        );
        break;
      case 'darwin':
        assetName = release.assets.find(asset => 
          asset.name.endsWith('.dmg') || asset.name.includes('mac')
        );
        break;
      case 'linux':
        assetName = release.assets.find(asset => 
          asset.name.endsWith('.AppImage') || asset.name.includes('linux')
        );
        break;
    }

    return assetName ? assetName.browser_download_url : null;
  }

  /**
   * バージョン比較
   */
  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  /**
   * アップデートのダウンロード
   */
  async downloadUpdate() {
    try {
      this.logger.info('Starting update download...');
      
      if (process.env.NODE_ENV === 'development') {
        return {
          success: false,
          message: 'Manual download required in development mode'
        };
      }

      await autoUpdater.downloadUpdate();
      
      return {
        success: true,
        message: 'Update download started'
      };
    } catch (error) {
      this.logger.error('Failed to download update:', error);
      return {
        success: false,
        message: `Failed to download update: ${error.message}`
      };
    }
  }

  /**
   * アップデートのインストール
   */
  async installUpdate() {
    try {
      this.logger.info('Installing update...');
      
      if (process.env.NODE_ENV === 'development') {
        return {
          success: false,
          message: 'Manual installation required in development mode'
        };
      }

      autoUpdater.quitAndInstall();
      
      return {
        success: true,
        message: 'Update installation started'
      };
    } catch (error) {
      this.logger.error('Failed to install update:', error);
      return {
        success: false,
        message: `Failed to install update: ${error.message}`
      };
    }
  }

  /**
   * アップデート利用可能通知
   */
  notifyUpdateAvailable(info) {
    if (this.windowManager) {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
      }
    }
  }

  /**
   * ダウンロード進捗通知
   */
  notifyDownloadProgress(progress) {
    if (this.windowManager) {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', progress);
      }
    }
  }

  /**
   * アップデート準備完了通知
   */
  notifyUpdateReady(info) {
    if (this.windowManager) {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('update-ready', info);
      }
    }
  }

  /**
   * アップデートエラー通知
   */
  notifyUpdateError(error) {
    if (this.windowManager) {
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('update-error', {
          message: error.message
        });
      }
    }
  }

  /**
   * HTTPSリクエストを実行
   */
  makeHttpsRequest(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * 現在のダウンロード進捗を取得
   */
  getDownloadProgress() {
    return this.downloadProgress;
  }
}

module.exports = UpdateManager;