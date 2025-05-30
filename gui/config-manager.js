const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    // Electronアプリの場合はuserDataPathを使用、それ以外は現在のディレクトリ
    try {
      const { app } = require('electron');
      if (app && app.getPath) {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.fallbackConfigPath = path.join(__dirname, 'config.json');
        this.isElectron = true;
      } else {
        this.configPath = path.join(__dirname, 'config.json');
        this.fallbackConfigPath = this.configPath;
        this.isElectron = false;
      }
    } catch (error) {
      // Electronが利用できない場合
      this.configPath = path.join(__dirname, 'config.json');
      this.fallbackConfigPath = this.configPath;
      this.isElectron = false;
    }
    this.envPath = path.join(__dirname, '..', '.env');
    
    console.log('ConfigManager initialized with paths:');
    console.log('- Primary config path:', this.configPath);
    console.log('- Fallback config path:', this.fallbackConfigPath);
    console.log('- Env path:', this.envPath);
    console.log('- Is Electron:', this.isElectron);
  }

  // デフォルト設定
  getDefaultConfig() {
    return {
      obsIp: '127.0.0.1', // localhostから127.0.0.1に統一
      obsPort: 4455,
      obsPassword: '',
      obsSourceName: '映像キャプチャデバイス',
      geminiApiKey: '',
      theme: 'light',
      showRemainingRaces: true // オーバーレイで残りレース数を表示するかのフラグ
    };
  }

  // 設定を読み込み
  async loadConfig() {
    try {
      let config = null;
      
      // まずプライマリパスから読み込みを試行
      if (fs.existsSync(this.configPath)) {
        console.log('Loading config from primary path:', this.configPath);
        try {
          const configData = fs.readFileSync(this.configPath, 'utf8');
          config = JSON.parse(configData);
          console.log('Config loaded successfully from primary path:', config);
        } catch (parseError) {
          console.error('Error parsing config from primary path:', parseError);
          config = null;
        }
      }
      
      // プライマリパスから読み込めない場合はフォールバックパスを試行
      if (!config && this.fallbackConfigPath !== this.configPath && fs.existsSync(this.fallbackConfigPath)) {
        console.log('Loading config from fallback path:', this.fallbackConfigPath);
        try {
          const configData = fs.readFileSync(this.fallbackConfigPath, 'utf8');
          config = JSON.parse(configData);
          console.log('Config loaded from fallback:', config);
          
          // プライマリパスに設定をコピー（Electronの場合のみ）
          if (this.isElectron) {
            await this.saveConfig(config);
          }
        } catch (parseError) {
          console.error('Error parsing config from fallback path:', parseError);
          config = null;
        }
      }
      
      // 設定が読み込めなかった場合はデフォルト設定を作成
      if (!config) {
        console.log('No valid config file found, creating default config');
        config = this.getDefaultConfig();
        await this.saveConfig(config);
      }
      
      return { ...this.getDefaultConfig(), ...config };
    } catch (error) {
      console.error('設定読み込みエラー:', error);
      return this.getDefaultConfig();
    }
  }

  // 設定を保存
  async saveConfig(config) {
    try {
      const configToSave = { ...this.getDefaultConfig(), ...config };
      
      // プライマリパスに保存
      try {
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
          console.log('Creating config directory:', configDir);
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        console.log('Saving config to:', this.configPath);
        fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');
        console.log('Config saved successfully to primary path');
      } catch (primaryError) {
        console.error('Failed to save to primary path:', primaryError);
        
        // プライマリパスに保存できない場合はフォールバックパスに保存
        if (this.fallbackConfigPath !== this.configPath) {
          console.log('Saving config to fallback path:', this.fallbackConfigPath);
          fs.writeFileSync(this.fallbackConfigPath, JSON.stringify(configToSave, null, 2), 'utf8');
          console.log('Config saved successfully to fallback path');
        } else {
          throw primaryError;
        }
      }
      
      // .envファイルも更新
      await this.updateEnvFile(configToSave);
      
      return true;
    } catch (error) {
      console.error('設定保存エラー:', error);
      return false;
    }
  }

  // 設定の検証
  validateConfig(config) {
    const errors = [];

    if (!config.obsIp || config.obsIp.trim() === '') {
      errors.push('OBS IPアドレスが入力されていません');
    }

    if (!config.obsSourceName || config.obsSourceName.trim() === '') {
      errors.push('OBS ソース名が入力されていません');
    }

    if (!config.geminiApiKey || config.geminiApiKey.trim() === '') {
      errors.push('Gemini API キーが入力されていません');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // .envファイルの更新（後方互換性のため）
  async updateEnvFile(config) {
    try {
      const envContent = `# OBS WebSocket設定
OBS_IP=${config.obsIp}
OBS_PORT=${config.obsPort}
OBS_PASSWORD=${config.obsPassword}
OBS_SOURCE_NAME=${config.obsSourceName}

# Google Gemini API
GEMINI_API_KEY=${config.geminiApiKey}
`;
      fs.writeFileSync(this.envPath, envContent, 'utf8');
      return true;
    } catch (error) {
      console.error('.envファイル更新エラー:', error);
      return false;
    }
  }

  // APIキーの有効性をテスト
  async testGeminiApiKey(apiKey) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      
      if (!apiKey || apiKey.trim() === '') {
        return {
          isValid: false,
          error: 'APIキーが空です'
        };
      }
      
      console.log('Testing Gemini API key...');
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      // 簡単なテストプロンプトでAPIキーの有効性を確認
      const result = await model.generateContent("test");
      const response = result.response;
      const text = response.text();
      
      console.log('API key test successful, response:', text.substring(0, 50));
      return {
        isValid: true,
        error: null
      };
    } catch (error) {
      console.error('API key test failed:', error);
      
      let errorMessage = 'APIキーのテストに失敗しました';
      
      // エラーメッセージの詳細分析
      const errorString = error.toString().toLowerCase();
      const errorMessageLower = (error.message || '').toLowerCase();
      
      if (errorString.includes('api key not valid') ||
          errorString.includes('api_key_invalid') ||
          errorMessageLower.includes('api key not valid') ||
          errorMessageLower.includes('invalid api key')) {
        errorMessage = 'APIキーが無効です。正しいGemini APIキーを入力してください。';
      } else if (errorString.includes('quota') ||
                 errorString.includes('rate_limit') ||
                 errorString.includes('resource_exhausted')) {
        errorMessage = 'API使用量の上限に達しています。しばらく待ってから再試行してください。';
      } else if (errorString.includes('permission') ||
                 errorString.includes('forbidden')) {
        errorMessage = 'APIキーの権限が不足しています。Gemini APIが有効になっているか確認してください。';
      } else if (errorString.includes('network') ||
                 errorString.includes('connection')) {
        errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
      } else {
        errorMessage = `APIキーテストエラー: ${error.message || error.toString()}`;
      }
      
      return {
        isValid: false,
        error: errorMessage
      };
    }
  }
}

module.exports = ConfigManager;