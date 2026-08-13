import { NextRequest, NextResponse } from "next/server";
import { saveReadingProgress, type ReadingProgress } from "@/lib/storage";

// 保存阅读进度（滚动位置 / 翻页页码）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookId, mode, scrollRatio, pageIndex } = body;

    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    const progress: ReadingProgress = {
      bookId,
      mode: mode === "page" ? "page" : "scroll",
      scrollRatio:
        typeof scrollRatio === "number"
          ? Math.min(1, Math.max(0, scrollRatio))
          : 0,
      pageIndex: typeof pageIndex === "number" ? Math.max(0, pageIndex) : 0,
      updatedAt: new Date().toISOString(),
    };

    await saveReadingProgress(progress);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Shadow Reader] 保存进度失败:", error);
    return NextResponse.json({ error: "保存进度失败" }, { status: 500 });
  }
}
