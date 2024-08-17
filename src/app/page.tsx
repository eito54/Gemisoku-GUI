"use client";

import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./infra/firebase";
import { googleVisionClient } from "./infra/gcp";

type DataItem = string;
type InputArray = DataItem[][];
type Result = { label: string; value: number };

function calculateSums(data: InputArray): Result[] {
  const resultMap: { [key: string]: number } = {};

  data.forEach((subArray) => {
    // 数字部分を抽出する
    const numStr = subArray.find(
      (item) => typeof item === "string" && /^\d+$/.test(item as string),
    );
    const num = numStr ? parseInt(numStr as string, 10) : 0;

    // 頭文字部分を抽出する
    const labelStr = subArray.find(
      (item) => typeof item === "string" && /^[A-Za-z]/.test(item as string),
    );
    const label = labelStr
      ? (labelStr as string).charAt(0).toUpperCase()
      : null;

    // 頭文字が存在する場合、結果を集計
    if (label) {
      if (!resultMap[label]) {
        resultMap[label] = 0;
      }
      resultMap[label] += num;
    }
  });

  // 結果をラベルと値の配列として返却
  return Object.keys(resultMap).map((label) => ({
    label: label,
    value: resultMap[label],
  }));
}

function newExtra(
  response: Awaited<ReturnType<typeof googleVisionClient.textDetection>>,
) {
  const DATA = response[0].textAnnotations!;
  const sortedData = DATA.map((item) => {
    return {
      description: item.description,
      // @ts-expect-error
      y:(item.boundingPoly!.vertices[0]!.y + item.boundingPoly!.vertices[2]!.y) / 2,
    };
  }).sort((a, b) => a.y - b.y);

  const groupedData: string[][] = [];

  const threshold = 10;

  let i = 0;
  while (i < sortedData.length) {
    let currentGroup = [sortedData[i].description];
    let currentY = sortedData[i].y;

    let j = i + 1;
    while (
      j < sortedData.length &&
      Math.abs(sortedData[j].y - currentY) <= threshold
    ) {
      currentGroup.push(sortedData[j].description);
      j++;
    }
    // @ts-expect-error ahi
    groupedData.push(currentGroup);
    i = j; // jの位置に移動し、処理済み要素を飛ばす
  }

  // 配列の中身が1つのものを削除
  const result = groupedData.filter((group) => group.length > 1);
  // const result = groupedData
  console.log("result", result);
  return result;
}

interface Preview {
  imageUrl: string;
  status: "win" | "lose" | "idle";
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview1, setPreview1] = useState<Preview>();
  const [preview2, setPreview2] = useState<Preview>();

  const submit = async () => {
    const captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window",
      },
    });

    if (!videoRef || videoRef.current === null) {
      return;
    }

    videoRef.current.srcObject = captureStream;
  };
  // 画像をアップロードする
  const uploadImage = async (image: Blob) => {
    const storageRef = ref(storage, "images/" + Date.now() + ".jpg");
    const res = await uploadBytes(storageRef, image);
    const url = await getDownloadURL(ref(storage, res.metadata.fullPath));

    return url;
  };
  const detectVision = async (imageUrl: string) => {
    const visionApiRes = await fetch("/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!visionApiRes.ok) {
      throw new Error("API Error");
    }

    return visionApiRes.json();
  };
  const captureScreenshot = async () => {
    setPreview1({ imageUrl: "", status: "idle" });
    setPreview2({ imageUrl: "", status: "idle" });
    try {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // スクリーンショットをデータURLとして取得
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg"),
      );

      const formData = new FormData();
      formData.append("file", blob as Blob);

      const resizeImageResponses = await Promise.all([
        fetch("/api/keisukeModel", {
          method: "POST",
          body: formData,
        }),
        fetch("/api/fukkeModel", {
          method: "POST",
          body: formData,
        }),
      ]);

      if (!resizeImageResponses[0].ok || !resizeImageResponses[1].ok) {
        throw new Error("API Error");
      }

      const [preview1, preview2] = await Promise.all(
        resizeImageResponses.map(async (response) => {
          const blob = await response.blob();
          const imageUrl = await uploadImage(blob);
          return imageUrl;
        }),
      );
      setPreview1({ imageUrl: preview1, status: "idle" });
      setPreview2({ imageUrl: preview2, status: "idle" });

      const [json1, json2] = await Promise.all([
        detectVision(preview1),
        detectVision(preview2),
      ]);

      const formattedData1 = newExtra(json1);
      const formattedData2 = newExtra(json2);

      let selectedData: InputArray = [];
      let closestDifference = Infinity;

      for (const formattedData of [formattedData1, formattedData2]) {
        const dataCount = formattedData.length;
        const difference = Math.abs(dataCount - 12);

        if (difference < closestDifference) {
          closestDifference = difference;
          selectedData = formattedData;
        } else if (difference === closestDifference) {
          closestDifference = difference;
          selectedData = formattedData;
        }
      }

      if (selectedData === formattedData1) {
        setPreview1({ imageUrl: preview1, status: "win" });
        setPreview2({ imageUrl: preview2, status: "lose" });
      } else {
        setPreview1({ imageUrl: preview1, status: "lose" });
        setPreview2({ imageUrl: preview2, status: "win" });
      }

      console.log("format", calculateSums(selectedData));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <video controls={true} autoPlay={true} ref={videoRef} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div className="grid grid-cols-2 gap-2">
        {preview1 && (
          <div>
            <img
              src={preview1.imageUrl}
              alt="preview1"
              className={
                preview1.status === "win" ? "border-4 border-red-500" : ""
              }
            />
            {preview1.status === "win" && <p>勝ち</p>}
          </div>
        )}
        {preview2 && (
          <div>
            <img
              src={preview2.imageUrl}
              alt="preview2"
              className={
                preview2.status === "win" ? "border-4 border-red-500" : ""
              }
            />
            {preview2.status === "win" && <p>勝ち</p>}
          </div>
        )}
      </div>
      <Button type="button" onClick={submit}>
        ボタン
      </Button>
      <Button type="button" onClick={captureScreenshot}>
        スクショ
      </Button>
    </main>
  );
}
