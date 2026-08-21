# 24人スタンド読取モード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解析モード設定を追加し、24人分のスタンド画面（キャプチャ左半分）をOCRで読み取って累計スコアとして上書き登録できるようにする。

**Architecture:** メインプロセスで `nativeImage` による左半分クロップとスタンド専用プロンプトに分岐し、既存のF2（useTotalScore=true）上書きフローを最大限再利用する。rendererはモード判定でボタン統合とラベル切替のみ行う。

**Tech Stack:** Electron main (`nativeImage`), Groq Vision API (OpenAI互換), React 19, react-i18next

**Spec:** `docs/superpowers/specs/2026-08-22-standings24-mode-design.md`

## Global Constraints

- 新規npm/pnpm依存は追加禁止（クロップはElectron標準の`nativeImage`を使用）
- 標準12人モード（F1=加算/F2=上書き）の既存動作を一切変更しない
- TypeScript strict を通過させること（`npm run typecheck`）
- i18nは ja/en 両方に必ず追記
- 新規IPCチャンネルは設けない（preloadホワイトリスト変更なし）
- コードスタイルは既存ファイルの周辺コードに合わせる（セミコロン有無・クォート等）

---

### Task 1: Config型に `analysisMode` を追加

**Files:**
- Modify: `src/main/config-manager.ts`

**Interfaces:**
- Consumes: なし
- Produces: `Config['analysisMode']: 'standard12' | 'standings24'`（後続タスクすべてが参照）

- [ ] **Step 1: Configインターフェースにフィールド追加**

`export interface Config {` の `aiProvider: 'groq'` の直後に追加:

```ts
  /** 解析モード: standard12 = 従来の12人レース結果解析 / standings24 = 24人スタンド読取(左半分クロップ) */
  analysisMode: 'standard12' | 'standings24'
```

- [ ] **Step 2: デフォルト値に追加**

`getDefaultConfig()` の `aiProvider: 'groq',` の直後に追加:

