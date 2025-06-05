const { contextBridge, ipcRenderer } = require('electron');

/**
 * レンダラープロセス用のAPI（改良版）
 * セキュリティを向上させ、より構造化されたAPI提供
 */

// メインプロセスとの通信API
const electronAPI = {
  // 設定関連
  config: {
    get: () => ipcRenderer.invoke('get-config'),
    save: (config) => ipcRenderer.invoke('save-config', config),
    testGeminiApi: (apiKey) => ipcRenderer.invoke('test-gemini-api', apiKey)
  },

  // サーバー関連
  server: {
    getPort: () => ipcRenderer.invoke('get-server-port')
  },

  // ウィンドウ関連
  window: {
    openEditWindow: () => ipcRenderer.invoke('open-edit-window'),
    closeEditWindow: () => ipcRenderer.invoke('close-edit-window')
  },

  // API関連
  api: {
    fetchRaceResults: (useTotalScore) => ipcRenderer.invoke('fetch-race-results', useTotalScore),
    resetScores: () => ipcRenderer.invoke('reset-scores')
  },

  // アップデート関連
  update: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    
    // アップデートイベントリスナー
    onUpdateAvailable: (callback) => {
      ipcRenderer.on('update-available', (event, info) => callback(info));
    },
    onDownloadProgress: (callback) => {
      ipcRenderer.on('download-progress', (event, progress) => callback(progress));
    },
    onUpdateReady: (callback) => {
      ipcRenderer.on('update-ready', (event, info) => callback(info));
    },
    onUpdateError: (callback) => {
      ipcRenderer.on('update-error', (event, error) => callback(error));
    },
    
    // イベントリスナーを削除
    removeUpdateListeners: () => {
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('update-ready');
      ipcRenderer.removeAllListeners('update-error');
    }
  },

  // ユーティリティ
  util: {
    openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options)
  },

  // システム情報
  system: {
    getPlatform: () => process.platform,
    getVersion: () => process.versions.electron
  }
};

// 国際化API
const i18nAPI = {
  // 翻訳関連
  translate: (key, params = {}) => {
    // この関数はレンダラープロセス側で実装される
    if (typeof window !== 'undefined' && window.i18n) {
      return window.i18n.t(key, params);
    }
    return key;
  },

  // 言語設定
  setLanguage: (language) => {
    if (typeof window !== 'undefined' && window.i18n) {
      return window.i18n.setLanguage(language);
    }
  },

  // 利用可能な言語一覧
  getAvailableLanguages: () => {
    if (typeof window !== 'undefined' && window.i18n) {
      return window.i18n.getAvailableLanguages();
    }
    return ['ja', 'en'];
  }
};

// ログAPI
const logAPI = {
  debug: (message, ...args) => {
    console.debug(`[Renderer] ${message}`, ...args);
  },
  info: (message, ...args) => {
    console.info(`[Renderer] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[Renderer] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[Renderer] ${message}`, ...args);
  }
};

// ローカルストレージヘルパー
const storageAPI = {
  // ローカルストレージに保存
  setItem: (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      logAPI.error('Failed to save to localStorage:', error);
      return false;
    }
  },

  // ローカルストレージから取得
  getItem: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      logAPI.error('Failed to get from localStorage:', error);
      return defaultValue;
    }
  },

  // ローカルストレージから削除
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logAPI.error('Failed to remove from localStorage:', error);
      return false;
    }
  },

  // ローカルストレージをクリア
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      logAPI.error('Failed to clear localStorage:', error);
      return false;
    }
  }
};

// テーマAPI
const themeAPI = {
  // テーマを設定
  setTheme: (theme) => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      storageAPI.setItem('theme', theme);
      logAPI.info(`Theme changed to: ${theme}`);
      return true;
    } catch (error) {
      logAPI.error('Failed to set theme:', error);
      return false;
    }
  },

  // 現在のテーマを取得
  getTheme: () => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },

  // テーマを切り替え
  toggleTheme: () => {
    const currentTheme = themeAPI.getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    return themeAPI.setTheme(newTheme);
  },

  // システムのテーマ設定を取得
  getSystemTheme: () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
};

// DOM操作ヘルパー
const domAPI = {
  // 要素を取得
  getElementById: (id) => document.getElementById(id),
  querySelector: (selector) => document.querySelector(selector),
  querySelectorAll: (selector) => document.querySelectorAll(selector),

  // クラス操作
  addClass: (element, className) => {
    if (element && element.classList) {
      element.classList.add(className);
    }
  },
  removeClass: (element, className) => {
    if (element && element.classList) {
      element.classList.remove(className);
    }
  },
  toggleClass: (element, className) => {
    if (element && element.classList) {
      element.classList.toggle(className);
    }
  },

  // イベントリスナー
  addEventListener: (element, event, callback) => {
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, callback);
    }
  },
  removeEventListener: (element, event, callback) => {
    if (element && typeof element.removeEventListener === 'function') {
      element.removeEventListener(event, callback);
    }
  }
};

// バリデーションAPI
const validationAPI = {
  // メールアドレス形式チェック
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // URL形式チェック
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // ポート番号チェック
  isValidPort: (port) => {
    const portNum = parseInt(port);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
  },

  // 空文字チェック
  isNotEmpty: (value) => {
    return value !== null && value !== undefined && String(value).trim() !== '';
  },

  // APIキー形式チェック（基本的な形式のみ）
  isValidApiKey: (apiKey) => {
    return typeof apiKey === 'string' && apiKey.length > 10 && !/\s/.test(apiKey);
  }
};

// すべてのAPIをcontextBridgeで公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('i18nAPI', i18nAPI);
contextBridge.exposeInMainWorld('logAPI', logAPI);
contextBridge.exposeInMainWorld('storageAPI', storageAPI);
contextBridge.exposeInMainWorld('themeAPI', themeAPI);
contextBridge.exposeInMainWorld('domAPI', domAPI);
contextBridge.exposeInMainWorld('validationAPI', validationAPI);

// 開発環境でのデバッグ用
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('debugAPI', {
    log: logAPI,
    electron: electronAPI,
    process: {
      platform: process.platform,
      versions: process.versions
    }
  });
}

// レンダラープロセス読み込み完了通知
window.addEventListener('DOMContentLoaded', () => {
  logAPI.info('Preload script loaded successfully');
});