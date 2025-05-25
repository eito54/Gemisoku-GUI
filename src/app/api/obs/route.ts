import type { NextRequest } from "next/server";
import { OBSWebSocket } from "obs-websocket-js";

export async function POST(request: NextRequest) {
  const obs = new OBSWebSocket();

  try {
    const obsIp = process.env.OBS_IP;
    const obsPassword = process.env.OBS_PASSWORD;

    const obsSourceName = process.env.OBS_SOURCE_NAME;

    if (!obsIp || !obsPassword || !obsSourceName) {
      console.error(
        "OBS_IP, OBS_PASSWORD or OBS_SOURCE_NAME is not defined in .env.local",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "OBS_IP, OBS_PASSWORD or OBS_SOURCE_NAME is not defined",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    await obs.connect(`http://${obsIp}:4455`, obsPassword);
    console.info("Connected to OBS WebSocket");

    // 現在のプレビューを取得してスクリーンショットを保存
    const response = await obs.call("GetSourceScreenshot", {
      sourceName: obsSourceName,
      imageFormat: "png",
    });

    return new Response(
      JSON.stringify({ success: true, screenshot: response.imageData }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error connecting to OBS WebSocket:", error);
    return new Response(JSON.stringify({ success: false, error: error }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    obs.disconnect();
  }
}
