/**
 * Book Agent — 书籍理解 Agent
 *
 * 职责：深度理解一本书的内容。
 * 输入：PDF 书籍文本
 * 输出：结构化的书籍理解模型
 *
 * 应该做到：
 * - 识别书籍的核心论点、论证结构和关键概念
 * - 理解章节之间的逻辑关系
 * - 提取作者的核心观点和论证方式
 * - 识别书中的重要人物、事件、概念定义
 * - 建立概念之间的关系图谱
 *
 * 不应做：
 * - 不应该做简单的关键词提取
 * - 不应该只生成摘要（那是普通 PDF Chat）
 * - 不应该替代用户对书的判断
 *
 * 当前状态：接口定义 + 预留实现，后续接入 DeepSeek API
 */

import { chat, type ChatMessage } from "@/lib/ai/deepseek";

export interface BookUnderstanding {
  title: string;
  author?: string;
  coreThesis: string; // 核心论点
  chapterStructure: {
    title: string;
    summary: string;
    keyPoints: string[];
  }[];
  keyConcepts: {
    term: string;
    definition: string;
    relatedTerms?: string[];
  }[];
  authorPerspective: string; // 作者视角概述
  argumentStructure: string; // 论证结构
}

const SYSTEM_PROMPT = `你是 Shadow Reader 的 Book Agent — 一个深度书籍理解系统。

你的职责是深度理解一本书，而不是简单地总结它。

你需要做到：
1. 识别书籍的核心论点和论证结构
2. 理解章节之间的逻辑关系
3. 提取作者的核心观点和论证方式
4. 识别书中的重要概念定义
5. 建立概念之间的关系

你不应该：
- 做简单的关键词提取
- 只生成摘要（那是普通 PDF Chat 工具做的）
- 替代读者对书的判断

请以 JSON 格式输出你的分析结果。`;

/**
 * 分析书籍内容（核心方法）
 *
 * TODO: 当前为骨架实现，后续需要：
 * 1. 分段处理长文本（超出 token 限制时）
 * 2. 多轮分析：先理解结构，再深入概念
 * 3. 缓存分析结果
 */
export async function analyzeBook(
  bookText: string,
  bookTitle?: string
): Promise<BookUnderstanding> {
  // 截取前 8000 字符进行分析（DeepSeek token 限制）
  const truncatedText = bookText.slice(0, 8000);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `请深度分析以下书籍内容，并以 JSON 格式输出分析结果。

${bookTitle ? `书名：${bookTitle}` : ""}

书籍文本：
${truncatedText}

请输出以下结构（JSON）：
{
  "title": "书名",
  "author": "作者（如果能识别）",
  "coreThesis": "核心论点（1-2句话）",
  "chapterStructure": [
    { "title": "章节标题", "summary": "章节摘要", "keyPoints": ["要点1", "要点2"] }
  ],
  "keyConcepts": [
    { "term": "概念名", "definition": "定义", "relatedTerms": ["相关概念"] }
  ],
  "authorPerspective": "作者视角概述",
  "argumentStructure": "论证结构描述"
}`,
    },
  ];

  const result = await chat(messages, {
    temperature: 0.3, // 分析任务用较低温度，保证准确性
    maxTokens: 4096,
  });

  // 尝试解析 JSON
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Book Agent] JSON 解析失败:", e);
  }

  // 降级：返回基本结构
  return {
    title: bookTitle || "未知书名",
    coreThesis: result.slice(0, 200),
    chapterStructure: [],
    keyConcepts: [],
    authorPerspective: "",
    argumentStructure: "",
  };
}
