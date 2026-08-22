import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface OverlayColors {
  /** スコア加算時のフラッシュ/カウントアップの光の色 (#rrggbb) */
  scoreEffect: string
  /** 自チーム枠の強調スタイル */
  ownTeamStyle: 'solid' | 'rainbow' | 'gradient'
  /** 単色スタイル時の自チーム枠の色 (#rrggbb) */
  ownTeamColor: string
  /** グラデーションスタイル時のバリエーション */
  ownTeamGradient: string
}

export interface OverlayAnimations {
  speed: number
  rankAnim: boolean
  flash: boolean
}

export interface StandingsCalibration {
  colAStartX: number
  colAEndX: number
  colBStartX: number
  colBEndX: number
  /** 2列共通の縦範囲（全高に対する%） */
  startY: number
  endY: number
}

export interface Config {
  obsIp: string
  obsPort: number
  obsPassword: string
  obsSourceName: string
  aiProvider: 'groq'
  /** 解析モード: standard12 = 従来の12人レース結果解析 / standings24 = 24人スタンド読取(左半分クロップ) */
  analysisMode: 'standard12' | 'standings24'
  groqApiKey: string
  theme: 'light' | 'dark'
  showRemainingRaces: boolean
  language: string
  lastSeenVersion: string
  lastReleaseNotes: string
  overlayTheme: 'default' | 'mkw'
  overlayColors: OverlayColors
  overlayAnimations: OverlayAnimations
  /** スタンド24モードの列ごとクロップ範囲（全幅/全高に対する%）。列A=左列, 列B=右列 */
  standingsCalibration: StandingsCalibration
  scoreSettings: {
    maxRaces: number
    points: number[]
    keepScoreOnRestart: boolean
  }
}

/** プレーンオブジェクトのみ再帰マージする（配列・クラスインスタンスは上書き） */
function deepMerge<T>(base: T, override: Partial<T> | null | undefined): T {
  if (override === null || override === undefined) return base
  if (Array.isArray(base) || Array.isArray(override)) return override as T
  if (typeof base !== 'object' || typeof override !== 'object') {
    // undefinedの上書きは無視（キー欠損扱い）
    return (override === undefined ? base : override) as T
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue
    const baseValue = (base as Record<string, unknown>)[key]
    result[key] =
      typeof baseValue === 'object' && baseValue !== null && typeof value === 'object' && value !== null && !Array.isArray(baseValue) && !Array.isArray(value)
        ? deepMerge(baseValue, value)
        : value
  }
  return result as T
}

export class ConfigManager {
  private configPath: string
  private fallbackConfigPath: string
  private isElectron: boolean
  private currentConfig: Config

  constructor() {
    this.currentConfig = this.getDefaultConfig()
    try {
      if (app && app.getPath) {
        this.configPath = path.join(app.getPath('userData'), 'config.json')
        this.fallbackConfigPath = path.join(__dirname, 'config.json')
        this.isElectron = true
      } else {
        this.configPath = path.join(__dirname, 'config.json')
        this.fallbackConfigPath = this.configPath
        this.isElectron = false
      }
    } catch {
      this.configPath = path.join(__dirname, 'config.json')
      this.fallbackConfigPath = this.configPath
      this.isElectron = false
    }
    void this.loadConfig()
  }

  getDefaultConfig(): Config {
    return {
      obsIp: '127.0.0.1',
      obsPort: 4455,
      obsPassword: '',
      obsSourceName: '映像キャプチャデバイス',
      aiProvider: 'groq',
      analysisMode: 'standard12',
      groqApiKey: '',
      theme: 'light',
      showRemainingRaces: true,
      language: 'ja',
      lastSeenVersion: '',
      lastReleaseNotes: '',
      overlayTheme: 'default',
      overlayColors: {
        scoreEffect: '#22c55e',
        ownTeamStyle: 'rainbow',
        ownTeamColor: '#fbbf24',
        ownTeamGradient: 'blue'
      },
      overlayAnimations: {
        speed: 1.0,
        rankAnim: true,
        flash: true
      },
      standingsCalibration: {
        // 既定値: 左半分(0〜50%)をほぼ全覆盖え。レイアウトによっては列Bが中央を
        // 超えるため、校正UIではXは0〜100%まで設定可能（ユーザーが実幅に合わせて調整）
        colAStartX: 0,
        colAEndX: 24,
        colBStartX: 25,
        colBEndX: 50,
        startY: 0,
        endY: 100
      },
      scoreSettings: {
        maxRaces: 12,
        points: [15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        keepScoreOnRestart: true
      }
    }
  }

  getConfig(): Config {
    return this.currentConfig
  }

  async loadConfig(): Promise<Config> {
    try {
      let stored: Partial<Config> | null = null

      if (fs.existsSync(this.configPath)) {
        try {
          stored = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        } catch (parseError) {
          console.error('Error parsing config from primary path:', parseError)
        }
      }

      if (!stored && this.fallbackConfigPath !== this.configPath && fs.existsSync(this.fallbackConfigPath)) {
        try {
          stored = JSON.parse(fs.readFileSync(this.fallbackConfigPath, 'utf8'))
          if (this.isElectron && stored) {
            await this.saveConfig(stored as Config)
          }
        } catch (parseError) {
          console.error('Error parsing config from fallback path:', parseError)
        }
      }

      // 深いマージにより、ネストした設定(overlayColors等)の一部だけが
      // ディスクに存在する場合でもデフォルト値で補完される
      this.currentConfig = deepMerge(this.getDefaultConfig(), stored)
      if (!stored) {
        await this.saveConfig(this.currentConfig)
      }
      return this.currentConfig
    } catch (error) {
      console.error('設定読み込みエラー:', error)
      this.currentConfig = this.getDefaultConfig()
      return this.currentConfig
    }
  }

  /** 部分的な設定オブジェクトを受け取り、デフォルトと深くマージして保存する */
  async saveConfig(config: Partial<Config>): Promise<void> {
    try {
      const merged = deepMerge(this.currentConfig, config)
      this.currentConfig = merged
      await fs.promises.writeFile(this.configPath, JSON.stringify(merged, null, 2))
    } catch (error) {
      console.error('設定保存エラー:', error)
      throw error
    }
  }
}
