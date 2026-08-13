import { NextRequest, NextResponse } from "next/server";
import { readBookMeta, readConversation, saveConversation } from "@/lib/storage";
import { summarizeConversation } from "@/lib/agents/thinking-model-agent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { bookId } = await request.json();

    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    // 读取书籍元信息（书名）
    let bookTitle = "这本书";
    try {
      const meta = await readBookMeta(bookId);
      bookTitle = meta.fileName.replace(/\.pdf$/i, "");
    } catch {
      // 使用默认书名
    }

    // 读取对话记录
    const conversation = await readConversation(bookId);
    const messages = conversation?.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({
        insight: {
          userViews: [],
          disagreements: [],
          agreements: [],
          shifts: [],
          openQuestions: ["还没有对话记录，先和作者聊聊吧。"],
          generatedAt: new Date().toISOString(),
        },
        notice: "还没有对话记录",
      });
    }

    // 基于对话记录生成思想碰撞总结
    const insight = await summarizeConversation(bookTitle, messages);

    // 保存最新总结（页面刷新后仍可见）
    if (conversation) {
      await saveConversation(bookId, {
        ...conversation,
        insights: insight,
      });
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("[思想总结] 请求失败:", error);
    return NextResponse.json(
      { error: "生成思想总结失败，请重试" },
      { status: 500 }
    );
  }
}
