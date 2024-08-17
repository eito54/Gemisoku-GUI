import { NextRequest, NextResponse } from "next/server";
import { googleVisionClient } from "../infra/gcp";

export async function POST(req: NextRequest) {
  const json = await req.json();

  const data = await googleVisionClient.textDetection({
    image: {
      source: {
        imageUri: json.imageUrl,
      },
    },
  });

  return NextResponse.json(data);
}
