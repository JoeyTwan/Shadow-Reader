import { NextRequest, NextResponse } from "next/server";
import { readBookText, readBookMeta, readConversation, saveConversation } from "@/lib/storage";
import { searchRelevantSections } from "@/lib/search";
import { converseAsAuthor } from "@/lib/agents/conversation-agent";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { bookId, message } = await request.json();

    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    // 读取书籍元信息
    let bookTitle = "这本书";
    try {
      const meta = await readBookMeta(bookId);
      bookTitle = meta.fileName.replace(/\.pdf$/i, "");
    } catch {
      // 元信息读取失败时使用默认书名
    }

    // 读取书籍全文 + 检索相关片段
    let relevantSections: string[] = [];
    try {
      const bookText = await readBookText(bookId);
      relevantSections = searchRelevantSections(
        bookText,
        message,
        4,
        1500
      ).map((r) => r.paragraph);
    } catch (e) {
      console.error("[对话] 书籍文本读取失败:", e);
    }

    // 读取现有对话记录
    const conversation = await readConversation(bookId);
    const history = conversation?.messages || [];

    // 以作者视角获取回复
    const reply = await converseAsAuthor(message, {
      bookTitle,
      relevantSections,
    }, history);

    // 保存对话记录
    const now = new Date().toISOString();
    const newMessages = [
      ...history,
      { role: "user" as const, content: message.trim(), timestamp: now },
      { role: "assistant" as const, content: reply, timestamp: now },
    ];
    await saveConversation(bookId, {
      bookId,
      bookTitle,
      messages: newMessages,
      insights: conversation?.insights ?? null,
    });

    return NextResponse.json({
      reply,
      bookTitle,
    });
  } catch (error) {
    console.error("[对话] 请求失败:", error);
    return NextResponse.json(
      { error: "对话失败，请检查 DeepSeek API Key 是否配置正确" },
      { status: 500 }
    );
  }
}
