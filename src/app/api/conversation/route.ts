import { NextRequest, NextResponse } from "next/server";
import { readBookMeta, readConversation } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const bookId = request.nextUrl.searchParams.get("bookId");

    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    // 读取书籍元信息（书名优先用 EPUB 提取的 title）
    let bookTitle = "这本书";
    let bookAuthor = "";
    let fileName = "";
    try {
      const meta = await readBookMeta(bookId);
      bookTitle =
        meta.title?.trim() ||
        meta.fileName.replace(/\.(pdf|epub)$/i, "");
      bookAuthor = meta.author?.trim() ?? "";
      fileName = meta.fileName;
    } catch {
      // 书籍可能不存在
      return NextResponse.json(
        { error: "书籍不存在，请返回首页重新上传" },
        { status: 404 }
      );
    }

    // 读取对话记录
    const conversation = await readConversation(bookId);

    return NextResponse.json({
      bookId,
      bookTitle,
      bookAuthor,
      fileName,
      messages: conversation?.messages || [],
      insights: conversation?.insights ?? null,
    });
  } catch (error) {
    console.error("[对话历史] 请求失败:", error);
    return NextResponse.json({ error: "加载失败" }, { status: 500 });
  }
}
