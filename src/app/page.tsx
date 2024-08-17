"use client";

import { Button } from "@/components/ui/button";
import { useRef } from "react";

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

  const captureScreenshot = () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // スクリーンショットをデータURLとして取得
      const dataUrl = canvas.toDataURL("image/png");
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
