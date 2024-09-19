import { PROMPT } from "@/constants/prompt";
import { openAi } from "@/infra/openAi";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await openAi.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PROMPT,
            },
            {
              type: "image_url",
              image_url: {
                url: body.imageUrl,
              },
            },
          ],
        },
      ],
    });

    if (!response.choices[0].message.content) {
      return new Error("chatGpt Error: No response content");
    }

    const json = JSON.stringify({
      success: true,
      response: JSON.parse(
        response.choices[0].message.content
          .replaceAll("\n", "")
          .replaceAll("```", "")
          .replace("json", ""),
      ),
    });

    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("chatGpt Error:", error);
    return new Response(JSON.stringify({ success: false, error: error }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
