import { RACE_POINT_SHEET } from "@/constants/mk8dx";
import { storage } from "@/infra/firebase";
import type {
  RaceResult,
  TeamScore,
  UploadImageToChatGptResponse,
} from "@/types";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";

export const useTeamScoreList = () => {
  const [teamScoreList, setTeamScoreList] = useState<TeamScore[]>([]);

  // 画像をアップロードする
  const uploadImage = async (blob: Blob) => {
    try {
      const storageRef = ref(storage, `images/${Date.now()}.jpg`);
      const res = await uploadBytes(storageRef, blob);

      if (!res || !res.metadata.fullPath) {
        throw new Error("Upload Error");
      }

      const imageUrl = await getDownloadURL(
        ref(storage, res.metadata.fullPath),
      );

      return imageUrl;
    } catch (e) {
      console.error(e);
    }
  };

  // chatGPTに画像をアップロードして、文字起こしをしてもらう
  const uploadImageToChatGpt = async (
    imageUrl: string,
  ): Promise<UploadImageToChatGptResponse> => {
    const response = await fetch("/api/chatgpt", {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      throw new Error("API Error");
    }

    const data = await response.json();

    return data.response;
  };

  // チームごとの合計点数を計算する関数
  const calculateTeamScores = (results: RaceResult[]): TeamScore[] => {
    const updatedTeamScoresMap = {
      ...teamScoreList.reduce(
        (accumulator, { team, score }) => {
          accumulator[team] = score;
          return accumulator;
        },
        {} as Record<string, number>,
      ),
    };

    for (const { team, rank } of results) {
      const point =
        RACE_POINT_SHEET.find(({ rank: r }) => r === rank)?.point ?? 0;

      if (!updatedTeamScoresMap[team]) {
        updatedTeamScoresMap[team] = 0;
      }

      updatedTeamScoresMap[team] += point;
    }

    return Object.entries(updatedTeamScoresMap).map(([team, score]) => ({
      team,
      score,
    }));
  };

  // チームごとの合計点数を取得する
  const getRaceResult = async (blob: Blob) => {
    try {
      const imageUrl = await uploadImage(blob);

      if (!imageUrl) {
        throw new Error("Upload Error");
      }

      const response = await uploadImageToChatGpt(imageUrl);

      if (!response) {
        throw new Error("ChatGPT Error");
      }

      const teamScores = calculateTeamScores(response.results);
      setTeamScoreList(teamScores);
    } catch (e) {
      console.error(e);
    }
  };

  return { teamScoreList, setTeamScoreList, getRaceResult };
};
