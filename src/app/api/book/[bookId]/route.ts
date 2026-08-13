import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import {
  getChaptersPath,
  readBookMeta,
  readBookText,
  readReadingProgress,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

interface ChapterItem {
  title: string;
  text: string;
}

// 书籍详情：元信息 + 章节内容（EPUB 按章节，PDF 整本为单章）+ 阅读进度
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    const meta = await readBookMeta(bookId);

    let chapters: ChapterItem[] | null = null;

    // EPUB 优先读章节结构文件
    if (meta.fileType === "epub") {
      try {
        const data = await readFile(getChaptersPath(bookId), "utf-8");
        chapters = JSON.parse(data);
      } catch {
        chapters = null;
      }
    }

    // 兜底：读全文作为单章
    if (!chapters || chapters.length === 0) {
      const text = await readBookText(bookId);
      chapters = [{ title: "正文", text }];
    }

    const progress = await readReadingProgress(bookId);

    return NextResponse.json({ meta, chapters, progress });
  } catch (error) {
    console.error("[Shadow Reader] 读取书籍失败:", error);
    return NextResponse.json(
      { error: "书籍不存在，请返回书架重新上传" },
      { status: 404 }
    );
  }
}