```ts
      analysisMode: 'standard12',
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし（他ファイルがまだこのフィールドを参照しないため影響ゼロ）

- [ ] **Step 4: Commit**

```bash
git add src/main/config-manager.ts
git commit -m "feat(config): add analysisMode setting (standard12 | standings24)"
```

---

### Task 2: キャプチャ解像度の定数化

**Files:**
- Modify: `src/main/obs-manager.ts`

**Interfaces:**
- Consumes: なし
- Produces: `CAPTURE_WIDTH: number`, `CAPTURE_HEIGHT: number`（エクスポート。仕様書「解像度ポリシー」の正規化ポイント）

- [ ] **Step 1: 定数を定義**

`export class ObsManager extends EventEmitter {` の直前に追加:

```ts
/**
 * スクリーンショットの正規化サイズ。
 * OBS GetSourceScreenshot の imageWidth/imageHeight により、ソース解像度
 * （Switch 2 の WQHD/4K 出力を含む）に関係なく常にこのサイズにスケールされる。
 * ビジョンモデルは内部でダウンスケールするため、これ以上大きくしても精度は向上しない。
 */
export const CAPTURE_WIDTH = 1920
export const CAPTURE_HEIGHT = 1080
```

- [ ] **Step 2: getScreenshotで使用**

`getScreenshot` 内の `imageWidth: 1920,` と `imageHeight: 1080,` を以下に置換:

```ts
      imageWidth: CAPTURE_WIDTH,
      imageHeight: CAPTURE_HEIGHT,
```

- [ ] **Step 3: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add src/main/obs-manager.ts
git commit -m "refactor(obs): name capture normalization constants (1080p by design)"
```

---

### Task 3: サーバーの残りレース数計算をモードゲート

**Files:**
- Modify: `src/main/server.ts`

**Interfaces:**
- Consumes: `Config['analysisMode']`（Task 1）
- Produces: `/api/scores` レスポンスの `remainingRaces` が standings24 モードで `null` になる（オーバーレイは既存のnullハンドリングで非表示化）

- [ ] **Step 1: GET /api/scores ハンドラの計算部分を置換**

既存コード:

```ts
        const config = this.configManager.getConfig()
        const totalScores = scores.reduce((sum: number, team: any) => sum + (team.score || 0), 0)
        const remainingRaces = Math.max(0, Math.floor(
          (POINTS_PER_RACE * MAX_RACES - totalScores) / POINTS_PER_RACE
        ))
```

を以下に置換:

```ts
        const config = this.configManager.getConfig()

        // 残りレース数の計算式は12人×固定配点前提のため、スタンド読取モードでは無意味
        let remainingRaces: number | null = null
        if (config.analysisMode !== 'standings24') {
          const totalScores = scores.reduce((sum: number, team: any) => sum + (team.score || 0), 0)
          remainingRaces = Math.max(0, Math.floor(
            (POINTS_PER_RACE * MAX_RACES - totalScores) / POINTS_PER_RACE
          ))
        }
```

レスポンス部は変更不要（既存の `config.showRemainingRaces ? remainingRaces : null` がそのまま機能する）。

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/main/server.ts
git commit -m "feat(server): disable remaining-races calc in standings24 mode"
```

---

### Task 4: ApiManager — 左半分クロップ＋スタンド解析プロンプト＋分岐

**Files:**
- Modify: `src/main/api-manager.ts`

**Interfaces:**
- Consumes: `Config['analysisMode']`（Task 1）、`CURRENT_VISION_MODEL`（既存）
- Produces: `analyzeRace(imageUrl, useTotalScore?)` — standings24モードでは自動的にスタンド解析へルーティングされる。シグネチャ不変なので呼び出し側（ipc-handlers）は無変更

**注:** 仕様書の「キャッシュハッシュにモード文字列を含める」要件について — スタンドパスはキャッシュを持たない（常時最新読取。既存F2と同一方針）ため、本実装では成立しており追加コードは不要。クロップ後の画像バイト列もフルフレームと異なるため誤ヒット構造自体が存在しない。

- [ ] **Step 1: nativeImageをimport**

1行目付近の `import { app } from 'electron'` を:

```ts
import { app, nativeImage } from 'electron'
```

- [ ] **Step 2: cropLeftHalfメソッドを追加**

クラス内（`getObsScreenshot` の直前）に追加:

```ts
  /**
   * スクリーンショットの左半分を切り出す（standings24モード用）。
   * デコード失敗時はフルフレームをそのまま返す（フォールバック）。
   */
  private cropLeftHalf(imageUrl: string): string {
    try {
      const base64Data = imageUrl.includes('base64,') ? imageUrl.split('base64,')[1] : imageUrl
      const image = nativeImage.createFromBuffer(Buffer.from(base64Data, 'base64'))
      if (image.isEmpty()) {
        console.error('[ApiManager] cropLeftHalf: image decode failed, using full frame')
        return imageUrl
      }
      const { width, height } = image.getSize()
      const cropped = image.crop({ x: 0, y: 0, width: Math.floor(width / 2), height })
      return `data:image/jpeg;base64,${cropped.toJPEG(90).toString('base64')}`
    } catch (error) {
      console.error('[ApiManager] cropLeftHalf failed:', error)
      return imageUrl
    }
  }
```

- [ ] **Step 3: analyzeStandingsGroqメソッドを追加**

`analyzeRaceGroq` の直前に追加:

```ts
  /**
   * 24人スタンド画面（レース開始前のプレイヤー情報）を解析する。
   * 表示値は累計ポイントのため、rank→配点の計算は行わず読み取った値をそのまま返す。
   */
  private async analyzeStandingsGroq(imageUrl: string): Promise<AnalyzeRaceResponse> {
    const config = this.configManager.getConfig()
    if (!config.groqApiKey) {
      throw new Error('Groq APIキーが設定されていません')
    }

    if (this.isAnalyzing) {
      throw new Error('現在解析中です...')
    }

    this.isAnalyzing = true

    try {
      const existingMappings = this.getAllPlayerMappings()
      const existingMappingsText = Object.keys(existingMappings).length > 0
        ? `\nFixed Teams: ${Object.entries(existingMappings).map(([p, t]) => `${p}=${t}`).join(',')}`
        : ''

      const prompt = `You are an expert OCR system reading a Mario Kart 8 Deluxe lounge/tournament standings screen shown BEFORE a race starts.
The screen lists up to 24 players, one row per player, each showing the player name and their CUMULATIVE score (points).
Rules:
1. Extract ALL visible rows (up to 24).
2. "name": The player name text exactly as readable.
3. "score": The cumulative points number shown on the row. Use the displayed value exactly as-is; do NOT calculate anything.
4. "isCurrentPlayer": Set true only for a row clearly highlighted as the local player; otherwise false for every row.
${existingMappingsText}
Return ONLY valid JSON matching this schema: { results: [{ name: string, score: number, isCurrentPlayer: boolean }] }`

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.groqApiKey}`
        },
        body: JSON.stringify({
          model: CURRENT_VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Data}`
                  }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          reasoning_effort: 'none',
          temperature: 0.1
        })
      })

      if (!response.ok) {
        let message = response.statusText
        try {
          const errorData = await response.json()
          message = errorData?.error?.message || message
        } catch { /* ボディがJSONでない場合 */ }
        throw new Error(`Groq API Error: ${message}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      const parsedResponse = JSON.parse(content)

      if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
        const normalized = parsedResponse.results
          .slice(0, 24)
          .map((r: any) => ({ ...r, score: Number(r?.score) || 0 }))
        const results = this.processRaceResults(normalized)
        return { success: true, results }
      }

      throw new Error('Groqからのレスポンスを解析できませんでした')
    } finally {
      this.isAnalyzing = false
    }
  }
```

- [ ] **Step 4: analyzeRaceに分岐を追加**

既存の `analyzeRace` メソッド本体:

```ts
  async analyzeRace(imageUrl: string, useTotalScore: boolean = false): Promise<AnalyzeRaceResponse> {
    const config = this.configManager.getConfig()

    // Always use Groq for now as other providers are removed/hidden
    if (config.groqApiKey) {
      return this.analyzeRaceGroq(imageUrl, useTotalScore)
    }

    throw new Error('AI解析用のAPIキー（Groq）が設定されていません')
  }
```

を以下に置換:

```ts
  async analyzeRace(imageUrl: string, useTotalScore: boolean = false): Promise<AnalyzeRaceResponse> {
    const config = this.configManager.getConfig()

    if (!config.groqApiKey) {
      throw new Error('AI解析用のAPIキー（Groq）が設定されていません')
    }

    // 24人スタンドモード: 常に左半分クロップ＋累計値の直接読取（rendererがfalseを渡しても強制）
    if (config.analysisMode === 'standings24') {
      return this.analyzeStandingsGroq(this.cropLeftHalf(imageUrl))
    }

    // Always use Groq for now as other providers are removed/hidden
    return this.analyzeRaceGroq(imageUrl, useTotalScore)
  }
```

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/main/api-manager.ts
git commit -m "feat(ai): left-half crop and standings OCR for 24-player mode"
```

---

### Task 5: Renderer — 実効フラグとボタン統合

**Files:**
- Modify: `src/renderer/src/App.tsx`（`handleFetchResults` 定義部とダッシュボードヘッダー）
- Modify: `src/renderer/src/locales/ja.json`, `src/renderer/src/locales/en.json`

**Interfaces:**
- Consumes: `config.analysisMode`（state `config` は既にコンポーネントスコープに存在）
- Produces: なし（UI動作のみ）

- [ ] **Step 1: handleFetchResults に実効フラグ導入**

`const handleFetchResults = useCallback(async (useTotalScore: boolean = false) => {` の直後にあるガード句:

```ts
    if (status === 'loading') return
    if (!window.electron || !window.electron.ipcRenderer) return
```

の直後に追加:

```ts
    const isStandingsMode = config?.analysisMode === 'standings24'
    const effectiveTotal = useTotalScore || isStandingsMode
```

- [ ] **Step 2: コールバック内のフラグ使用を差し替え**

(a) ログ出力:

```ts
    addLog(useTotalScore ? 'チーム合計点を取得中...' : 'レース結果を取得中...', 'info')
```

を:

```ts
    addLog(isStandingsMode ? '24人スタンドを読み込み中...' : effectiveTotal ? 'チーム合計点を取得中...' : 'レース結果を取得中...', 'info')
```

(b) マッピングリセット条件:

```ts
      if (useTotalScore) {
```

を:

```ts
      if (effectiveTotal) {
```

(c) IPC呼び出し:

```ts
      const result = await window.electron.ipcRenderer.invoke('fetch-race-results', useTotalScore)
```

を:

```ts
      const result = await window.electron.ipcRenderer.invoke('fetch-race-results', effectiveTotal)
```

(d) 上書き/加算分岐（コメント行 `// 総合スコアの場合は、既存スコアを無視して新規作成（リセットして上書き）` 直上）:

```ts
        if (useTotalScore) {
```

を:

```ts
        if (effectiveTotal) {
```

(e) 依存配列:

```ts
  }, [status, scores, addLog, serverPort, loadScores, loadPlayerMappings, manualCurrentTeam])
```

を:

```ts
  }, [status, scores, addLog, serverPort, loadScores, loadPlayerMappings, manualCurrentTeam, config])
```

- [ ] **Step 3: ダッシュボードボタンの統合**

ヘッダー内の2つの取得ボタン（`onClick={() => handleFetchResults(false)}` と `onClick={() => handleFetchResults(true)}`）を、以下の1ブロックに置き換える:

```tsx
                      <button
                        onClick={() => handleFetchResults(false)}
                        disabled={status === 'loading'}
                        className="glass-btn-primary flex items-center gap-2"
                      >
                        {status === 'loading' ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                        {config?.analysisMode === 'standings24' ? t('operations.fetchStandings') : t('operations.fetchRace')}
                      </button>
                      {config?.analysisMode !== 'standings24' && (
                        <button
                          onClick={() => handleFetchResults(true)}
                          disabled={status === 'loading'}
                          className="glass-btn bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30 text-purple-200 hover:text-purple-100 flex items-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.1)] hover:shadow-[0_0_20px_rgba(147,51,234,0.2)]"
                        >
                          <History size={20} />
                          {t('operations.fetchOverall')}
                        </button>
                      )}
```

- [ ] **Step 4: i18nキー追加（ja）**

`src/renderer/src/locales/ja.json` の `"operations"` ブロック、`"fetchOverall": "チーム合計点を取得(F2)",` の次の行に追加:

```json
    "fetchStandings": "24人スタンドを取得",
```

- [ ] **Step 5: i18nキー追加（en）**

`src/renderer/src/locales/en.json` の `"operations"` ブロック、`"fetchOverall"` の次の行に追加:

```json
    "fetchStandings": "Fetch 24-player standings",
```

- [ ] **Step 6: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/locales/ja.json src/renderer/src/locales/en.json
git commit -m "feat(ui): unified fetch button and effective-total routing in standings24 mode"
```

---

### Task 6: 設定UI — 解析モード選択

**Files:**
- Modify: `src/renderer/src/App.tsx`（AI設定タブのJSXと `handleSaveConfig`）
- Modify: `src/renderer/src/locales/ja.json`, `src/renderer/src/locales/en.json`

**Interfaces:**
- Consumes: フォーム項目名 `"analysisMode"`（`handleSaveConfig` の FormData 経由で main の save-config へ流れる）
- Produces: なし

- [ ] **Step 1: handleSaveConfig に保存処理を追加**

`if (hasField('groqApiKey')) newConfig.groqApiKey = formData.get('groqApiKey') as string` の直後に追加:

```ts
    if (hasField('analysisMode')) newConfig.analysisMode = formData.get('analysisMode') as 'standard12' | 'standings24'
```

- [ ] **Step 2: AI設定タブにラジオボタンを追加**

AI設定セクション内の `<input type="hidden" name="aiProvider" value="groq" />` の直後に挿入:

```tsx
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-400">{t('config.analysisModeLabel')}</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className={cn(
                              "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                              config?.analysisMode !== 'standings24'
                                ? "bg-blue-600/10 border-blue-500/50"
                                : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
                            )}>
                              <input
                                type="radio"
                                name="analysisMode"
                                value="standard12"
                                defaultChecked={config?.analysisMode !== 'standings24'}
                                className="mt-1 accent-blue-500"
                              />
                              <span>
                                <span className="block text-sm font-bold text-white">{t('config.analysisModeStandard')}</span>
                                <span className="block text-xs text-slate-500 mt-1">{t('config.analysisModeStandardHelp')}</span>
                              </span>
                            </label>
                            <label className={cn(
                              "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                              config?.analysisMode === 'standings24'
                                ? "bg-green-600/10 border-green-500/50"
                                : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
                            )}>
                              <input
                                type="radio"
                                name="analysisMode"
                                value="standings24"
                                defaultChecked={config?.analysisMode === 'standings24'}
                                className="mt-1 accent-green-500"
                              />
                              <span>
                                <span className="block text-sm font-bold text-white">{t('config.analysisModeStandings')}</span>
                                <span className="block text-xs text-slate-500 mt-1">{t('config.analysisModeStandingsHelp')}</span>
                              </span>
                            </label>
                          </div>
                          <p className="text-xs text-slate-500">{t('config.analysisModeHelp')}</p>
                        </div>
```

- [ ] **Step 3: i18nキー追加（ja）**

`src/renderer/src/locales/ja.json` の `"config"` ブロック、`"modelsHint"` の次の行に追加:

```json
    "analysisModeLabel": "解析モード",
    "analysisModeStandard": "標準（12人・レース結果）",
    "analysisModeStandardHelp": "リザルト画面の順位から配点を計算して加算します",
    "analysisModeStandings": "24人スタンド（左半分クロップ）",
    "analysisModeStandingsHelp": "レース開始前のスタンド画面から累計スコアを直接読み取ります",
    "analysisModeHelp": "※ スタンドモードではキャプチャの左半分だけを解析し、読み取った値で現在のスコアを上書きします。対象画面をキャプチャしていることを確認してください。",
```

- [ ] **Step 4: i18nキー追加（en）**

`src/renderer/src/locales/en.json` の `"config"` ブロック、`"modelsHint"` の次の行に追加:

```json
    "analysisModeLabel": "Analysis Mode",
    "analysisModeStandard": "Standard (12-player race results)",
    "analysisModeStandardHelp": "Calculates points from the rank on the results screen and adds them",
    "analysisModeStandings": "24-player standings (left-half crop)",
    "analysisModeStandingsHelp": "Reads cumulative scores directly from the pre-race standings screen",
    "analysisModeHelp": "* Standings mode analyzes only the left half of the capture and overwrites current scores with the read values. Make sure the correct screen is being captured.",
```

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/locales/ja.json src/renderer/src/locales/en.json
git commit -m "feat(settings): analysis mode selector (standard12 / standings24)"
```

---

### Task 7: 最終検証

**Files:**
- 変更なし（検証のみ）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: main/preload/renderer すべて成功

- [ ] **Step 2: 手動検証チェックリスト（ユーザー環境）**

以下をユーザーに依頼する:

1. `pnpm dev` で起動 → 設定 → AI解析設定に「解析モード」が表示される
2. 「24人スタンド」を選択して保存 → ダッシュボードのボタンが1つになり「24人スタンドを取得」に変わる
3. 実際のスタンド画面をOBSに映して取得 → GUIスコア一覧に24チーム分が反映される
4. オーバーレイに24行表示される・残りレース数が非表示になる
5. 設定を「標準」に戻す → 従来どおり2ボタン+F1加算フローが動く（回帰確認）

- [ ] **Step 3: 検証結果の記録**

問題があれば修正コミット。なければ完了報告（リリース作業は別手順）。
