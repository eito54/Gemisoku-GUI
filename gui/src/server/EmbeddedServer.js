const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const OBSWebSocket = require('obs-websocket-js').default;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../utils/Logger');

/**
 * 内蔵Expressサーバーを管理するクラス（改良版）
 */
class EmbeddedServer {
  constructor() {
    this.logger = new Logger('EmbeddedServer');
    this.app = express();
    this.server = null;
    this.port = 3001;
    this.isRunning = false;
    this.obs = new OBSWebSocket();
    this.genAI = null;
    this.configManager = null;
  }

  /**
   * 初期化
   */
  async initialize(configManager = null) {
    try {
      this.configManager = configManager;
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();
      
      this.logger.info('EmbeddedServer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize EmbeddedServer:', error);
      throw error;
    }
  }

  /**
   * ミドルウェアを設定
   */
  setupMiddleware() {
    // CORS設定
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // JSON パーサー
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // リクエストログ
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // 静的ファイル配信
    const staticPath = path.join(__dirname, '..', '..', 'static');
    this.app.use('/static', express.static(staticPath));
  }

  /**
   * ルートを設定
   */
  setupRoutes() {
    // ヘルスチェック
    this.app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        version: require('../../../package.json').version
      });
    });

    // 設定関連
    this.setupConfigRoutes();
    
    // OBS関連
    this.setupObsRoutes();
    
    // Gemini AI関連
    this.setupGeminiRoutes();
    
    // スコア管理関連
    this.setupScoreRoutes();
    
    // レース結果取得関連
    this.setupRaceResultRoutes();
  }

  /**
   * 設定関連のルートを設定
   */
  setupConfigRoutes() {
    // 設定取得
    this.app.get('/api/config', async (req, res) => {
      try {
        if (!this.configManager) {
          return res.status(500).json({
            success: false,
            message: 'ConfigManager not available'
          });
        }

        const config = await this.configManager.getCurrentConfig();
        res.json({
          success: true,
          data: config
        });
      } catch (error) {
        this.logger.error('Failed to get config:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get configuration'
        });
      }
    });

    // 設定保存
    this.app.post('/api/config', async (req, res) => {
      try {
        if (!this.configManager) {
          return res.status(500).json({
            success: false,
            message: 'ConfigManager not available'
          });
        }

        const result = await this.configManager.saveConfig(req.body);
        res.json(result);
      } catch (error) {
        this.logger.error('Failed to save config:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to save configuration'
        });
      }
    });
  }

  /**
   * OBS関連のルートを設定
   */
  setupObsRoutes() {
    // OBS接続テスト
    this.app.get('/api/obs', async (req, res) => {
      try {
        const config = this.configManager ? await this.configManager.getCurrentConfig() : {};
        const obsConfig = {
          address: config.obsWebSocketUrl || 'ws://localhost:4455',
          password: config.obsPassword || ''
        };

        this.logger.info('Testing OBS connection:', { address: obsConfig.address });

        if (this.obs.identified) {
          await this.obs.disconnect();
        }

        await this.obs.connect(obsConfig.address, obsConfig.password, {
          rpcVersion: 1
        });

        const version = await this.obs.call('GetVersion');
        
        res.json({
          success: true,
          message: 'OBS connection successful',
          data: {
            version: version.obsVersion,
            websocketVersion: version.obsWebSocketVersion
          }
        });

      } catch (error) {
        this.logger.error('OBS connection failed:', error);
        res.json({
          success: false,
          message: `OBS connection failed: ${error.message}`
        });
      }
    });

    // OBS スクリーンショット取得
    this.app.post('/api/obs/screenshot', async (req, res) => {
      try {
        if (!this.obs.identified) {
          throw new Error('OBS not connected');
        }

        const sourceName = req.body.sourceName || 'mk8dx-bot-source';
        
        const screenshot = await this.obs.call('GetSourceScreenshot', {
          sourceName: sourceName,
          imageFormat: 'png'
        });

        res.json({
          success: true,
          data: {
            imageData: screenshot.imageData
          }
        });

      } catch (error) {
        this.logger.error('Failed to get OBS screenshot:', error);
        res.json({
          success: false,
          message: `Failed to get screenshot: ${error.message}`
        });
      }
    });
  }

  /**
   * Gemini AI関連のルートを設定
   */
  setupGeminiRoutes() {
    // Gemini API テスト
    this.app.post('/api/gemini/test', async (req, res) => {
      try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            message: 'API key is required'
          });
        }

        const testGenAI = new GoogleGenerativeAI(apiKey);
        const model = testGenAI.getGenerativeModel({ model: 'gemini-pro' });
        
        const result = await model.generateContent('Test connection');
        const response = await result.response;
        
        if (response && response.text) {
          res.json({
            success: true,
            message: 'Gemini API connection successful'
          });
        } else {
          throw new Error('Invalid response from Gemini API');
        }

      } catch (error) {
        this.logger.error('Gemini API test failed:', error);
        res.json({
          success: false,
          message: `Gemini API test failed: ${error.message}`
        });
      }
    });

    // レース結果分析
    this.app.post('/api/gemini/analyze-race-results', async (req, res) => {
      try {
        const { imageData, apiKey } = req.body;
        
        if (!imageData) {
          return res.status(400).json({
            success: false,
            message: 'Image data is required'
          });
        }

        const currentApiKey = apiKey || (this.configManager ? 
          await this.configManager.get('geminiApiKey') : null);
        
        if (!currentApiKey) {
          return res.status(400).json({
            success: false,
            message: 'Gemini API key not configured'
          });
        }

        const analysisResult = await this.analyzeRaceResultsWithGemini(imageData, currentApiKey);
        res.json(analysisResult);

      } catch (error) {
        this.logger.error('Failed to analyze race results:', error);
        res.status(500).json({
          success: false,
          message: `Failed to analyze race results: ${error.message}`
        });
      }
    });
  }

  /**
   * スコア管理関連のルートを設定
   */
  setupScoreRoutes() {
    // スコア取得
    this.app.get('/api/scores', async (req, res) => {
      try {
        const scores = await this.loadScores();
        res.json({
          success: true,
          data: scores
        });
      } catch (error) {
        this.logger.error('Failed to get scores:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get scores'
        });
      }
    });

    // スコア保存
    this.app.post('/api/scores', async (req, res) => {
      try {
        const { scores } = req.body;
        const isOverallUpdate = req.query.isOverallUpdate === 'true';
        
        await this.saveScores(scores, isOverallUpdate);
        
        res.json({
          success: true,
          message: 'Scores saved successfully'
        });
      } catch (error) {
        this.logger.error('Failed to save scores:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to save scores'
        });
      }
    });

    // スコアリセット
    this.app.post('/api/scores/reset', async (req, res) => {
      try {
        await this.resetScores();
        res.json({
          success: true,
          message: 'Scores reset successfully'
        });
      } catch (error) {
        this.logger.error('Failed to reset scores:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to reset scores'
        });
      }
    });
  }

  /**
   * レース結果取得関連のルートを設定
   */
  setupRaceResultRoutes() {
    // レース結果取得
    this.app.get('/api/fetch-race-results', async (req, res) => {
      try {
        const useTotalScore = req.query.useTotalScore === 'true';
        
        // OBSからスクリーンショットを取得
        const screenshotResult = await this.getObsScreenshot();
        
        if (!screenshotResult.success) {
          return res.json(screenshotResult);
        }

        // Gemini AIで分析
        const analysisResult = await this.analyzeWithGemini(screenshotResult.data.imageData);
        
        if (!analysisResult.success) {
          return res.json(analysisResult);
        }

        // スコアを処理・保存
        const processResult = await this.processAndSaveResults(analysisResult.data, useTotalScore);
        
        res.json(processResult);

      } catch (error) {
        this.logger.error('Failed to fetch race results:', error);
        res.status(500).json({
          success: false,
          message: `Failed to fetch race results: ${error.message}`
        });
      }
    });
  }

  /**
   * エラーハンドリングを設定
   */
  setupErrorHandling() {
    // 404ハンドラー
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found'
      });
    });

    // エラーハンドラー
    this.app.use((error, req, res, next) => {
      this.logger.error('Server error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    });
  }

  /**
   * サーバーを開始
   */
  async start(port = 3001) {
    try {
      if (this.isRunning) {
        this.logger.warn('Server is already running');
        return;
      }

      this.port = port;

      return new Promise((resolve, reject) => {
        this.server = this.app.listen(port, (error) => {
          if (error) {
            this.logger.error('Failed to start server:', error);
            reject(error);
          } else {
            this.isRunning = true;
            this.logger.info(`Server started on port ${port}`);
            resolve();
          }
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(`Port ${port} is already in use`);
          } else {
            this.logger.error('Server error:', error);
          }
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * サーバーを停止
   */
  async stop() {
    try {
      if (!this.isRunning || !this.server) {
        this.logger.warn('Server is not running');
        return;
      }

      return new Promise((resolve) => {
        this.server.close(() => {
          this.isRunning = false;
          this.logger.info('Server stopped');
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Failed to stop server:', error);
      throw error;
    }
  }

  /**
   * スコアを読み込み
   */
  async loadScores() {
    try {
      const scoresPath = this.getScoresPath();
      const data = await fs.readFile(scoresPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.debug('No existing scores file, returning empty array');
      return [];
    }
  }

  /**
   * スコアを保存
   */
  async saveScores(scores, isOverallUpdate = false) {
    try {
      const scoresPath = this.getScoresPath();
      await fs.writeFile(scoresPath, JSON.stringify(scores, null, 2), 'utf8');
      this.logger.info(`Scores saved (isOverallUpdate: ${isOverallUpdate})`);
    } catch (error) {
      this.logger.error('Failed to save scores:', error);
      throw error;
    }
  }

  /**
   * スコアをリセット
   */
  async resetScores() {
    try {
      const scoresPath = this.getScoresPath();
      await fs.writeFile(scoresPath, JSON.stringify([], null, 2), 'utf8');
      this.logger.info('Scores reset');
    } catch (error) {
      this.logger.error('Failed to reset scores:', error);
      throw error;
    }
  }

  /**
   * スコアファイルのパスを取得
   */
  getScoresPath() {
    return path.join(process.cwd(), 'scores.json');
  }

  /**
   * OBSスクリーンショットを取得
   */
  async getObsScreenshot() {
    try {
      if (!this.obs.identified) {
        throw new Error('OBS not connected');
      }

      const screenshot = await this.obs.call('GetSourceScreenshot', {
        sourceName: 'mk8dx-bot-source',
        imageFormat: 'png'
      });

      return {
        success: true,
        data: {
          imageData: screenshot.imageData
        }
      };
    } catch (error) {
      this.logger.error('Failed to get OBS screenshot:', error);
      return {
        success: false,
        message: `Failed to get screenshot: ${error.message}`
      };
    }
  }

  /**
   * Gemini AIでレース結果を分析
   */
  async analyzeRaceResultsWithGemini(imageData, apiKey) {
    try {
      if (!this.genAI || this.genAI.apiKey !== apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
      }

      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
      
      const mimeType = this.extractMimeType(imageData);
      const base64Data = this.extractBase64Data(imageData);

      const prompt = `
        この画像はマリオカート8デラックスのレース結果画面です。
        順位とチーム名を正確に読み取って、以下のJSON形式で出力してください：
        [
          {"position": 1, "team": "チーム名1"},
          {"position": 2, "team": "チーム名2"},
          ...
        ]
        
        注意事項：
        - 順位は1位から順に正確に読み取ってください
        - チーム名は正確に読み取ってください
        - JSONフォーマット以外は出力しないでください
      `;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // JSONを抽出・パース
      const raceResults = this.parseGeminiResponse(text);
      
      return {
        success: true,
        data: raceResults
      };
    } catch (error) {
      this.logger.error('Failed to analyze race results with Gemini:', error);
      return {
        success: false,
        message: `Analysis failed: ${error.message}`
      };
    }
  }

  /**
   * Base64データからMIMEタイプを抽出
   */
  extractMimeType(base64Data) {
    const match = base64Data.match(/^data:([^;]+);base64,/);
    return match ? match[1] : 'image/png';
  }

  /**
   * Base64データから実際のデータ部分を抽出
   */
  extractBase64Data(base64Data) {
    return base64Data.replace(/^data:[^;]+;base64,/, '');
  }

  /**
   * Geminiレスポンスをパース
   */
  parseGeminiResponse(text) {
    try {
      // JSONを抽出
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const raceResults = JSON.parse(jsonMatch[0]);
      
      // データバリデーション
      if (!Array.isArray(raceResults)) {
        throw new Error('Response is not an array');
      }

      return raceResults.map(result => ({
        position: parseInt(result.position),
        team: String(result.team).trim()
      }));
    } catch (error) {
      this.logger.error('Failed to parse Gemini response:', error);
      throw new Error(`Failed to parse analysis result: ${error.message}`);
    }
  }

  /**
   * レース結果を処理・保存
   */
  async processAndSaveResults(raceResults, useTotalScore) {
    try {
      // 現在のスコアを取得
      const currentScores = await this.loadScores();
      
      // 新しいスコアを計算
      const updatedScores = this.calculateUpdatedScores(currentScores, raceResults, useTotalScore);
      
      // スコアを保存
      await this.saveScores(updatedScores, useTotalScore);
      
      return {
        success: true,
        data: updatedScores,
        message: 'Race results processed and saved successfully'
      };
    } catch (error) {
      this.logger.error('Failed to process and save results:', error);
      return {
        success: false,
        message: `Failed to process results: ${error.message}`
      };
    }
  }

  /**
   * 更新されたスコアを計算
   */
  calculateUpdatedScores(currentScores, raceResults, useTotalScore) {
    const pointsSystem = [15, 12, 10, 8, 6, 4, 3, 2, 1, 0, 0, 0];
    const scoreMap = new Map();

    // 既存スコアをMapに変換
    currentScores.forEach(score => {
      scoreMap.set(score.team, { ...score });
    });

    // 新しいレース結果を適用
    raceResults.forEach((result, index) => {
      const points = index < pointsSystem.length ? pointsSystem[index] : 0;
      const teamName = result.team;

      if (scoreMap.has(teamName)) {
        const existingScore = scoreMap.get(teamName);
        if (useTotalScore) {
          existingScore.totalScore = (existingScore.totalScore || 0) + points;
        } else {
          existingScore.raceScore = points;
          existingScore.totalScore = (existingScore.totalScore || 0) + points;
        }
        existingScore.lastPosition = result.position;
      } else {
        scoreMap.set(teamName, {
          team: teamName,
          raceScore: points,
          totalScore: points,
          lastPosition: result.position
        });
      }
    });

    // ソートして配列として返す
    return Array.from(scoreMap.values())
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  }

  /**
   * サーバーの実行状態を取得
   */
  isServerRunning() {
    return this.isRunning;
  }

  /**
   * サーバーポートを取得
   */
  getPort() {
    return this.port;
  }
}

module.exports = EmbeddedServer;