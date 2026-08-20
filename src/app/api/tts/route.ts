import { NextRequest, NextResponse } from "next/server";
import { synthesize, VOICES } from "@/lib/tts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice, rate } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "缺少文本内容" }, { status: 400 });
    }

    const voiceKey = voice && VOICES[voice] ? voice : "xiaoxiao";
    const safeRate =
      typeof rate === "number" && Number.isFinite(rate)
        ? Math.max(-100, Math.min(100, rate))
        : 0;
    const audioBuffer = await synthesize(text, voiceKey, safeRate);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Shadow Reader] TTS 合成失败:", error);
    return NextResponse.json(
      { error: "语音合成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
