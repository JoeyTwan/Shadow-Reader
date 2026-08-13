/**
 * Thinking Model Agent — 思想总结 Agent
 *
 * 职责：用户点击"思想总结"按钮时，基于当前对话记录，
 * 提炼用户与作者之间的思想碰撞。
 *
 * 用户明确要求：
 * - 思想总结是用户的主动行为（点击按钮触发）
 * - 输入：用户与"作者"的对话记录、思想碰撞
 * - 输出：结构化的思想碰撞总结，直接展示在页面内
 * - 不输出成文件；有新的对话后再点击，基于最新记录重新生成
 *
 * 应该做到：
 * - 提炼用户表达的核心观点（这些是用户自己的思考，属于用户）
 * - 识别用户与作者的分歧点（哪里看法不同）
 * - 识别用户与作者的共鸣点（哪里看法一致）
 * - 追踪用户思想的变化（如果对话中有变化）
 * - 列出值得继续探索的问题
 *
 * 不应做：
 * - 不评判用户观点的对错
 * - 不把用户的思想简化成标签
 * - 不替用户做判断
 */

import { chat, type ChatMessage } from "@/lib/ai/deepseek";
import type { ConversationMessage } from "./conversation-agent";

export interface InsightSummary {
  /** 用户的核心理念（用户自己表达的观点） */
  userViews: string[];
  /** 用户与作者的分歧点 */
  disagreements: string[];
  /** 用户与作者的共鸣点 */
  agreements: string[];
  /** 对话中观察到的用户思想变化（如有） */
  shifts: string[];
  /** 值得继续探索的问题 */
  openQuestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

const INSIGHT_SYSTEM_PROMPT = `你是 Shadow Reader 的思想总结员。你的任务是观察用户与书籍作者的对话，提炼出有价值的思想碰撞。

你的产出是一份思想碰撞总结，包含：
1. 用户的核心理念 — 用户在这场对话中表达的重要观点（注意：这些是用户自己的思考，属于用户，不是作者的观点）
2. 分歧点 — 用户与作者看法不同的地方（求同存异中的"异"）
3. 共鸣点 — 用户与作者看法一致、产生共鸣的地方（求同存异中的"同"）
4. 思想变化 — 如果用户在某件事上的看法在对话中发生了变化，记录这个变化轨迹
5. 待探索的问题 — 讨论中浮现的、值得继续深入的问题

你的原则：
- 尊重用户的观点，只记录，不评判对错
- 清晰区分"作者的观点"和"用户的观点"，不要混淆
- 只基于对话中真实出现的内容，不凭空推测
- 每一条都要具体、有细节，不要空泛
- 使用用户对话时的语言风格来呈现总结

请以 JSON 格式输出，结构如下：
{
  "userViews": ["观点1", "观点2"],
  "disagreements": ["分歧1", "分歧2"],
  "agreements": ["共鸣1", "共鸣2"],
  "shifts": ["变化1"]（没有则空数组）,
  "openQuestions": ["问题1", "问题2"]
}`;

/**
 * 基于对话记录生成思想碰撞总结
 *
 * @param bookTitle 书名（用于上下文）
 * @param messages 完整对话记录
 */
export async function summarizeConversation(
  bookTitle: string,
  messages: ConversationMessage[]
): Promise<InsightSummary> {
  // 没有足够对话时提前返回
  if (messages.length === 0) {
    return {
      userViews: [],
      disagreements: [],
      agreements: [],
      shifts: [],
      openQuestions: ["还没有对话记录，先和作者聊聊吧。"],
      generatedAt: new Date().toISOString(),
    };
  }

  // 组装对话文本（控制长度：取最近 40 条）
  const transcript = messages
    .slice(-40)
    .map((m) => {
      const speaker = m.role === "user" ? "读者" : `作者（《${bookTitle}》）`;
      return `【${speaker}】\n${m.content}`;
    })
    .join("\n\n");

  const messagesForAI: ChatMessage[] = [
    { role: "system", content: INSIGHT_SYSTEM_PROMPT },
    {
      role: "user",
      content: `以下是读者与《${bookTitle}》作者的对话记录，请生成思想碰撞总结：\n\n${transcript}`,
    },
  ];

  const result = await chat(messagesForAI, {
    temperature: 0.5,
    maxTokens: 2048,
  });

  // 尝试解析 JSON
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        userViews: parsed.userViews || [],
        disagreements: parsed.disagreements || [],
        agreements: parsed.agreements || [],
        shifts: parsed.shifts || [],
        openQuestions: parsed.openQuestions || [],
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error("[思想总结] JSON 解析失败:", e);
  }

  // 降级：直接返回原文作为总结
  return {
    userViews: [result],
    disagreements: [],
    agreements: [],
    shifts: [],
    openQuestions: [],
    generatedAt: new Date().toISOString(),
  };
}
