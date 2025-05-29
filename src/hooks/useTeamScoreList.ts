import { IMAGE_OPTIONS } from "@/constants/image";
import { RACE_POINT_SHEET } from "@/constants/mk8dx";
import { storage } from "@/infra/firebase";
import type {
  RaceResult,
  TeamScore,
  UploadImageToGeminiResponse, // Union Type
  // UploadImageToGeminiErrorResponse, // 型ガードで 'error' in obj を使うので直接は不要な場合も
  // UploadImageToGeminiSuccessResponse, // 同上
} from "@/types";
// import imageCompression from "browser-image-compression"; // 不要になるためコメントアウト
// import { getDownloadURL, ref, uploadBytes } from "firebase/storage"; // 不要になるためコメントアウト
import { useState } from "react";

// Helper function to normalize the first character of a team name
const normalizeInitialChar = (char: string): string => {
  let normalized = char.normalize("NFKC"); // Normalize to half-width
  // Replace Greek Alpha with Latin A
  if (normalized === "Α" || normalized === "α") {
    normalized = "A";
  }
  // Replace Cyrillic A with Latin A
  if (normalized === "А" || normalized === "а") {
    normalized = "A";
  }
  return normalized.toUpperCase();
};

export const useTeamScoreList = () => {
  const [teamScoreList, setTeamScoreList] = useState<TeamScore[]>([]);

  // スコアをサーバーに保存する関数
  const saveScoresToServer = async (scores: TeamScore[]): Promise<void> => {
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scores),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save scores: ${response.statusText}`);
      }
      
      console.log('Scores saved to server successfully');
    } catch (error) {
      console.error('Error saving scores to server:', error);
    }
  };

  // サーバーからスコアを取得する関数
  const loadScoresFromServer = async (): Promise<TeamScore[]> => {
    try {
      console.log('Loading scores from server...');
      const response = await fetch('/api/scores');
      
      if (!response.ok) {
        throw new Error(`Failed to load scores: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Loaded data from server:', JSON.stringify(data, null, 2));
      const scores = data.scores || [];
      
      // スコアが空配列の場合のログ出力を改善
      if (scores.length === 0) {
        console.log('No scores found or scores have been reset');
      } else {
        console.log('Returning scores:', JSON.stringify(scores, null, 2));
      }
      
      return scores;
    } catch (error) {
      console.error('Error loading scores from server:', error);
      return [];
    }
  };

  // Gemini APIに画像をアップロードして、文字起こしをしてもらう
  // この関数の戻り値の型注釈は UploadImageToGeminiResponse (Union Type) で正しい
  const uploadImageToGemini = async (
    base64ImageData: string,
  ): Promise<UploadImageToGeminiResponse> => {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl: base64ImageData }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "API Error with no JSON response" })); // errorキーに統一
      console.error("Gemini API Error Response:", errorData);
      // APIルートがエラー時に { success: false, error: string } を返すことを期待
      throw new Error(errorData.error || `API Error: ${response.statusText}`);
    }

    const data = await response.json(); // data は { success: boolean, response?: UploadImageToGeminiResponse, error?: string } の形

    if (!data.success) {
      console.error("Gemini API Call Unsuccessful:", data.error);
      throw new Error(data.error || "Gemini API call was not successful but did not return an error message.");
    }
    // data.response が UploadImageToGeminiResponse (Union Type) になる
    if (!data.response) {
        throw new Error("Gemini API call was successful but did not return a response body.");
    }
    return data.response;
  };

  // チームごとの合計点数と加算点数を計算する関数
  const calculateTeamScores = (
    prev: TeamScore[],
    results: RaceResult[],
  ): TeamScore[] => {
    const updatedTeamScoresMap = prev.reduce(
      (accumulator, currentTeamScore) => {
        // prev から isCurrentPlayer も引き継ぐようにする（ただし、今回のresultsで上書きされる可能性あり）
        accumulator[currentTeamScore.team] = {
          score: currentTeamScore.score,
          addedScore: 0,
          isCurrentPlayer: currentTeamScore.isCurrentPlayer || false // prevにない場合はfalse
        };
        return accumulator;
      },
      {} as Record<string, { score: number; addedScore: number; isCurrentPlayer: boolean }>,
    );

    for (const result of results) { // 'result' を使うように変更
      const point =
        RACE_POINT_SHEET.find(({ rank: r }) => r === result.rank)?.point ?? 0;
      const trimmedTeam = result.team.trim();
      // 正規化処理を修正
      const normalizedTeam = trimmedTeam && trimmedTeam.toUpperCase() !== "UNKNOWN" ? normalizeInitialChar(trimmedTeam.charAt(0)) : "UNKNOWN";
      if (!updatedTeamScoresMap[normalizedTeam]) {
        updatedTeamScoresMap[normalizedTeam] = { score: 0, addedScore: 0, isCurrentPlayer: result.isCurrentPlayer || false };
      } else {
        // 既存チームの場合、isCurrentPlayer は今回の結果で上書きする
        // 複数のプレイヤーが同じ正規化チーム名を持つ場合、isCurrentPlayer が true のプレイヤーがいれば true にする
        updatedTeamScoresMap[normalizedTeam].isCurrentPlayer = updatedTeamScoresMap[normalizedTeam].isCurrentPlayer || result.isCurrentPlayer || false;
      }
      updatedTeamScoresMap[normalizedTeam].score += point;
      updatedTeamScoresMap[normalizedTeam].addedScore += point;
    }

    return Object.entries(updatedTeamScoresMap).map(
      ([teamName, data]) => ({ // teamName と data に変更
        team: teamName, // ここは正規化後のチーム名が使われる
        score: data.score,
        addedScore: data.addedScore,
        isCurrentPlayer: data.isCurrentPlayer, // isCurrentPlayer を含める
      }),
    );
  };

  // チームごとの合計点数を取得する
  const getRaceResult = async (base64ImageData: string): Promise<void> => { // 戻り値の型を Promise<void> に明示
    try {
      const geminiApiResponse = await uploadImageToGemini(base64ImageData);

      // 型ガード: geminiApiResponse がエラー型 (error プロパティを持つ) かどうかをチェック
      if (geminiApiResponse && typeof geminiApiResponse === 'object' && 'error' in geminiApiResponse && typeof geminiApiResponse.error === 'string') {
        throw new Error(`Gemini analysis failed: ${geminiApiResponse.error}`);
      }

      // 型ガード: geminiApiResponse が成功型 (results プロパティを持つ) かどうかをチェック
      // また、results が配列であることを確認
      if (geminiApiResponse && typeof geminiApiResponse === 'object' && 'results' in geminiApiResponse && Array.isArray(geminiApiResponse.results)) {
        // ここでは geminiApiResponse は UploadImageToGeminiSuccessResponse と推論される (またはそうであるべき)
        // 各レースごとの加算点をリセットするために、新しい結果で addedScore を更新する
        const currentRaceResults = geminiApiResponse.results;
        setTeamScoreList((prev) => {
          const newScores = calculateTeamScores(prev, currentRaceResults);
          // 各チームの addedScore を今回のレースの点数のみにする
          const updatedScores = newScores.map(teamScore => {
            const raceResultForTeam = currentRaceResults.find(r => r.team === teamScore.team);
            const currentRacePoint = raceResultForTeam ? (RACE_POINT_SHEET.find(({ rank: r }) => r === raceResultForTeam.rank)?.point ?? 0) : 0;
            return {
              ...teamScore,
              addedScore: currentRacePoint,
            };
          });
          
          // サーバーに保存（非同期で実行）
          saveScoresToServer(updatedScores);
          
          return updatedScores;
        });
      } else {
        // 予期しない応答形式の場合
        throw new Error("Invalid or unexpected response structure from Gemini API.");
      }
    } catch (e: any) { // エラーをany型でキャッチ
      // エラーログはuploadImageToGemini内でも出力される場合があるが、ここでもキャッチ
      console.error("Error in getRaceResult (re-throwing):", e.message);
      throw e; // エラーを呼び出し元に再スローする
    }
  };

  // チームごとの合計点数を取得する (総合結果用)
  const getOverallTeamScores = async (base64ImageData: string): Promise<void> => {
    try {
      const geminiApiResponse = await uploadImageToGemini(base64ImageData);

      // 型ガード: geminiApiResponse がエラー型かチェック
      if (geminiApiResponse && typeof geminiApiResponse === 'object' && 'error' in geminiApiResponse && typeof geminiApiResponse.error === 'string') {
        throw new Error(`Gemini analysis failed: ${geminiApiResponse.error}`);
      }

      // 型ガード: geminiApiResponse が成功型で、results 配列を持つかチェック
      if (geminiApiResponse && typeof geminiApiResponse === 'object' && 'results' in geminiApiResponse && Array.isArray(geminiApiResponse.results)) {
        const raceResultsWithTotalScore: RaceResult[] = geminiApiResponse.results;

        // チームごとの合計得点を計算
        const teamTotalScoresMap: Record<string, { score: number; players: RaceResult[] }> = {};

        for (const result of raceResultsWithTotalScore) {
          // totalScore が数値であることを確認
          if (typeof result.totalScore !== 'number') {
            console.warn(`Player ${result.name} is missing totalScore. Skipping.`);
            continue;
          }
          const trimmedTeam = result.team.trim();
          // 正規化処理を修正
          const normalizedTeam = trimmedTeam && trimmedTeam.toUpperCase() !== "UNKNOWN" ? normalizeInitialChar(trimmedTeam.charAt(0)) : "UNKNOWN";
          if (!teamTotalScoresMap[normalizedTeam]) {
            teamTotalScoresMap[normalizedTeam] = { score: 0, players: [] };
          }
          teamTotalScoresMap[normalizedTeam].score += result.totalScore;
          // players 配列には元の result を格納する（必要に応じて正規化前のチーム名も参照できるように）
          teamTotalScoresMap[normalizedTeam].players.push(result);
        }

        const newTeamScores: TeamScore[] = Object.entries(teamTotalScoresMap).map(
          ([team, data]) => ({
            team, // ここは正規化後のチーム名が使われる
            score: data.score,
            // isCurrentPlayer はチーム単位で代表的なものを設定するか、別途ロジックが必要
            // ここでは最もランクの高いプレイヤーの isCurrentPlayer を使うか、あるいはチーム単位では設定しない
            isCurrentPlayer: data.players.some(p => p.isCurrentPlayer),
            // name はチームスコアの文脈では必須ではないため、オプショナルにした
          }),
        );
        setTeamScoreList(newTeamScores);
        
        // サーバーに保存（非同期で実行）
        saveScoresToServer(newTeamScores);

      } else {
        throw new Error("Invalid or unexpected response structure from Gemini API for overall scores.");
      }
    } catch (e: any) {
      console.error("Error in getOverallTeamScores:", e.message);
      throw e; // エラーを呼び出し元に再スローする
    }
  };

  return { teamScoreList, setTeamScoreList, getRaceResult, getOverallTeamScores, loadScoresFromServer, saveScoresToServer };
};
