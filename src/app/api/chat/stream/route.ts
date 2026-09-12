import { NextRequest, NextResponse } from "next/server";
import {
  readBookText,
  readBookMeta,
  readConversation,
  saveConversation,
} from "@/lib/storage";
import { searchRelevantSections } from "@/lib/search";
import { converseAsAuthorStream } from "@/lib/agents/conversation-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 对话接口（流式版本）
 *
 * 用 Server-Sent Events 逐块推送模型输出，前端实现打字机效果，
 * 用户不必等整段回答生成完毕才看到内容。
 *
 * 事件格式（每行一个 JSON）：
 *   { type: "meta",   bookTitle, bookAuthor }  书名等元信息
 *   { type: "status", text }                   阶段性提示（准备中）
 *   { type: "delta",  text }                   增量文本
 *   { type: "done",   reply, bookTitle }       完成（已保存对话记录）
 *   { type: "error",  message }                出错
 */
export async function POST(request: NextRequest) {
  let bookId = "";
  let message = "";

  try {
    const body = await request.json();
    bookId = typeof body?.bookId === "string" ? body.bookId : "";
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!bookId) {
    return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        // ---- 书籍元信息 ----
        let bookTitle = "这本书";
        let bookAuthor = "";
        try {
          const meta = await readBookMeta(bookId);
          bookTitle =
            meta.title?.trim() || meta.fileName.replace(/\.(pdf|epub)$/i, "");
          bookAuthor = meta.author?.trim() ?? "";
        } catch {
          // 元信息读取失败时使用默认书名
        }

        // 先推元信息，前端可立即展示书名
        send({ type: "meta", bookTitle, bookAuthor });

        // 检索书籍文本要读整个文件并做相似度匹配，可能有 1~2 秒耗时。
        // 先推一条状态，用户按下发送后立刻能看到反馈，而不是盯着空白。
        send({ type: "status", text: "正在翻阅书中相关段落…" });

        // ---- 检索与话题相关的书籍片段 ----
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
          console.error("[对话流] 书籍文本读取失败:", e);
        }

        // ---- 历史对话 ----
        const conversation = await readConversation(bookId);
        const history = conversation?.messages || [];

        // 接下来是模型生成首段内容的等待时间
        send({ type: "status", text: "正在思考…" });

        // ---- 逐块产出模型输出 ----
        let reply = "";
        for await (const delta of converseAsAuthorStream(
          message,
          { bookTitle, authorName: bookAuthor, relevantSections },
          history
        )) {
          reply += delta;
          send({ type: "delta", text: delta });
        }

        // ---- 保存对话记录 ----
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

        send({ type: "done", reply, bookTitle });
      } catch (error) {
        console.error("[对话流] 请求失败:", error);
        const raw = error instanceof Error ? error.message : "";
        send({
          type: "error",
          message: raw.includes("没有返回内容")
            ? raw
            : "对话失败，请稍后重试",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 关键：关闭 nginx 缓冲，否则流式内容会被攒成一批才下发
      "X-Accel-Buffering": "no",
    },
  });
}
