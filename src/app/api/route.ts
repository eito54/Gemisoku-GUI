import { NextRequest, NextResponse } from "next/server";
import { googleVisionClient } from "../infra/gcp";

export async function POST(req: NextRequest) {
  const json = await req.json();

  const [result] = await googleVisionClient.textDetection(json.imageUrl);

  return NextResponse.json({ result });
}
