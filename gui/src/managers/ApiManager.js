const https = require('https');
const http = require('http');
const Logger = require('../utils/Logger');

/**
 * API呼び出しとレース結果処理を管理するクラス
 */
class ApiManager {
  constructor() {
    this.logger = new Logger('ApiManager');
    this.serverPort = 3001;
  }

  /**
   * サーバーポートを設定
   */
  setServerPort(port) {
    this.serverPort = port;
  }

  /**
   * レース結果を取得
   */
  async fetchRaceResults(useTotalScore = false) {
    try {
      this.logger.info(`Fetching race results (useTotalScore: ${useTotalScore})`);
      
      const url = `http://127.0.0.1:${this.serverPort}/api/fetch-race-results?useTotalScore=${useTotalScore}`;
      const result = await this.makeHttpRequest(url, {
        method: 'GET',
        timeout: 30000
      });

      if (result.success) {
        this.logger.info('Race results fetched successfully');
        return {
          success: true,
          data: result.data,
          message: 'Race results fetched successfully'
        };
      } else {
        throw new Error(result.message || 'Failed to fetch race results');
      }
    } catch (error) {
      this.logger.error('Failed to fetch race results:', error);
      return {
        success: false,
        message: `Failed to fetch race results: ${error.message}`
      };
    }
  }

  /**
   * スコアをリセット
   */
  async resetScores() {
    try {
      this.logger.info('Resetting scores');
      
      const url = `http://localhost:${this.serverPort}/api/scores/reset`;
      const result = await this.makeHttpRequest(url, {
        method: 'POST',
        timeout: 10000
      });

      if (result.success) {
        this.logger.info('Scores reset successfully');
        return {
          success: true,
          message: 'Scores reset successfully'
        };
      } else {
        throw new Error(result.message || 'Failed to reset scores');
      }
    } catch (error) {
      this.logger.error('Failed to reset scores:', error);
      return {
        success: false,
        message: `Failed to reset scores: ${error.message}`
      };
    }
  }

  /**
   * 現在のスコアを取得
   */
  async getCurrentScores() {
    try {
      this.logger.debug('Getting current scores');
      
      const url = `http://localhost:${this.serverPort}/api/scores`;
      const result = await this.makeHttpRequest(url, {
        method: 'GET',
        timeout: 5000
      });

      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || 'Failed to get scores');
      }
    } catch (error) {
      this.logger.error('Failed to get current scores:', error);
      return {
        success: false,
        message: `Failed to get scores: ${error.message}`
      };
    }
  }

  /**
   * スコアを保存
   */
  async saveScores(scores, isOverallUpdate = false) {
    try {
      this.logger.info(`Saving scores (isOverallUpdate: ${isOverallUpdate})`);
      
      const queryParam = isOverallUpdate ? '?isOverallUpdate=true' : '';
      const url = `http://localhost:${this.serverPort}/api/scores${queryParam}`;
      
      const result = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scores),
        timeout: 10000
      });

      if (result.success) {
        this.logger.info('Scores saved successfully');
        return {
          success: true,
          message: 'Scores saved successfully'
        };
      } else {
        throw new Error(result.message || 'Failed to save scores');
      }
    } catch (error) {
      this.logger.error('Failed to save scores:', error);
      return {
        success: false,
        message: `Failed to save scores: ${error.message}`
      };
    }
  }

  /**
   * OBS接続をテスト
   */
  async testObsConnection() {
    try {
      this.logger.info('Testing OBS connection');
      
      const url = `http://localhost:${this.serverPort}/api/obs`;
      const result = await this.makeHttpRequest(url, {
        method: 'GET',
        timeout: 5000
      });

      return {
        success: result.success,
        message: result.message || (result.success ? 'OBS connection successful' : 'OBS connection failed')
      };
    } catch (error) {
      this.logger.error('Failed to test OBS connection:', error);
      return {
        success: false,
        message: `OBS connection failed: ${error.message}`
      };
    }
  }

  /**
   * レース結果を処理（詳細なロジック）
   */
  async processRaceResults(results, isOverallScore = false) {
    try {
      this.logger.info(`Processing race results (isOverallScore: ${isOverallScore})`);
      
      if (!results || !Array.isArray(results) || results.length === 0) {
        throw new Error('Invalid or empty race results');
      }

      // チーム名の正規化とマージ
      const normalizedResults = this.normalizeTeamNames(results);
      
      // 現在のスコアを取得
      const currentScoresResult = await this.getCurrentScores();
      let existingScores = [];
      
      if (currentScoresResult.success && currentScoresResult.data) {
        existingScores = currentScoresResult.data;
      }

      // レースポイントの計算
      const racePoints = this.calculateRacePoints(normalizedResults);
      
      // スコアの更新
      const updatedScores = this.updateScores(existingScores, racePoints, isOverallScore);
      
      // スコアを保存
      const saveResult = await this.saveScores(updatedScores, isOverallScore);
      
      if (saveResult.success) {
        this.logger.info('Race results processed successfully');
        return {
          success: true,
          data: updatedScores,
          message: 'Race results processed successfully'
        };
      } else {
        throw new Error(saveResult.message);
      }
    } catch (error) {
      this.logger.error('Failed to process race results:', error);
      return {
        success: false,
        message: `Failed to process race results: ${error.message}`
      };
    }
  }

  /**
   * チーム名を正規化
   */
  normalizeTeamNames(results) {
    return results.map(result => ({
      ...result,
      team: result.team ? result.team.trim() : 'Unknown Team'
    }));
  }

  /**
   * レースポイントを計算
   */
  calculateRacePoints(results) {
    const defaultPoints = [15, 12, 10, 8, 6, 4, 3, 2, 1, 0, 0, 0];
    const racePoints = {};

    results.forEach((result, index) => {
      const points = index < defaultPoints.length ? defaultPoints[index] : 0;
      racePoints[result.team] = {
        team: result.team,
        raceScore: points,
        position: index + 1
      };
    });

    return racePoints;
  }

  /**
   * スコアを更新
   */
  updateScores(existingScores, racePoints, isOverallScore) {
    const scoreMap = new Map();
    
    // 既存のスコアを Map に変換
    existingScores.forEach(score => {
      scoreMap.set(score.team, { ...score });
    });

    // レース結果を適用
    Object.values(racePoints).forEach(raceResult => {
      const teamName = raceResult.team;
      
      if (scoreMap.has(teamName)) {
        const existingScore = scoreMap.get(teamName);
        if (isOverallScore) {
          existingScore.totalScore = (existingScore.totalScore || 0) + raceResult.raceScore;
        } else {
          existingScore.raceScore = raceResult.raceScore;
          existingScore.totalScore = (existingScore.totalScore || 0) + raceResult.raceScore;
        }
        existingScore.lastPosition = raceResult.position;
      } else {
        scoreMap.set(teamName, {
          team: teamName,
          raceScore: raceResult.raceScore,
          totalScore: raceResult.raceScore,
          lastPosition: raceResult.position
        });
      }
    });

    // Map を配列に変換してソート
    return Array.from(scoreMap.values()).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  }

  /**
   * HTTP リクエストを実行
   */
  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000
      };

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (error) {
            resolve({
              success: false,
              message: 'Invalid JSON response',
              data: data
            });
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(`HTTP request error: ${error.message}`);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

module.exports = ApiManager;