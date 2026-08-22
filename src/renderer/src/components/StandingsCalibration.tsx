import { useState, type Dispatch, type JSX, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

interface StandingsCalibration {
  colAStartX: number
  colAEndX: number
  colBStartX: number
  colBEndX: number
}

type CalibrationField = keyof StandingsCalibration

const DEFAULT_CALIBRATION: StandingsCalibration = {
  colAStartX: 0,
  colAEndX: 24,
  colBStartX: 25,
  colBEndX: 50
}

interface Props {
  config: any
  setConfig: Dispatch<SetStateAction<any>>
}

/**
 * スタンドモード（standings24）用のデータ領域校正UI。
 * OBSキャプチャをプレビュー表示し、列A/列BのX範囲（キャプチャ全幅に対する%）を調整する。
 */
export function StandingsCalibrationPanel({ config, setConfig }: Props): JSX.Element {
  const { t } = useTranslation()
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const mergeCalibration = (c: any): StandingsCalibration => ({
    ...DEFAULT_CALIBRATION,
    ...(c?.standingsCalibration ?? {})
  })
  const cal = mergeCalibration(config)

  const update = (field: CalibrationField, v: number): void => {
    if (isNaN(v)) return
    setConfig((prev: any) => ({
      ...prev,
      standingsCalibration: {
        ...mergeCalibration(prev),
        [field]: Math.max(0, Math.min(50, v))
      }
    }))
  }

  const capturePreview = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const result = await window.electron.ipcRenderer.invoke('obs-get-screenshot')
      if (result?.success) {
        setPreview(result.imageData || '')
      } else {
        setError(result?.error || 'Unknown error')
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-slate-700 rounded-xl p-4 space-y-3 bg-slate-900/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-200">{t('config.calTitle')}</span>
        <button
          type="button"
          onClick={capturePreview}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          {loading ? t('config.calLoading') : t('config.calGetPreview')}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 break-all">{error}</p>}

      {preview && (
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-700" style={{ aspectRatio: '16 / 9' }}>
          <img src={preview} alt="capture preview" className="absolute inset-0 h-full w-full object-contain bg-black" />
          {/* マスク: 範囲外を暗くする */}
          <div className="absolute inset-y-0 bg-black/70" style={{ left: '0%', width: `${cal.colAStartX}%` }} />
          <div className="absolute inset-y-0 bg-black/70" style={{ left: `${cal.colAEndX}%`, width: `${Math.max(0, cal.colBStartX - cal.colAEndX)}%` }} />
          <div className="absolute inset-y-0 bg-black/70" style={{ left: `${cal.colBEndX}%`, width: `${Math.max(0, 50 - cal.colBEndX)}%` }} />
          {/* 列A / 列B の枠 */}
          <div className="absolute inset-y-0 border-2 border-blue-400/80 pointer-events-none" style={{ left: `${cal.colAStartX}%`, width: `${Math.max(0, cal.colAEndX - cal.colAStartX)}%` }} />
          <div className="absolute inset-y-0 border-2 border-green-400/80 pointer-events-none" style={{ left: `${cal.colBStartX}%`, width: `${Math.max(0, cal.colBEndX - cal.colBStartX)}%` }} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="block text-sm font-medium text-blue-400">{t('config.calColA')}</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="calColAStartX" className="block text-xs text-slate-500">{t('config.calStartX')}</label>
              <input
                id="calColAStartX"
                type="number"
                min={0}
                max={50}
                step={1}
                name="colAStartX"
                value={cal.colAStartX}
                onChange={(e) => update('colAStartX', parseFloat(e.target.value))}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="calColAEndX" className="block text-xs text-slate-500">{t('config.calEndX')}</label>
              <input
                id="calColAEndX"
                type="number"
                min={0}
                max={50}
                step={1}
                name="colAEndX"
                value={cal.colAEndX}
                onChange={(e) => update('colAEndX', parseFloat(e.target.value))}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-green-400">{t('config.calColB')}</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="calColBStartX" className="block text-xs text-slate-500">{t('config.calStartX')}</label>
              <input
                id="calColBStartX"
                type="number"
                min={0}
                max={50}
                step={1}
                name="colBStartX"
                value={cal.colBStartX}
                onChange={(e) => update('colBStartX', parseFloat(e.target.value))}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="calColBEndX" className="block text-xs text-slate-500">{t('config.calEndX')}</label>
              <input
                id="calColBEndX"
                type="number"
                min={0}
                max={50}
                step={1}
                name="colBEndX"
                value={cal.colBEndX}
                onChange={(e) => update('colBEndX', parseFloat(e.target.value))}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">{t('config.calHint')}</p>
    </div>
  )
}
