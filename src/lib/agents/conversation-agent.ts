/**
 * Conversation Agent — 对话 Agent
 *
 * 职责：以书籍作者的身份，与用户进行有深度的阅读讨论。
 *
 * 设计原则（依据用户明确要求）：
 * - 只有一个视角：作者视角（书籍的角度）
 * - 用户看一本书，就是在跟这本书的作者沟通
 * - 不需要讨好用户，双方求同存异地讨论
 * - 认同的地方坦诚认同，不认同的地方直接指出
 */

import { chat, type ChatMessage } from "@/lib/ai/deepseek";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const AUTHOR_SYSTEM_PROMPT = `用户正在阅读你的书，并直接与你本人对话。

你的角色定位：
- 你以作者的身份回应，代表这本书的思想和立场
- 你清楚地知道"你的观点"和"用户的观点"是两回事
- 你与读者是平等的思想交流，不是服务关系

你的讨论方式：
- 忠实呈现你在书中表达的核心观点和论证逻辑
- 当读者认同你时，坦诚地表达认同；当读者质疑你时，正面回应质疑
- 与读者求同存异：你们可以看法不同，但讨论保持理性和尊重
- 不需要讨好读者，你的观点可以坚定，但表达方式保持礼貌
- 引用书中的具体内容作为讨论基础，让讨论落到实处
- 适当提出有启发性的反问，推动讨论深入，而不是单方面灌输
- 遇到书中没有覆盖的问题时，可以基于你的思想脉络做合理的延伸，但要说明"这是你的延伸思考"

你不应该：
- 无原则地附和读者的观点
- 为了显得友好而放弃自己的立场
- 回避分歧——求同存异正是这场讨论的价值所在
- 假装你"知道"书里没有的内容（除非作为延伸思考并说明）
- 把所有问题都给出确定的答案——有时提出问题比给出答案更有价值`;

export interface AuthorContext {
  bookTitle: string;
  authorName: string; // 作者姓名（EPUB 元数据提取，可能为空）
  relevantSections: string[]; // 与当前话题相关的书籍片段
}

/**
 * 以作者视角回应用户
 *
 * @param userMessage 用户的消息
 * @param context 书籍上下文（书名 + 作者名 + 相关片段）
 * @param history 最近的对话历史（不含本次用户消息）
 */
export async function converseAsAuthor(
  userMessage: string,
  context: AuthorContext,
  history: ConversationMessage[] = []
): Promise<string> {
  const sectionsText = context.relevantSections.length
    ? context.relevantSections
        .map((s, i) => `【书中片段 ${i + 1}】\n${s}`)
        .join("\n\n")
    : "（当前未找到与话题直接相关的书中内容，请基于你对整本书的整体理解回应）";

  const identityLine = context.authorName
    ? `你就是《${context.bookTitle}》的作者「${context.authorName}」本人。用户正在读这本书，直接与你对话。`
    : `你就是《${context.bookTitle}》的作者本人（这本书没有提取到作者姓名，你就以作者的身份自然回应）。`;

  const systemPrompt = `${AUTHOR_SYSTEM_PROMPT}

${identityLine}

以下是与你书中内容相关的片段，供你回应时引用：
${sectionsText}`;

  // 历史对话（最多保留最近 20 条，控制 token 用量）
  const historyMessages: ChatMessage[] = history.slice(-20).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  return chat(messages, {
    temperature: 0.7,
    maxTokens: 1024,
  });
}
