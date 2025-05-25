import { geminiVision } from "@/infra/gemini";
import type { NextRequest } from "next/server";
import { GoogleGenerativeAIError } from "@google/generative-ai";
import type { TeamScore } from "@/types";

// Function to convert base64 data URL to Part object for Gemini API
function fileToGenerativePart(base64Data: string) {
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

// New prompt specifically for extracting total scores
const TOTAL_SCORE_PROMPT = `
  ## instruction ##
  これは「マリオカート8DX」のレース結果画面の画像です。
  画像を解析して、全プレイヤーのユーザー名、チーム情報、および画面右端に表示されている総合得点を抽出してください。
  総合得点は、各プレイヤーの行の一番右に表示されている数字です。
  指定されたJSON形式で出力してください。

  ## extraction_rules ##
  - [name]: プレイヤーのユーザー名をそのまま抽出してください。
  - [team]: 以下のルールでチーム名を識別してください：
    
    1. まず、全プレイヤー名を確認し、名前の後ろに共通する単語パターンがあるか調べてください。
       例：「チーズバーガー」「てりやきバーガー」「つるみバーガー」などの場合、「バーガー」が共通部分
    
    2. 複数のプレイヤーで共通の単語が末尾にある場合、その単語をチーム名として使用してください。
       例：「チーズバーガー」「てりやきバーガー」→ チーム名「バーガー」
    
    3. 同様に「レッドゾーンX」「レッドゾーンZ」「レッドゾーン☆」のように共通の接頭辞がある場合、
       その共通部分をチーム名として使用してください。
       例：「レッドゾーンX」「レッドゾーンZ」→ チーム名「レッドゾーン」
    
    4. 「I\\\'m Kotaro」「I\\\'m Masaya」「I\\\'m Tomoya」のように、共通部分がある場合は
       その共通部分をチーム名として使用してください。
       例：「I\\\'m Kotaro」「I\\\'m Masaya」→ チーム名「I\\\'m」
    
    5. 上記のパターンが見つからず、共通のチーム名が特定できない場合は、従来通りユーザー名の
       最初の1文字をチーム名として使用してください：
       - アルファベット大文字（例：「ABCD」→「A」）
       - アルファベット小文字（例：「abcd」→「a」）
       - ひらがな（例：「あいう」→「あ」）
       - カタカナ（例：「アイウ」→「ア」）
       - 数字（例：「123」→「1」）
    
    6. 空白や特殊文字のみの場合は "UNKNOWN" としてください
  - [total_score]: プレイヤーの総合得点を整数で抽出してください。これは通常、各プレイヤー行の最も右側に表示される数字です。
  - [isCurrentPlayer]: プレイヤーの行の背景が黄色かどうかを判別してください。
    - 黄色背景は、そのプレイヤーが操作プレイヤー（マイプレイヤー）であることを示します。
    - 黄色背景が検出された場合、true を設定してください。それ以外の場合は false を設定してください。(boolean値で返す)
    - 背景色は完全な黄色 (#FFFF00) ではない可能性があります。濃い黄色やオレンジに近い黄色も黄色背景とみなしてください。
    - 透明度や他の色との混合により、判別が難しい場合があるため、慎重に判断してください。明らかに黄色系の背景と識別できる場合にのみ true としてください。


  ## output_format ##
  以下のJSON形式で、全プレイヤーの情報を "results" 配列に含めてください。
  もし、提供された画像が「マリオカート8DX」のリザルト画面ではない、またはリザルト情報を読み取れない場合は、代わりに以下の形式のエラーJSONを出力してください:
  {
    "error": "リザルト画面ではないか、情報を読み取れませんでした。"
  }

  リザルト情報が読み取れる場合のJSON形式 (キーと値はダブルクォートで囲んでください):
  {
    "results": [
      {
        "name": "[name]",
        "team": "[team]", // ★ team を追加
        "score": [total_score], // "score" キーを使用
        "isCurrentPlayer": [isCurrentPlayer] // boolean (true/false) を直接記述
      }
      // ... 他のプレイヤー情報が続く
    ]
  }
  ## important_notes ##
  - 必ず指定されたJSON形式のいずれかで応答してください。
  - ユーザー名は画像に表示されている通りに正確に抽出してください。
  - プレイヤーは最大12人です。画像に表示されている全プレイヤーの情報を抽出してください。
  - 総合得点の抽出を最優先してください。
  - チーム名の判別は非常に重要です。同じチームに所属するプレイヤーが同じチーム名になるよう注意してください。
`;


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrl = body.imageUrl; // Assuming imageUrl is a base64 data URL
    const useTotalScore = request.nextUrl.searchParams.get("useTotalScore") === "true";

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ message: "API Error: imageUrl is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const imagePart = fileToGenerativePart(imageUrl);
    
    // Determine which prompt to use
    // For this specific route, we are always aiming to get total scores if useTotalScore is true.
    // The original PROMPT from constants/prompt.ts is for individual race scores and team name derivation.
    // We need a prompt that specifically asks for the total score column.
    // Let's assume the client will send a specific image for total score updates.

    if (!useTotalScore) {
        // This case should ideally not be hit if the button is specifically for total scores.
        // Or, this API route could be generalized if needed, but for now, let's focus on total scores.
        // We can use the existing gemini route for regular score updates.
        // For simplicity, if useTotalScore is not true, we might return an error or use a default prompt.
        // However, the user's request is to fetch *total scores*.
        // So, this route should primarily handle that.
        // Let's redirect or suggest using the other API for incremental scores.
         return new Response(
        JSON.stringify({ message: "API Error: This endpoint is for fetching total scores. Use /api/gemini for incremental scores." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Use the new prompt for total scores
    const result = await geminiVision.generateContent([TOTAL_SCORE_PROMPT, imagePart]);
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

    const cleanedText = text
      .replaceAll("\\n", "")
      .replaceAll("```json", "")
      .replaceAll("```", "");

    console.log("Gemini API raw response (total scores) (cleaned):", cleanedText);

    try {
      const parsedResponse = JSON.parse(cleanedText);
      
      // Transform the response to match TeamScore[] structure if needed
      // The TOTAL_SCORE_PROMPT asks for "name" and "score".
      // We need to derive "team" and "addedScore" (which will be 0).
      // For "team", we can use the first letter of the name as a fallback,
      // or implement more complex logic if team names are also present in the total score view.
      // For now, let's assume the prompt gives us "name" and "score".

      if (parsedResponse.error) {
        return new Response(JSON.stringify({ success: false, error: parsedResponse.error }), {
          status: 500, // Or a more appropriate error code
          headers: { "Content-Type": "application/json" },
        });
      }
      
      const transformedResults: TeamScore[] = parsedResponse.results.map((player: any, index: number) => ({
        id: player.name + index, // Create a simple unique ID
        rank: index + 1, // Rank based on order, or derive if available
        name: player.name,
        team: player.team || player.name.charAt(0) || "UNKNOWN", // ★ player.team を優先的に使用
        score: parseInt(player.score, 10) || 0,
        addedScore: 0, // Total score update means no "added" score for this transaction
        isCurrentPlayer: player.isCurrentPlayer === true,
      }));

      const json = JSON.stringify({
        success: true,
        // response: parsedResponse, // Return the transformed results
        response: { results: transformedResults }, // Ensure the structure matches what the frontend expects
      });
      return new Response(json, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (parseError) {
      console.error("Error parsing Gemini API response (total scores):", parseError);
      console.error("Original text from Gemini (total scores):", text);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse response from Gemini API for total scores.",
          geminiResponse: cleanedText,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: any) {
    console.error("Gemini API Error (total scores route):", error);
    let errorMessage = "An unknown error occurred with Gemini API (total scores route)";
    let statusCode = 500;

    if (error instanceof GoogleGenerativeAIError) {
      errorMessage = `Gemini API Error: ${error.message}`;
      if ('status' in error && typeof error.status === 'number') {
        statusCode = error.status === 429 ? 429 : error.status;
        if (error.status === 429) {
            errorMessage = "Gemini API Error: Too Many Requests. Please wait a moment and try again. (Rate limit exceeded)";
        }
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
  }
}
