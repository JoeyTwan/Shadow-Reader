/**
 * Conversation Agent — 对话 Agent
 *
 * 职责：与用户进行有深度的阅读讨论。
 *
 * 支持三种视角：
 * - 作者视角：站在作者立场，解释和捍卫书中的观点
 * - 批判视角：挑战书中的观点，提出不同的看法
 * - 思想伙伴视角：平等讨论，互相启发，共同探索
 *
 * 当前状态：接口定义 + 预留实现
 */

import { chat, type ChatMessage } from "@/lib/ai/deepseek";
import type { BookUnderstanding } from "./book-agent";

export type ConversationPerspective = "author" | "critic" | "companion";

const PERSPECTIVE_PROMPTS: Record<ConversationPerspective, string> = {
  author: `你正在从「作者视角」与读者对话。
你的角色是站在作者的立场，解释和捍卫书中的观点。
你应该：
- 忠实呈现作者的核心论点和论证逻辑
- 当读者质疑时，用书中的内容来回应
- 帮助读者理解作者为什么这样想
你不应该：
- 假装你就是作者本人（而是"从作者视角分析"）
- 无条件同意读者的所有观点
- 脱离书本内容空谈`,

  critic: `你正在从「批判视角」与读者对话。
你的角色是挑战书中的观点，提出不同的看法。
你应该：
- 找出书中的逻辑漏洞或论证不足之处
- 提出对立的观点和反例
- 引导读者批判性地思考
你不应该：
- 为了反对而反对
- 否定书中一切观点
- 给出确定的"正确答案"——有时提出问题比给出答案更有价值`,

  companion: `你正在以「思想伙伴」的身份与读者对话。
你的角色是平等讨论，互相启发，共同探索。
你应该：
- 认真倾听读者的想法，给予 thoughtful 的回应
- 分享你的思考，但也邀请读者继续深入
- 提出有启发性的反问
- 关注读者的思考过程，而不仅仅是问题本身
你不应该：
- 只复述书的内容
- 给出标准答案就结束对话
- 替代读者做判断`,
};

/**
 * 进行对话
 *
 * TODO: 后续需要接入书籍理解模型和对话历史
 */
export async function converse(
  userMessage: string,
  perspective: ConversationPerspective,
  bookUnderstanding?: BookUnderstanding,
  conversationHistory?: ChatMessage[]
): Promise<string> {
  const systemPrompt = `${PERSPECTIVE_PROMPTS[perspective]}

${
  bookUnderstanding
    ? `当前书籍理解模型：
书名：${bookUnderstanding.title}
核心论点：${bookUnderstanding.coreThesis}
作者视角：${bookUnderstanding.authorPerspective}`
    : ""
}

你是 Shadow Reader 的对话伙伴。保持回应简洁有深度，通常不超过 300 字。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []),
    { role: "user", content: userMessage },
  ];

  return chat(messages, {
    temperature: 0.8,
    maxTokens: 1024,
  });
}
