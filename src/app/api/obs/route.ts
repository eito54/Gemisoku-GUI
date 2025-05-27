import type { NextRequest } from "next/server";
import { OBSWebSocket } from "obs-websocket-js";

export async function POST(request: NextRequest) {
  const obs = new OBSWebSocket();

  try {
    const obsIp = process.env.OBS_IP;
    const obsPort = process.env.OBS_PORT || '4455';
    const obsPassword = process.env.OBS_PASSWORD || '';
    const obsSourceName = process.env.OBS_SOURCE_NAME;

    if (!obsIp || !obsSourceName) {
      console.error(
        "OBS_IP or OBS_SOURCE_NAME is not defined in .env",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "OBS_IP or OBS_SOURCE_NAME is not defined",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log(`Connecting to OBS at ws://${obsIp}:${obsPort}...`);
    
    if (obsPassword && obsPassword.trim() !== '') {
      console.log('Connecting to OBS with authentication...');
      await obs.connect(`ws://${obsIp}:${obsPort}`, obsPassword);
    } else {
      console.log('Connecting to OBS without authentication...');
      await obs.connect(`ws://${obsIp}:${obsPort}`);
    }
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OBS connection failed:", errorMessage);
    console.error("Full error:", error);
    
    let userMessage = "OBS接続エラーが発生しました";
    
    if (error instanceof Error) {
      if ((error as any).code === 'ECONNREFUSED') {
        userMessage = `OBS WebSocketサーバーに接続できません。OBSが起動していて、WebSocketサーバーが有効になっているか確認してください。\n設定: ws://${process.env.OBS_IP}:${process.env.OBS_PORT || '4455'}`;
      } else if (error.message.includes('Authentication Failed')) {
        userMessage = "OBS WebSocketの認証に失敗しました。パスワードが正しいか確認してください。";
      } else if (error.message.includes('Unsupported protocol')) {
        userMessage = "WebSocketプロトコルエラーです。OBS WebSocketプラグインが正しくインストールされているか確認してください。";
      }
    }
    
    console.error("OBS API Error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      details: errorMessage
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    try {
      obs.disconnect();
    } catch (disconnectError: unknown) {
      const disconnectMessage = disconnectError instanceof Error ? disconnectError.message : String(disconnectError);
      console.warn("OBS disconnect warning:", disconnectMessage);
    }
  }
}
