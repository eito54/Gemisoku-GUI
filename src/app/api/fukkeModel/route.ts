import type { NextRequest } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as Blob;
  const buffer = await file.arrayBuffer();

  const fukkeModel = await sharp(Buffer.from(buffer))
    .extract({
      width: 300,
      height: 920,
      left: 1020,
      top: 80,
    })
    .grayscale()
    .linear(1, -128)
    .threshold(128)
    .normalize()
    .gamma(1.3)
    .median(3)
    .toBuffer();

  return new Response(fukkeModel, {
    headers: {
      "Content-Type": "image/jpeg",
    },
  });
}
