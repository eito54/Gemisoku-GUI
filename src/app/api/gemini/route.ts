import { PROMPT } from "@/constants/prompt";
import { geminiVision } from "@/infra/gemini"; // geminiVision をインポート
import type { NextRequest } from "next/server";
import { GoogleGenerativeAIError } from "@google/generative-ai";

// Function to convert base64 data URL to Part object for Gemini API
function fileToGenerativePart(base64Data: string) {
  // Expected format: "data:[<mediatype>];base64,<data>"
  const match = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!match || match.length !== 3) {
    throw new Error("Invalid base64 data URL format.");
  }
  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrl = body.imageUrl; // Assuming imageUrl is a base64 data URL

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ message: "Gemini Error: imageUrl is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const imagePart = fileToGenerativePart(imageUrl);

    const result = await geminiVision.generateContent([PROMPT, imagePart]);
    const response = result.response;
    const text = response.text();

    if (!text) {
      return new Response(
        JSON.stringify({ message: "Gemini Error: No response content" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Assuming the response from Gemini is a JSON string
    // Clean up the response string if necessary, similar to the chatgpt route
    const cleanedText = text
      .replaceAll("\n", "")
      .replaceAll("```json", "") // More specific replacement
      .replaceAll("```", "");

    console.log("Gemini API raw response (cleaned):", cleanedText); // レスポンス内容をログに出力

    try {
      const parsedResponse = JSON.parse(cleanedText);
      const json = JSON.stringify({
        success: true,
        response: parsedResponse,
      });
      return new Response(json, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (parseError) {
      console.error("Error parsing Gemini API response:", parseError);
      console.error("Original text from Gemini:", text); // 元のテキストもログに出力
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse response from Gemini API. The response was not valid JSON.",
          geminiResponse: cleanedText, // クライアントにも一部返す（デバッグ用）
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: any) { // エラーをany型でキャッチ
    console.error("Gemini API Error (outer catch):", error);
    let errorMessage = "An unknown error occurred with Gemini API";
    let statusCode = 500; // デフォルトのステータスコード

    if (error instanceof GoogleGenerativeAIError) {
      errorMessage = `Gemini API Error: ${error.message}`;
      // 'status' プロパティの存在を型ガードで確認
      if ('status' in error && typeof error.status === 'number') {
        if (error.status === 429) {
          errorMessage = "Gemini API Error: Too Many Requests. Please wait a moment and try again. (Rate limit exceeded)";
          statusCode = 429;
        } else {
          // 他のHTTPステータスコードがあればそれを使用
          statusCode = error.status;
        }
      }
      // 'cause' プロパティの存在も確認 (オプション)
      if ('cause' in error && error.cause) {
        console.error("Gemini API Error Cause:", error.cause);
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } // This closes the outer try-catch block
} // This closes the POST function