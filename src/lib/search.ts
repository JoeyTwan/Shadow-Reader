/**
 * 书籍内容检索工具
 *
 * 在整本书的文本中，找到与用户当前话题最相关的片段，
 * 作为对话时"作者"引用的上下文。
 *
 * MVP 阶段使用简单的 n-gram 重叠打分，
 * 后续可替换为向量检索（pgvector / Chroma）。
 */

/** 把文本按空行切分为段落 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20); // 过滤过短的碎片
}

/** 生成字符 n-gram 集合（中英文通用） */
function getNGrams(text: string, n: number): Set<string> {
  const grams = new Set<string>();
  const cleaned = text.replace(/\s+/g, "").toLowerCase();
  for (let i = 0; i <= cleaned.length - n; i++) {
    grams.add(cleaned.slice(i, i + n));
  }
  return grams;
}

export interface SearchResult {
  paragraph: string;
  score: number;
}

/**
 * 检索与查询最相关的书籍段落
 *
 * @param bookText 整本书的文本
 * @param query 用户的提问或观点
 * @param topK 返回的段落数
 * @param maxParagraphChars 单段落截取上限（控制 token）
 */
export function searchRelevantSections(
  bookText: string,
  query: string,
  topK = 4,
  maxParagraphChars = 1500
): SearchResult[] {
  const paragraphs = splitParagraphs(bookText);
  if (paragraphs.length === 0) return [];

  const queryGrams = getNGrams(query, 2);

  const scored: SearchResult[] = paragraphs.map((p) => {
    // 段落太长则只看前段做匹配（提速 + 防止匹配到无关长段）
    const sample = p.slice(0, 3000);
    const paraGrams = getNGrams(sample, 2);

    let score = 0;
    for (const g of queryGrams) {
      if (paraGrams.has(g)) score++;
    }

    // 长段落略微加权，避免碎片段落霸榜
    const lengthBonus = Math.min(1, p.length / 500) * 0.5;
    return {
      paragraph: p.slice(0, maxParagraphChars),
      score: score * (1 + lengthBonus),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 只返回有实际匹配的段落；若完全没有匹配，返回前 2 段作为兜底
  const matched = scored.filter((s) => s.score > 0);
  return matched.length >= 2 ? matched.slice(0, topK) : scored.slice(0, 2);
}
