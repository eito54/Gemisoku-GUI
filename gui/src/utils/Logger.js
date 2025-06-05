const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * ログ管理クラス
 */
class Logger {
  constructor(module = 'App') {
    this.module = module;
    this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    this.logFile = this.getLogFilePath();
    this.ensureLogDirectory();
  }

  /**
   * ログファイルのパスを取得
   */
  getLogFilePath() {
    try {
      const userDataPath = app.getPath('userData');
      const logsDir = path.join(userDataPath, 'logs');
      const today = new Date().toISOString().split('T')[0];
      return path.join(logsDir, `app-${today}.log`);
    } catch (error) {
      // Electronがまだ初期化されていない場合の fallback
      const tempDir = require('os').tmpdir();
      return path.join(tempDir, 'gemisoku-gui.log');
    }
  }

  /**
   * ログディレクトリが存在することを確認
   */
  ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * ログレベルの重要度を数値で取得
   */
  getLogLevelValue(level) {
    const levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] || 1;
  }

  /**
   * ログレベルをチェック
   */
  shouldLog(level) {
    return this.getLogLevelValue(level) >= this.getLogLevelValue(this.logLevel);
  }

  /**
   * ログメッセージをフォーマット
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const moduleStr = this.module.padEnd(12);
    
    let formattedMessage = `[${timestamp}] ${levelStr} [${moduleStr}] ${message}`;
    
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      formattedMessage += ` ${argsStr}`;
    }
    
    return formattedMessage;
  }

  /**
   * ログをファイルに書き込み
   */
  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * ログを出力
   */
  log(level, message, ...args) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // コンソールに出力
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // ファイルに出力
    this.writeToFile(formattedMessage);
  }

  /**
   * デバッグログ
   */
  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  /**
   * 情報ログ
   */
  info(message, ...args) {
    this.log('info', message, ...args);
  }

  /**
   * 警告ログ
   */
  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  /**
   * エラーログ
   */
  error(message, ...args) {
    this.log('error', message, ...args);
  }

  /**
   * ログレベルを設定
   */
  setLogLevel(level) {
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      this.logLevel = level;
      this.info(`Log level set to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * 古いログファイルをクリーンアップ
   */
  cleanupOldLogs(maxDays = 7) {
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        return;
      }

      const files = fs.readdirSync(logDir);
      const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          this.info(`Cleaned up old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Failed to cleanup old logs:', error);
    }
  }
}

module.exports = Logger;