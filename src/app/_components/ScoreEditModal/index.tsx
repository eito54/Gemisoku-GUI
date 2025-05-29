"use client";

import { Input } from "@/components/ui/input";
import type { TeamScore } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Save, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

type ScoreEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamScoreList: TeamScore[];
  setTeamScoreList: Dispatch<SetStateAction<TeamScore[]>>;
  saveScoresToServer: (scores: TeamScore[]) => Promise<void>;
};

export const ScoreEditModal = ({
  isOpen,
  onClose,
  teamScoreList,
  setTeamScoreList,
  saveScoresToServer,
}: ScoreEditModalProps) => {
  const [editableScores, setEditableScores] = useState<TeamScore[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamScore, setNewTeamScore] = useState(0);

  // モーダルが開かれたときに現在のスコアをコピー
  useEffect(() => {
    if (isOpen) {
      setEditableScores([...teamScoreList]);
    }
  }, [isOpen, teamScoreList]);

  const handleScoreChange = (index: number, field: 'team' | 'score', value: string | number) => {
    setEditableScores(prev => 
      prev.map((item, i) => 
        i === index 
          ? { ...item, [field]: field === 'score' ? Number(value) : value }
          : item
      )
    );
  };

  const handleDeleteTeam = (index: number) => {
    setEditableScores(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() && !editableScores.some(team => team.team === newTeamName.trim())) {
      const newTeam: TeamScore = {
        team: newTeamName.trim(),
        score: newTeamScore,
        addedScore: 0,
        isCurrentPlayer: false,
      };
      setEditableScores(prev => [...prev, newTeam]);
      setNewTeamName("");
      setNewTeamScore(0);
    }
  };

  const handleSave = async () => {
    // スコア順に並び替え
    const sortedScores = editableScores
      .filter(team => team.team.trim() !== "")
      .sort((a, b) => b.score - a.score);
    
    setTeamScoreList(sortedScores);
    await saveScoresToServer(sortedScores);
    onClose();
  };

  const handleReset = () => {
    setEditableScores([]);
    setTeamScoreList([]);
    saveScoresToServer([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">得点編集</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* チーム一覧 */}
          <div className="space-y-3 mb-6">
            {editableScores.map((team, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg"
              >
                <div className="flex-1">
                  <label className="block text-sm text-gray-300 mb-1">
                    チーム名
                  </label>
                  <Input
                    value={team.team}
                    onChange={(e) => handleScoreChange(index, 'team', e.target.value)}
                    className="bg-slate-600 border-slate-500 text-white"
                    placeholder="チーム名"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm text-gray-300 mb-1">
                    得点
                  </label>
                  <Input
                    type="number"
                    value={team.score}
                    onChange={(e) => handleScoreChange(index, 'score', e.target.value)}
                    className="bg-slate-600 border-slate-500 text-white text-center"
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={() => handleDeleteTeam(index)}
                  className="text-red-400 hover:text-red-300 transition-colors mt-6"
                  title="チームを削除"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>

          {/* 新しいチーム追加 */}
          <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3">新しいチームを追加</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-300 mb-1">
                  チーム名
                </label>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="bg-slate-600 border-slate-500 text-white"
                  placeholder="新しいチーム名"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTeam();
                  }}
                />
              </div>
              <div className="w-24">
                <label className="block text-sm text-gray-300 mb-1">
                  得点
                </label>
                <Input
                  type="number"
                  value={newTeamScore}
                  onChange={(e) => setNewTeamScore(Number(e.target.value))}
                  className="bg-slate-600 border-slate-500 text-white text-center"
                  placeholder="0"
                />
              </div>
              <button
                onClick={handleAddTeam}
                disabled={!newTeamName.trim() || editableScores.some(team => team.team === newTeamName.trim())}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:text-slate-400 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                追加
              </button>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              全削除
            </button>
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};