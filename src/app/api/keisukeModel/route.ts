import type { NextRequest } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as Blob;
  const buffer = await file.arrayBuffer();

  const keisukeModel = await sharp(Buffer.from(buffer))
    .extract({
      width: 300,
      height: 920,
      left: 1020,
      top: 80,
    })
    .grayscale()
    .modulate({
      brightness: 1.3,
    })
    .normalize()
    .gamma(1.3)
    .sharpen()
    .median(3)
    .toBuffer();

  return new Response(keisukeModel, {
    headers: {
      "Content-Type": "image/jpeg",
    },
  });
}
