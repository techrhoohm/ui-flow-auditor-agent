import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  baseline: string; // data URL (jpeg or png)
  current: string;  // data URL (jpeg or png)
};

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.baseline || !body.current) {
    return NextResponse.json({ error: "baseline and current required" }, { status: 400 });
  }

  try {
    const baseBuf = dataUrlToBuffer(body.baseline);
    const currBuf = dataUrlToBuffer(body.current);

    // Decode both images to raw RGBA using sharp
    const [baseMeta, currMeta] = await Promise.all([
      sharp(baseBuf).metadata(),
      sharp(currBuf).metadata(),
    ]);

    const w = Math.min(baseMeta.width ?? 0, currMeta.width ?? 0);
    const h = Math.min(baseMeta.height ?? 0, currMeta.height ?? 0);

    if (w === 0 || h === 0) {
      return NextResponse.json({ error: "Could not decode image dimensions" }, { status: 422 });
    }

    const [baseRaw, currRaw] = await Promise.all([
      sharp(baseBuf).resize(w, h, { fit: "cover", position: "top" }).ensureAlpha().raw().toBuffer(),
      sharp(currBuf).resize(w, h, { fit: "cover", position: "top" }).ensureAlpha().raw().toBuffer(),
    ]);

    const diffRaw = Buffer.alloc(w * h * 4);
    const changedPixels = pixelmatch(
      new Uint8Array(baseRaw),
      new Uint8Array(currRaw),
      new Uint8Array(diffRaw.buffer, diffRaw.byteOffset, diffRaw.byteLength),
      w,
      h,
      { threshold: 0.1, alpha: 0.2, diffColor: [255, 60, 60] }
    );

    // Encode diff to PNG data URL
    const diffPng = await sharp(diffRaw, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer();
    const diffDataUrl = `data:image/png;base64,${diffPng.toString("base64")}`;

    const totalPixels = w * h;
    const percentChanged = (changedPixels / totalPixels) * 100;

    return NextResponse.json({
      changedPixels,
      totalPixels,
      percentChanged,
      diffDataUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
