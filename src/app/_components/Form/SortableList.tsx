"use client"; // Client Component

import { Input } from "@/components/ui/input";
import type { TeamScore, RaceResult } from "@/types"; // RaceResult をインポート
import { AnimatePresence, Reorder } from "framer-motion";
import { Diff } from "lucide-react";
import { useEffect, useRef, useState, createRef } from "react"; // createRef をインポート
import type { Control, FieldArrayWithId, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { Dispatch, SetStateAction, RefObject } from "react"; // RefObject をインポート
import { animationStyles, addAnimationStyles } from "./SortableList.styles";
import React from "react"; // Reactをインポート

// スタイルを適用（ページロード時に実行される）
if (typeof window !== 'undefined') {
  addAnimationStyles();
}

type FormValues = {
  results: TeamScore[]; // TeamScore[] のままで良いか、RaceResult[] にすべきか検討。現状はTeamScoreのまま
};

type SortableListProps = {
  fields: FieldArrayWithId<FormValues, "results", "id">[];
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  setTeamScoreList: Dispatch<SetStateAction<TeamScore[]>>;
  // `fields` は `TeamScore[]` に `id` が追加されたものだが、
  // `isCurrentPlayer` を持つ `RaceResult` の情報も間接的に含まれる想定
};

export default function SortableList({
  fields,
  control,
  register,
  setValue,
  setTeamScoreList,
}: SortableListProps) {
  // 以前のスコアとチーム名を保存する参照
  const prevScoresRef = useRef<Record<string, number>>({});
  const prevTeamNamesRef = useRef<Record<string, string>>({});
  const prevPositionsRef = useRef<Record<string, number>>({});
  
  // チーム名変更の状態管理
  const [teamNameChanges, setTeamNameChanges] = useState<string[]>([]);
  // スコア変更の状態管理 (teamId:加算点数)
  const [scoreChanges, setScoreChanges] = useState<Record<string, number>>({});
  // 順位変更の状態管理 (teamId: 'up' | 'down' | null)
  const [positionChanges, setPositionChanges] = useState<Record<string, 'up' | 'down' | null>>({});
  
  // 選択されたチームの状態
  const [selectedTeamInfo, setSelectedTeamInfo] = useState<{ id: string, name: string } | null>(null);
  const [isReordering, setIsReordering] = useState(false); // 並び替え操作中フラグ
  // const [tempOrder, setTempOrder] = useState<string[] | null>(null); // tempOrder はもう使わない
  
  // 各Reorder.Itemのrefを保持する配列
  const itemRefs = useRef<Array<RefObject<HTMLLIElement>>>([]);
  // fieldsの長さに合わせてref配列を初期化・更新
  if (itemRefs.current.length !== fields.length) {
    itemRefs.current = Array(fields.length).fill(null).map((_, i) => itemRefs.current[i] || createRef<HTMLLIElement>());
  }
  
  // チーム選択時のメッセージ
  const [showTeamSelectedMessage, setShowTeamSelectedMessage] = useState(false);
  // スコアとチーム名、順位の変更を検出し、アニメーション用のstateを更新
  // また、このエフェクトの最後に次回の比較のために prevRefs を更新する
  useEffect(() => {
    console.log("[Main Effect] Start. isReordering:", isReordering);
    console.log("[Main Effect] fields:", JSON.parse(JSON.stringify(fields.map(f => ({id: f.id, team: f.team, score: f.score, addedScore: f.addedScore})))));
    console.log("[Main Effect] prevPositionsRef.current (before processing):", JSON.parse(JSON.stringify(prevPositionsRef.current)));

    // 特別なフラグ - isReordering が false になった直後の処理を確認
    const isFirstRenderAfterReordering = !isReordering && Object.keys(prevPositionsRef.current).length > 0;
    if (isFirstRenderAfterReordering) {
      console.log("[Main Effect] First render after reordering completed");
    }

    if (isReordering) {
      console.log("[Main Effect] Skipped due to isReordering flag (animation & ref update).");
      return; // 並び替え操作中は、アニメーション計算とprevRefsの更新をスキップ
    }

    const newTeamNameChangesLocal: string[] = [];
    const newScoreChangesLocal: Record<string, number> = {};
    const newPositionChangesLocal: Record<string, 'up' | 'down' | null> = {};

    fields.forEach((field, currentIndex) => {
      const teamId = field.id;
      const prevScoreValue = prevScoresRef.current[teamId];
      const prevTeamNameValue = prevTeamNamesRef.current[teamId];
      const prevPositionValue = prevPositionsRef.current[teamId];

      const teamNameChanged = prevTeamNameValue !== undefined && prevTeamNameValue !== field.team;
      const positionChanged = prevPositionValue !== undefined && prevPositionValue !== currentIndex;      // 順位変動の検出
      if (positionChanged) {
        if (prevPositionValue !== undefined && currentIndex < prevPositionValue) {
          newPositionChangesLocal[teamId] = 'up';
          console.log(`[Position Change] ${field.team} moved UP from ${prevPositionValue} to ${currentIndex}`);
        } else if (prevPositionValue !== undefined && currentIndex > prevPositionValue) {
          newPositionChangesLocal[teamId] = 'down';
          console.log(`[Position Change] ${field.team} moved DOWN from ${prevPositionValue} to ${currentIndex}`);
        }
      } else {
        newPositionChangesLocal[teamId] = null;
      }

      // スコア加算の検出 (field.addedScore を直接使用)
      if (field.addedScore && field.addedScore > 0) {
        newScoreChangesLocal[teamId] = field.addedScore;
      }

      // チーム名変更の検出
      if (teamNameChanged) {
        newTeamNameChangesLocal.push(teamId);
      }
    });

    let cleanupFunctions: Array<() => void> = [];

    // 1. チーム名変更のアニメーション状態を設定
    if (newTeamNameChangesLocal.length > 0) {
      setTeamNameChanges(newTeamNameChangesLocal);
      const nameTimer = setTimeout(() => setTeamNameChanges([]), 2000);
      cleanupFunctions.push(() => clearTimeout(nameTimer));
    }

    // 2. 順位変動のアニメーション状態を設定
    //    これが設定されたアイテムは、まずY軸スライドアニメーションを行う
    if (Object.keys(newPositionChangesLocal).some(key => newPositionChangesLocal[key] !== null)) {
      setPositionChanges(newPositionChangesLocal);
      const positionTimer = setTimeout(() => {
        setPositionChanges({});
        // 順位変動アニメーションが完了した後にスコア加算アニメーションを開始
        if (Object.keys(newScoreChangesLocal).length > 0) {
          setScoreChanges(newScoreChangesLocal);
          const scoreTimer = setTimeout(() => setScoreChanges({}), 2000); // スコア表示時間
          cleanupFunctions.push(() => clearTimeout(scoreTimer));
        }
      }, 700); // Yスライドアニメーション時間 (0.1s delay + 0.5s duration + 0.1s buffer)
      cleanupFunctions.push(() => clearTimeout(positionTimer));
    } else if (Object.keys(newScoreChangesLocal).length > 0) {
      // 順位変動がない場合は、直接スコア加算アニメーションを開始
      setScoreChanges(newScoreChangesLocal);
      const scoreTimer = setTimeout(() => setScoreChanges({}), 2000);
      cleanupFunctions.push(() => clearTimeout(scoreTimer));
    }
    
    // 選択中チームの情報更新
    if (selectedTeamInfo) {
      const updatedTeam = fields.find(field => field.team === selectedTeamInfo.name);
      if (updatedTeam && updatedTeam.id !== selectedTeamInfo.id) {
        setSelectedTeamInfo({ id: updatedTeam.id, name: updatedTeam.team });
      }
    }

    // このエフェクトの最後に、現在の fields の状態を次回の比較のために prevRefs に保存
    const updatedPrevScores: Record<string, number> = {};
    const updatedPrevTeamNames: Record<string, string> = {};
    const updatedPrevPositions: Record<string, number> = {};

    fields.forEach((field, currentIndex) => {
      updatedPrevScores[field.id] = field.score;
      updatedPrevTeamNames[field.id] = field.team;
      updatedPrevPositions[field.id] = currentIndex;
    });
    prevScoresRef.current = updatedPrevScores;
    prevTeamNamesRef.current = updatedPrevTeamNames;
    prevPositionsRef.current = updatedPrevPositions;
    console.log("[Main Effect] prevRefs updated at the end of the effect.");

    return () => cleanupFunctions.forEach(cleanup => cleanup());
  }, [fields, selectedTeamInfo, isReordering]); // isReordering を依存配列に追加

  // isCurrentPlayer を持つ可能性のあるフィールドの型を明示的にする
  // (FieldArrayWithId は元の型に id を追加するだけなので、isCurrentPlayer は含まれない)
  // そのため、fields を RaceResult[] として扱えるようにする (ただし id は別途考慮)
  // もしくは、TeamScore に isCurrentPlayer? を追加する (今回は types/index.ts で TeamScore に追加した)

  useEffect(() => {
    // fields が変更されるたびに isCurrentPlayer を持つチームを探す
    if (fields.length > 0) {
      const currentPlayerField = fields.find(
        (field) => field.isCurrentPlayer === true
      );

      if (currentPlayerField) {
        // isCurrentPlayer を持つチームが見つかった場合、selectedTeamInfo を更新
        // 既に同じチームが選択されている場合は再設定しない（無限ループ防止）
        if (!selectedTeamInfo || selectedTeamInfo.id !== currentPlayerField.id || selectedTeamInfo.name !== currentPlayerField.team) {
          setSelectedTeamInfo({
            id: currentPlayerField.id,
            name: currentPlayerField.team,
          });
        }
      } else {
        // isCurrentPlayer を持つチームが見つからなかった場合、selectedTeamInfo を null にする
        // (手動で別のチームを選択している場合を考慮し、null にするのは isCurrentPlayer が消えた場合のみ)
        // このロジックは、isCurrentPlayer が動的に変わる場合に必要
        // 今回は、isCurrentPlayer が外部から設定される想定なので、
        // isCurrentPlayer がない場合は、手動選択を維持するか、null にするかは要件次第。
        // ここでは、isCurrentPlayer が見つからなければ null にして、自動選択を優先する。
        if (selectedTeamInfo && !fields.some(f => f.isCurrentPlayer && f.id === selectedTeamInfo.id)) {
             setSelectedTeamInfo(null);
        }
      }
    } else {
      // fields が空になったら選択も解除
      setSelectedTeamInfo(null);
    }
  }, [fields, selectedTeamInfo]); // selectedTeamInfo も依存配列に追加

  // チームの最初の出現を追跡するためのマップ
  // ↓ここからグループ化ロジックに変更
  // fieldsをチーム名ごとにグループ化
  // const teamGroups = new Map<string, typeof fields>();
  // fields.forEach(field => {
  //   const teamKey = field.team || "Unassigned";
  //   if (!teamGroups.has(teamKey)) {
  //     teamGroups.set(teamKey, []);
  //   }
  //   teamGroups.get(teamKey)!.push(field);
  // });

  return (
    <>
      <AnimatePresence>
        <Reorder.Group
          axis="y"
          values={fields.map(field => field.id)}
          onReorder={() => {}}
          className="space-y-0 w-full max-w-md mx-auto"
        >
          {/* {Array.from(teamGroups.entries()).map(([teamKey, members]) => (
            <React.Fragment key={teamKey}>
              <div className="text-base font-semibold my-1 py-1 px-2 bg-slate-700/80 text-slate-200 rounded sticky top-0 z-10 shadow">
                {teamKey}
              </div>
              {members.map((item, index) => { */}
              {fields.map((item, index) => { // 直接 fields を map するように変更
                // fields内でのindexを取得
                // const globalIndex = fields.findIndex(f => f.id === item.id); // globalIndex は不要に
                const teamId = item.id;
                const hasTeamNameChanged = teamNameChanges.includes(teamId);
                const isTeamSelected = selectedTeamInfo &&
                  (selectedTeamInfo.id === teamId || selectedTeamInfo.name === item.team);
                return (
                  <Reorder.Item
                    ref={itemRefs.current[index]} // index を直接使用
                    key={item.id}
                    value={item.id}
                    dragListener={true}
                    onDragStart={() => {
                      setIsReordering(true);
                    }}
                    onDragEnd={(dragEvent, info) => {
                      const draggedItemY = info.point.y;
                      const otherItemsPositions = fields
                        .map((field, idx) => {
                          const ref = itemRefs.current[idx]; // idx を直接使用
                          if (ref && ref.current) {
                            const rect = ref.current.getBoundingClientRect();
                            return { id: field.id, y: rect.top + rect.height / 2, originalIndex: idx };
                          }
                          return null;
                        })
                        .filter(item => item !== null) as Array<{ id: string; y: number; originalIndex: number }>;

                      const draggedItemId = item.id;
                      let newIndex = 0;
                      const itemsWithoutDragged = otherItemsPositions.filter(p => p.id !== draggedItemId);
                      for (let i = 0; i < itemsWithoutDragged.length; i++) {
                        if (draggedItemY < itemsWithoutDragged[i].y) {
                          newIndex = i;
                          break;
                        }
                        newIndex = i + 1;
                      }
                      const newFieldsOrder = [...fields];
                      const draggedItemOriginalIndex = fields.findIndex(f => f.id === draggedItemId);
                      if (draggedItemOriginalIndex !== -1) {
                        const [draggedItemObject] = newFieldsOrder.splice(draggedItemOriginalIndex, 1);
                        newFieldsOrder.splice(newIndex, 0, draggedItemObject);
                        setValue("results", newFieldsOrder);
                      }
                      setTimeout(() => {
                        setIsReordering(false);
                      }, 50);
                    }}
                    className="relative"
                    layoutId={item.id}
                    layout="position"
                    initial={
                      // 初回レンダリング時のみフェードイン、または順位変動がない場合
                      // prevPositionsRef.current に item.id がまだ存在しない場合は初回とみなす
                      !prevPositionsRef.current[item.id] && !positionChanges[item.id]
                        ? { opacity: 0, y: 20 }
                        : { opacity: 1, y: 0 } // それ以外は現在の位置から
                    }
                    animate={
                      positionChanges[item.id]
                        ? {
                            y: positionChanges[item.id] === 'up' ? -25 : positionChanges[item.id] === 'down' ? 25 : 0,
                            opacity: 1,
                            transition: { type: "spring", stiffness: 300, damping: 30, delay: 0.05, duration: 0.5 },
                          }
                        : {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.3, ease: "easeOut" },
                          }
                    }
                    exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                  >
                    {/* 各チームの行 */}
                    <div
                      key={item.id}
                      className={`
                        h-12 flex items-center gap-1 px-2
                        border-0
                        rounded-lg
                        transition-all duration-200
                        ${hasTeamNameChanged ? 'shadow-blue-500/30' : ''}
                        ${isTeamSelected ? 'team-selected' : ''} {/* 行全体へのアニメーションは削除 */}
                        cursor-pointer
                        relative
                      `}>
                      {/* ダブルクリック用の透明な背景レイヤー */}                
                      <div
                        className="absolute inset-0 z-0"
                        onDoubleClick={() => {
                          if (isTeamSelected) {
                            // 既に選択されている場合は選択解除
                            setSelectedTeamInfo(null);
                          } else {
                            // 選択されていない場合は選択
                            setSelectedTeamInfo({
                              id: teamId,
                              name: item.team
                            });
                            
                            // チーム選択時のメッセージ表示
                            setShowTeamSelectedMessage(true);
                            
                            // 2秒後にメッセージを非表示
                            setTimeout(() => {
                              setShowTeamSelectedMessage(false);
                            }, 2000);
                          }
                        }}
                      ></div>                
                        
                      {/* チーム名入力 - 平行四辺形ラッパー */}
                      <div className={`
                        relative w-20 h-7 ${selectedTeamInfo && (selectedTeamInfo.id === item.id || selectedTeamInfo.name === item.team) ? 'animated-parallelogram-border' : 'static-parallelogram-border'}
                        overflow-visible
                        ${item.isCurrentPlayer ? `
                          
                          
                          
                          
                        ` : ''}
                      `}>
                        <div className="relative z-20 w-full h-full"> {/* z-20 to be above ::after */}
                          <Input
                            {...register(`results.${index}.team`, {
                              onBlur: (e) => {
                                const newTeamName = e.target.value;
                                if (newTeamName === "") {
                                  setTeamScoreList((prev) => prev.filter((teamItem) => teamItem.team !== item.team));
                                } else if (newTeamName !== item.team) {
                                  setTeamScoreList((prev) => prev.map((teamItem) => teamItem.team === item.team ? { ...teamItem, team: newTeamName } : teamItem));
                                }
                              },
                            })}
                            defaultValue={item.team}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            className="
                              w-full h-full text-center font-medium text-white
                              bg-transparent border-0 outline-none
                              focus:ring-0 focus:ring-offset-0
                              focus-visible:ring-0 focus-visible:ring-offset-0
                              [appearance:textfield] [&::-webkit-outer-spin-button] [&::-webkit-inner-spin-button]
                              whitespace-nowrap px-0.5
                            "
                            style={{ fontSize: item.team.length <= 3 ? '0.75rem' : '0.6rem' }}
                          />
                        </div>
                      </div>
                      
                      {/* スコア入力 - 平行四辺形ラッパー */}
                      <div className={`
                        relative w-16 h-7 score-box ${scoreChanges[item.id] ? 'score-flash-active' : ''} ${selectedTeamInfo && (selectedTeamInfo.id === item.id || selectedTeamInfo.name === item.team) ? 'animated-parallelogram-border' : 'static-parallelogram-border'}
                        overflow-visible
                        ${item.isCurrentPlayer ? `
                          
                          
                          
                          
                        ` : ''}
                      `}>
                        <div className="relative z-20 w-full h-full"> {/* z-20 to be above ::after */}
                          <Input
                            {...register(`results.${index}.score`, {
                              setValueAs: (value) => item.score
                            })}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {}}
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                              if (e.target.value !== "") {
                                const newScore = Number(e.target.value);
                                setValue(`results.${index}.score`, newScore);
                                setTeamScoreList((prev) => prev.map((teamItem) => teamItem.team === item.team ? { ...teamItem, score: newScore } : teamItem));
                              }
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            defaultValue={item.score || 0}
                            type="number"
                            className="
                              w-full h-full text-base text-center font-medium text-white
                              bg-transparent border-0 outline-none
                              focus:ring-0 focus:ring-offset-0
                              focus-visible:ring-0 focus-visible:ring-offset-0
                              [appearance:textfield] [&::-webkit-outer-spin-button] [&::-webkit-inner-spin-button]
                            "
                          />
                        </div>
                      </div>

                      {/* 加算点数表示 */}
                      {scoreChanges[item.id] && scoreChanges[item.id] > 0 && (
                        <div className="added-score-indicator text-green-400 font-bold text-sm ml-1">
                          +{scoreChanges[item.id]}
                        </div>
                      )}

                      {/* 差分スコア表示 */}
                      {(() => {
                        const myTeam = selectedTeamInfo ? fields.find(f => f.id === selectedTeamInfo.id) : undefined;

                        if (selectedTeamInfo && myTeam) {
                          // 自チームが選択されていて、かつ myTeam が見つかった場合
                          const isOwnTeam = selectedTeamInfo.id === item.id;
                          const scoreDiff = myTeam.score - item.score;
                          const diffText = isOwnTeam ? "" : (scoreDiff === 0 ? "0" : scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`);
                          const textColor = isOwnTeam ? 'text-transparent' : (scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : 'text-white');
                          const iconColor = isOwnTeam ? 'text-transparent' : (scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : (scoreDiff === 0 ? 'text-blue-300' : 'text-white'));

                          return (
                            <div
                              className={`
                                relative ${scoreChanges[item.id] ? 'ml-0' : 'ml-auto'} static-parallelogram-border
                                overflow-visible
                              `}
                            >
                              <div className={`
                                flex items-center gap-1 px-1.5 py-0.5
                                text-sm font-bold ${textColor}
                                relative z-10
                              `}>
                                {/* isOwnTeam の判定は selectedTeamInfo がある前提で行う */}
                                {!isOwnTeam && <Diff className={`h-3 w-3 ${iconColor}`} />}
                                <span className={isOwnTeam ? 'invisible' : ''}>{isOwnTeam ? '\u00A0' : diffText}</span>
                              </div>
                            </div>
                          );
                        } else if (fields.length !== index + 1) { // 自チームが選択されていない、または myTeam が見つからず、かつ最後のアイテムではない場合
                          const scoreDiff = fields[index].score - fields[index + 1].score;
                          const diffText = scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`;
                           // 従来のスタイルを維持するため、textColorの分岐は行わない（デフォルトの白系）
                          // text-white が基本で、Diffアイコンは text-blue-300
                          return (
                            <div
                              className={`
                                relative ${scoreChanges[item.id] ? 'ml-0' : 'ml-auto'} static-parallelogram-border
                              `}
                            >
                              <div className="
                                flex items-center gap-1 px-1.5 py-0.5
                                text-sm font-bold text-white
                                relative z-10
                              ">
                                <Diff className="h-3 w-3 text-blue-300" />
                                <span>{diffText}</span>
                              </div>
                            </div>
                          );
                        }
                        return null; // 上記以外の場合は何も表示しない
                      })()}
                      
                      {/* 選択中チームのマーカーは削除 */}
                    </div>
                  </Reorder.Item>
                );
              })}
            {/* </React.Fragment>
          ))} */}
        </Reorder.Group>
      </AnimatePresence>
      {/* チーム選択時のメッセージ表示 */}
      {showTeamSelectedMessage && selectedTeamInfo && (
        <div
          className="fixed bottom-4 right-4 bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg shadow-md"
        >
          {selectedTeamInfo.name} が選択されました
        </div>
      )}
    </>
  );
}
