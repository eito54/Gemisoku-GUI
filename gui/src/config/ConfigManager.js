const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const Logger = require('../utils/Logger');

/**
 * 設定管理クラス（改良版）
 */
class ConfigManager {
  constructor() {
    this.logger = new Logger('ConfigManager');
    this.configPath = null;
    this.envPath = null;
    this.config = null;
    this.isInitialized = false;
  }

  /**
   * 初期化
   */
  async initialize() {
    try {
      this.configPath = this.getConfigPath();
      this.envPath = this.getEnvPath();
      
      await this.ensureConfigDirectory();
      await this.loadConfig();
      
      this.isInitialized = true;
      this.logger.info('ConfigManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ConfigManager:', error);
      throw error;
    }
  }

  /**
   * 設定ファイルのパスを取得
   */
  getConfigPath() {
    try {
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'config', 'app-config.json');
    } catch (error) {
      // Electronがまだ初期化されていない場合の fallback
      return path.join(process.cwd(), 'config', 'app-config.json');
    }
  }

  /**
   * 環境設定ファイルのパスを取得
   */
  getEnvPath() {
    return path.join(process.cwd(), '.env');
  }

  /**
   * 設定ディレクトリの存在を確認・作成
   */
  async ensureConfigDirectory() {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create config directory:', error);
      throw error;
    }
  }

  /**
   * デフォルト設定を取得
   */
  getDefaultConfig() {
    return {
      geminiApiKey: '',
      obsWebSocketUrl: 'ws://localhost:4455',
      obsPassword: '',
      serverPort: 3001,
      language: 'ja',
      theme: 'light',
      autoUpdate: true,
      logLevel: 'info',
      raceSettings: {
        maxTeams: 12,
        defaultPoints: [15, 12, 10, 8, 6, 4, 3, 2, 1, 0, 0, 0],
        useCustomPoints: false,
        customPoints: []
      },
      ui: {
        showAdvancedOptions: false,
        confirmBeforeReset: true,
        autoSaveInterval: 30000
      }
    };
  }

  /**
   * 設定を読み込み
   */
  async loadConfig() {
    try {
      let config;
      
      if (await this.configFileExists()) {
        const configData = await fs.readFile(this.configPath, 'utf8');
        config = JSON.parse(configData);
        this.logger.info('Config loaded from file');
      } else {
        config = this.getDefaultConfig();
        await this.saveConfig(config);
        this.logger.info('Default config created');
      }

      // バリデーションと型チェック
      config = this.validateAndMergeConfig(config);
      this.config = config;
      
      return config;
    } catch (error) {
      this.logger.error('Failed to load config:', error);
      
      // エラーの場合はデフォルト設定を使用
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * 設定を保存
   */
  async saveConfig(config) {
    try {
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid config object');
      }

      // バリデーション
      const validatedConfig = this.validateAndMergeConfig(config);
      
      // ファイルに保存
      await fs.writeFile(
        this.configPath, 
        JSON.stringify(validatedConfig, null, 2), 
        'utf8'
      );

      // 環境変数ファイルを更新
      await this.updateEnvFile(validatedConfig);

      this.config = validatedConfig;
      this.logger.info('Config saved successfully');
      
      return {
        success: true,
        message: 'Configuration saved successfully'
      };
    } catch (error) {
      this.logger.error('Failed to save config:', error);
      return {
        success: false,
        message: `Failed to save configuration: ${error.message}`
      };
    }
  }

  /**
   * 設定ファイルの存在確認
   */
  async configFileExists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 設定のバリデーションとマージ
   */
  validateAndMergeConfig(config) {
    const defaultConfig = this.getDefaultConfig();
    const mergedConfig = this.deepMerge(defaultConfig, config);
    
    // 型チェックと範囲チェック
    if (typeof mergedConfig.serverPort !== 'number' || 
        mergedConfig.serverPort < 1000 || 
        mergedConfig.serverPort > 65535) {
      mergedConfig.serverPort = defaultConfig.serverPort;
    }
    
    if (!['ja', 'en'].includes(mergedConfig.language)) {
      mergedConfig.language = defaultConfig.language;
    }
    
    if (!['light', 'dark'].includes(mergedConfig.theme)) {
      mergedConfig.theme = defaultConfig.theme;
    }
    
    if (!['debug', 'info', 'warn', 'error'].includes(mergedConfig.logLevel)) {
      mergedConfig.logLevel = defaultConfig.logLevel;
    }

    return mergedConfig;
  }

  /**
   * オブジェクトの深いマージ
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * 環境変数ファイルを更新
   */
  async updateEnvFile(config) {
    try {
      const envContent = [
        `GEMINI_API_KEY=${config.geminiApiKey || ''}`,
        `OBS_WEBSOCKET_URL=${config.obsWebSocketUrl || 'ws://localhost:4455'}`,
        `OBS_PASSWORD=${config.obsPassword || ''}`,
        `SERVER_PORT=${config.serverPort || 3001}`,
        `LOG_LEVEL=${config.logLevel || 'info'}`,
        `LANGUAGE=${config.language || 'ja'}`,
        `THEME=${config.theme || 'light'}`,
        ''
      ].join('\n');

      await fs.writeFile(this.envPath, envContent, 'utf8');
      this.logger.info('Environment file updated');
    } catch (error) {
      this.logger.warn('Failed to update environment file:', error);
      // 環境ファイルの更新失敗は致命的ではないので続行
    }
  }

  /**
   * Gemini API キーをテスト
   */
  async testGeminiApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return {
          success: false,
          message: 'API key is required'
        };
      }

      // Google Generative AI SDK を使用してテスト
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      // 簡単なテストプロンプト
      const result = await model.generateContent('Hello');
      const response = await result.response;
      
      if (response && response.text) {
        this.logger.info('Gemini API key test successful');
        return {
          success: true,
          message: 'API key is valid'
        };
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      this.logger.error('Gemini API key test failed:', error);
      
      let errorMessage = 'Failed to validate API key';
      if (error.message.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid API key';
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'API quota exceeded';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied. Check API key permissions';
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * 現在の設定を取得
   */
  getCurrentConfig() {
    return this.config ? { ...this.config } : this.getDefaultConfig();
  }

  /**
   * 特定の設定値を取得
   */
  get(key, defaultValue = null) {
    if (!this.config) {
      return defaultValue;
    }
    
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * 特定の設定値を設定
   */
  async set(key, value) {
    try {
      if (!this.config) {
        await this.loadConfig();
      }
      
      const keys = key.split('.');
      let target = this.config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in target) || typeof target[k] !== 'object') {
          target[k] = {};
        }
        target = target[k];
      }
      
      target[keys[keys.length - 1]] = value;
      
      return await this.saveConfig(this.config);
    } catch (error) {
      this.logger.error(`Failed to set config value ${key}:`, error);
      return {
        success: false,
        message: `Failed to set configuration: ${error.message}`
      };
    }
  }
}

module.exports = ConfigManager;