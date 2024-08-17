"use client";

import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { storage } from "./infra/firebase";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const captureScreenshot = async () => {
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
      const dataUrl = canvas.toDataURL("image/jpg");

      const storageRef = ref(storage, "images/" + Date.now() + ".jpg");
      const res = await uploadString(storageRef, dataUrl, "data_url");

      const imageUrl = await getDownloadURL(
        ref(storage, res.metadata.fullPath),
      );

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

      console.log(await visionApiRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <video controls={true} autoPlay={true} ref={videoRef} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <Button type="button" onClick={submit}>
        ボタン
      </Button>
      <Button type="button" onClick={captureScreenshot}>
        スクショ
      </Button>
    </main>
  );
}
