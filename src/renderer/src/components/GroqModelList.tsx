import { useState, useEffect, useCallback, type JSX } from 'react'
import { RefreshCw, Eye, EyeOff, AlertCircle, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../utils'

interface GroqModelInfo {
  id: string
  vision: boolean
  active: boolean
  contextWindow?: number
}

function formatContext(tokens?: number): string {
  if (!tokens) return ''
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`
  return String(tokens)
}

/**
 * Groqアカウントで利用可能なモデル一覧を取得して表示する。
 * APIのレスポンスには画像対応フラグが無いため、メインプロセス側で
 * 既知のビジョン対応ファミリーかどうかをIDパターンで判定した結果を表示する。
 */
export function GroqModelList({ hasApiKey }: { hasApiKey: boolean }): JSX.Element {
  const { t } = useTranslation()
  const [models, setModels] = useState<GroqModelInfo[]>([])
  const [currentModel, setCurrentModel] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.electron.ipcRenderer.invoke('groq-list-models')
      if (result?.success) {
        setModels(result.models || [])
        setCurrentModel(result.currentModel || '')
      } else {
        setError(result?.error || 'Unknown error')
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }, [])

  useEffect(() => {
    if (hasApiKey && !hasLoadedOnce && !loading) {
      fetchModels()
    }
  }, [hasApiKey, hasLoadedOnce, loading, fetchModels])

  if (!hasApiKey) {
    return (
      <div className="border border-slate-700 rounded-xl p-4 bg-slate-900/50 text-sm text-slate-400 flex items-center gap-2">
        <AlertCircle size={16} className="text-slate-400 flex-shrink-0" />
        {t('config.modelsNeedKey')}
      </div>
    )
  }

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
      <div className="flex items-center justify-between p-4 bg-slate-800/50 border-b border-slate-800">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <ListChecks size={16} className="text-green-400" />
          {t('config.modelsTitle')}
        </div>
        <button
          type="button"
          onClick={fetchModels}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
          {loading ? t('config.modelsRefreshing') : t('config.modelsRefresh')}
        </button>
      </div>

      {error ? (
        <div className="p-4 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p>{t('config.modelsError')}</p>
            <p className="text-xs text-red-400/70 mt-1 font-mono break-all">{error}</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {models.length === 0 && !loading && (
            <li className="p-4 text-sm text-slate-400">{t('config.modelsEmpty')}</li>
          )}
          {models.map((model) => (
            <li key={model.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {model.vision ? (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 whitespace-nowrap"
                  title={t('config.modelsVisionOk')}
                >
                  <Eye size={11} />
                  {t('config.modelsVisionShort')}
                </span>
              ) : (
                <span
                  className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap"
                  title={t('config.modelsVisionNo')}
                >
                  <EyeOff size={11} />
                  {t('config.modelsVisionNoShort')}
                </span>
              )}
              <span className="font-mono text-xs text-slate-300 truncate flex-1" title={model.id}>
                {model.id}
                {model.id === currentModel && (
                  <span className="ml-2 text-xs font-bold text-accent-400">● {t('config.modelsCurrent')}</span>
                )}
              </span>
              {model.contextWindow && (
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {formatContext(model.contextWindow)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/80">
        <p className="text-xs text-slate-400">{t('config.modelsHint')}</p>
      </div>
    </div>
  )
}
