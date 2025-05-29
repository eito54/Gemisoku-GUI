"use client";

import { useTeamScoreList } from "@/hooks/useTeamScoreList";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
// import { Form } from "./_components/Form"; // 通常のインポートをコメントアウト
import dynamic from "next/dynamic"; // dynamic をインポート
// import { recognizeTextFromImage } from "@/lib/ocr"; // OCRは使用しないためコメントアウト

// Form コンポーネントを動的にインポートし、SSRを無効化
const Form = dynamic(() => import("./_components/Form").then(mod => mod.Form), {
  ssr: false,
  loading: () => <div className="p-4 text-center">Loading form...</div>, // ローディング中の表示
});

// ScoreEditModal コンポーネントを動的にインポート
const ScoreEditModal = dynamic(() => import("./_components/ScoreEditModal").then(mod => mod.ScoreEditModal), {
  ssr: false,
});

// SearchParamsを使用するコンポーネントをSuspenseでラップ
function HomeContent() {
  const searchParams = useSearchParams();
  const isOverlayMode = searchParams.get('overlay') === 'true';
  const isEditMode = searchParams.get('edit') === 'true';
  
  const { setTeamScoreList, teamScoreList, getRaceResult, getOverallTeamScores, loadScoresFromServer, saveScoresToServer } = useTeamScoreList(); // saveScoresToServer を追加
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "「レース結果を取得」をクリックして開始してください。"
  );
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null); // ★ 追加
  const [lastDataTimestamp, setLastDataTimestamp] = useState<number>(0); // データ更新タイムスタンプ
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // 編集モーダルの状態

  // コンポーネント初期化時にサーバーからスコアを読み込む
  useEffect(() => {
    const initializeScores = async () => {
      try {
        console.log('Initializing scores...');
        const savedScores = await loadScoresFromServer();
        console.log('Retrieved savedScores:', savedScores);
        if (savedScores.length > 0) {
          console.log('Setting team score list with:', savedScores);
          setTeamScoreList(currentScores => {
            const currentHash = JSON.stringify(currentScores.map(s => ({team: s.team, score: s.score})).sort());
            const newHash = JSON.stringify(savedScores.map(s => ({team: s.team, score: s.score})).sort());
            
            if (currentHash !== newHash) {
              console.log('Initial data hash differs, updating teamScoreList');
              return savedScores;
            }
            
            console.log('Initial data hash same, keeping current');
            return currentScores;
          });
        } else {
          console.log('No saved scores found, keeping empty list');
        }
      } catch (error) {
        console.error('Failed to load scores from server:', error);
      }
    };

    initializeScores();
  }, []); // 依存配列を空にして初期化時のみ実行

  // オーバーレイモードの場合、定期的にサーバーからスコアを更新
  useEffect(() => {
    if (isOverlayMode) {
      console.log('Setting up overlay mode with periodic updates');
      const interval = setInterval(async () => {
        try {
          const savedScores = await loadScoresFromServer();
          
          // 現在のデータと新しいデータのハッシュ比較
          setTeamScoreList(currentScores => {
            const currentData = currentScores.map(s => ({team: s.team, score: s.score})).sort((a, b) => a.team.localeCompare(b.team));
            const newData = savedScores.map(s => ({team: s.team, score: s.score})).sort((a, b) => a.team.localeCompare(b.team));
            
            const currentHash = JSON.stringify(currentData);
            const newHash = JSON.stringify(newData);
            
            if (currentHash !== newHash) {
              // データ変更時のみログ出力
              console.log('Data updated');
              return savedScores;
            }
            
            // データ未変更時はログ出力なし
            return currentScores;
          });
        } catch (error) {
          console.error('Failed to refresh scores from server:', error);
        }
      }, 1500); // 1.5秒ごとに更新（リセット反映を高速化）

      return () => {
        console.log('Cleaning up overlay periodic updates');
        clearInterval(interval);
      };
    }
  }, [isOverlayMode]); // 関数の依存を削除してオーバーレイモードの変更時のみ実行

  // teamScoreListの変更を監視
  useEffect(() => {
    console.log('teamScoreList updated:', JSON.stringify(teamScoreList, null, 2));
  }, [teamScoreList]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("OBSからスクリーンショットを取得中...");

    const captureScreenshotByObs = async () => {
      const response = await fetch("/api/obs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "OBS APIリクエストに失敗しました" }));
        throw new Error(errData.error || `OBS APIリクエスト失敗: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success || !data.screenshot) {
        throw new Error(data.error || "OBSからスクリーンショットの取得に失敗しました");
      }
      return data.screenshot;
    };

    try {
      const obsResponseBase64 = await captureScreenshotByObs();
      setLastScreenshot(obsResponseBase64); // ★ スクリーンショットを保存
      setStatusMessage("Geminiで画像を分析中..."); // OCRステップを削除
      console.log("Gemini API分析を直接実行します。");

      await getRaceResult(obsResponseBase64); // この中で teamScoreList が更新される
      setError(null); // 成功時はエラークリア
      setStatusMessage("分析完了。次の取得の準備ができました。");
      console.info("Gemini分析が成功しました。");

    } catch (err: any) {
      console.error("データ取得または処理中にエラーが発生しました (page.tsx):", err);
      setError(err.message || "不明なエラーが発生しました。");
      setStatusMessage(`エラー: ${err.message}。次の取得の準備ができました。`);
    } finally {
      setIsLoading(false);
    }
  }, [getRaceResult, setTeamScoreList]);

  const handleFetchClick = () => {
    fetchData();
  };

  const handleFetchOverallScoresClick = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("OBSからスクリーンショットを取得中 (チーム合計)...");

    const captureScreenshotByObs = async () => {
      const response = await fetch("/api/obs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "OBS APIリクエストに失敗しました" }));
        throw new Error(errData.error || `OBS APIリクエスト失敗: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.success || !data.screenshot) {
        throw new Error(data.error || "OBSからスクリーンショットの取得に失敗しました");
      }
      return data.screenshot;
    };

    try {
      const obsResponseBase64 = await captureScreenshotByObs();
      setLastScreenshot(obsResponseBase64);
      setStatusMessage("Geminiで画像を分析中 (チーム合計)...");
      
      await getOverallTeamScores(obsResponseBase64); // ★ チーム合計点取得関数を呼び出し
      setError(null);
      setStatusMessage("チーム合計点の分析完了。");
      console.info("チーム合計点のGemini分析が成功しました。");

    } catch (err: any) {
      console.error("チーム合計点取得または処理中にエラーが発生しました (page.tsx):", err);
      setError(err.message || "不明なエラーが発生しました。");
      setStatusMessage(`エラー: ${err.message}。`);
    } finally {
      setIsLoading(false);
    }
  };

  let mainContent;
  if (teamScoreList.length > 0) {
    mainContent = (
      <Form
        teamScoreList={teamScoreList}
        setTeamScoreList={setTeamScoreList}
        lastScreenshot={lastScreenshot} // ★ 追加
      />
    );
  } else if (isLoading) {
    // ローディング表示はボタン内に統合するため何も表示しない
    mainContent = null;
  } else if (error) {
    // エラー表示もボタン内に含める/非表示にする
    mainContent = null;
    // エラーが発生していてもコンソールにのみ表示
    console.error("エラー:", error);
  } else {
    // 初期状態も非表示
    mainContent = null;
  }

  // 編集モードの場合は、編集モーダルを常に表示
  if (isEditMode) {
    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-gray-900">
        <ScoreEditModal
          isOpen={true}
          onClose={() => {
            // 編集モードでは閉じる代わりにページを再読み込み
            window.location.href = window.location.href.replace('&edit=true', '').replace('?edit=true', '');
          }}
          teamScoreList={teamScoreList}
          setTeamScoreList={setTeamScoreList}
          saveScoresToServer={saveScoresToServer}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* ボタンのみを表示するバー - オーバーレイモードでは完全に非表示 */}
      {!isOverlayMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2">
        <button
          onClick={handleFetchClick}
          disabled={isLoading}
          className="bg-blue-600/90 hover:bg-blue-700/90 disabled:bg-slate-700/90
                    backdrop-blur-sm
                    text-white font-medium px-5 py-2.5 rounded-md
                    transition-all duration-200 shadow-lg
                    disabled:text-slate-300 disabled:cursor-not-allowed
                    flex items-center justify-center min-w-[180px]"
        >
          {isLoading && statusMessage?.includes("レース結果") ? (
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full border-3 border-white border-t-transparent animate-spin mb-1"></div>
              <span className="text-sm">{statusMessage}</span>
            </div>
          ) : error && statusMessage?.includes("レース結果") ? (
            <div className="flex flex-col items-center">
              <span className="text-red-300 font-bold">エラー発生</span>
              <span className="text-xs text-red-200/80 max-w-[170px] truncate">{error}</span>
            </div>
          ) : (
            <span className="font-bold">📊 レース結果を取得</span>
          )}
        </button>
        <button
          onClick={handleFetchOverallScoresClick}
          disabled={isLoading}
          className="bg-green-600/90 hover:bg-green-700/90 disabled:bg-slate-700/90
                    backdrop-blur-sm
                    text-white font-medium px-5 py-2.5 rounded-md
                    transition-all duration-200 shadow-lg
                    disabled:text-slate-300 disabled:cursor-not-allowed
                    flex items-center justify-center min-w-[180px]"
        >
          {isLoading && statusMessage?.includes("チーム合計") ? (
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full border-3 border-white border-t-transparent animate-spin mb-1"></div>
              <span className="text-sm">{statusMessage}</span>
            </div>
          ) : error && statusMessage?.includes("チーム合計") ? (
            <div className="flex flex-col items-center">
              <span className="text-red-300 font-bold">エラー発生</span>
              <span className="text-xs text-red-200/80 max-w-[170px] truncate">{error}</span>
            </div>
          ) : (
            <span className="font-bold">🏆 チーム合計点を取得</span>
          )}
        </button>
        <button
          onClick={() => setIsEditModalOpen(true)}
          disabled={isLoading}
          className="bg-purple-600/90 hover:bg-purple-700/90 disabled:bg-slate-700/90
                    backdrop-blur-sm
                    text-white font-medium px-5 py-2.5 rounded-md
                    transition-all duration-200 shadow-lg
                    disabled:text-slate-300 disabled:cursor-not-allowed
                    flex items-center justify-center min-w-[120px]"
        >
          <span className="font-bold">⚙️ 得点編集</span>
        </button>
        </div>
      )}
      
      {/* メインコンテンツ - 完全透過 */}
      <div className="w-full mx-auto mt-8"> {/* pt-4 から mt-8 に変更してトップマージンを増加 */}
        {teamScoreList.length > 0 ? (
          <div className="bg-transparent">
            {mainContent}
          </div>
        ) : null}
      </div>

      {/* 得点編集モーダル */}
      <ScoreEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        teamScoreList={teamScoreList}
        setTeamScoreList={setTeamScoreList}
        saveScoresToServer={saveScoresToServer}
      />
    </div>
  );
}

// ホームページコンポーネント - HomeContentをSuspenseでラップして再エクスポート
export default function Home() {
  return (
    <main className="min-h-screen bg-transparent p-4 flex flex-col">
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-transparent">
          <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
        </div>
      }>
        <HomeContent />
      </Suspense>
    </main>
  );
}
