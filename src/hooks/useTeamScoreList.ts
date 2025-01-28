import { IMAGE_OPTIONS } from "@/constants/image";
import { RACE_POINT_SHEET } from "@/constants/mk8dx";
import { storage } from "@/infra/firebase";
import type {
  RaceResult,
  TeamScore,
  UploadImageToChatGptResponse,
} from "@/types";
import imageCompression from "browser-image-compression";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";

export const useTeamScoreList = () => {
  const [teamScoreList, setTeamScoreList] = useState<TeamScore[]>([]);

  // 画像をアップロードする
  const uploadImage = async (blob: Blob) => {
    try {
      // BlobをFile形式に変換（ファイル名とtypeが必要）
      const file = new File([blob], "image.jpg", { type: "image/jpeg" });

      // 画像を圧縮する
      const compressedFile = await imageCompression(file, IMAGE_OPTIONS);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      const storageRef = ref(
        storage,
        `images/${year}${month}/${Date.now()}.jpg`,
      );
      const res = await uploadBytes(storageRef, compressedFile);

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
  const calculateTeamScores = (
    prev: TeamScore[],
    results: RaceResult[],
  ): TeamScore[] => {
    const updatedTeamScoresMap = prev.reduce(
      (accumulator, { team, score }) => {
        accumulator[team] = score;
        return accumulator;
      },
      {} as Record<string, number>,
    );

    // 新しい結果を加算
    for (const { team, rank } of results) {
      const point =
        RACE_POINT_SHEET.find(({ rank: r }) => r === rank)?.point ?? 0;

      // チームがまだ存在しない場合は初期化
      if (!updatedTeamScoresMap[team]) {
        updatedTeamScoresMap[team] = 0;
      }

      // 既存の点数に新しい点数を加算
      updatedTeamScoresMap[team] += point;
    }

    // MapをTeamScore形式の配列に変換して返す
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

      setTeamScoreList((prev) => calculateTeamScores(prev, response.results));
    } catch (e) {
      console.error(e);
    }
  };

  return { teamScoreList, setTeamScoreList, getRaceResult };
};
