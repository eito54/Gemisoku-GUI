import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ReconnectModal({
    isOpen,
    players,
    onRestore,
    onKeep
}: {
    isOpen: boolean;
    players: Array<{ name: string; previous: number; candidate: number }>;
    onRestore: () => void;
    onKeep: () => void;
}) {
    const { t } = useTranslation()
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-[#1e293b] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
                    >
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                                    <AlertTriangle className="text-amber-400" size={24} />
                                </div>
                                <h3 className="text-xl font-black text-slate-100 uppercase tracking-tight">⚠️ {t('dc.title')}</h3>
                            </div>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                {t('dc.hint')}
                            </p>
                            <div className="rounded-xl border border-slate-700 overflow-hidden mb-8">
                                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <span>name</span>
                                    <span className="text-right">{t('dc.previous')}</span>
                                    <span className="text-right">{t('dc.candidate')}</span>
                                </div>
                                {players.map((p) => (
                                    <div key={p.name} className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 border-t border-slate-800 text-sm items-center">
                                        <span className="font-bold text-slate-200 truncate">{p.name}</span>
                                        <span className="text-right text-slate-300 whitespace-nowrap">{`${p.previous}pt →`}</span>
                                        <span className={`text-right font-bold whitespace-nowrap ${p.candidate === 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                            {`${p.candidate}pt`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onKeep}
                                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 uppercase tracking-widest text-sm"
                                >
                                    {t('dc.keep')}
                                </button>
                                <button
                                    onClick={onRestore}
                                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-all shadow-lg shadow-green-600/20 uppercase tracking-widest text-sm"
                                >
                                    {t('dc.restore')}
                                </button>
                            </div>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-green-500/5 to-transparent pointer-events-none" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
