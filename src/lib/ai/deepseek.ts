/**
 * DeepSeek API 客户端
 *
 * DeepSeek 使用 OpenAI 兼容的 API 格式，
 * 通过 openai SDK 调用，只需修改 baseURL 和 apiKey。
 */

import OpenAI from "openai";

// 默认模型：DeepSeek 官方已于 2026-07-24 停用 deepseek-chat，
// 新模型为 deepseek-v4-flash（便宜、适合阅读对话）与 deepseek-v4-pro（更强）。
// 可通过环境变量 DEEPSEEK_MODEL 覆盖。
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

// 延迟初始化客户端，避免在没有环境变量时启动报错
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 DEEPSEEK_API_KEY 环境变量。请在 .env.local 中配置。"
    );
  }

  client = new OpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey,
  });

  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * 发送对话请求到 DeepSeek
 *
 * DeepSeek 偶发返回空内容（reasoning 模型偶发把内容放进思考字段、
 * 或服务端瞬时异常），此时自动重试一次；仍为空则抛出明确错误，
 * 避免把空字符串当作正常回复返回给用户。
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
) {
  const c = getClient();

  const params = {
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await c.chat.completions.create(params);
    const content = response.choices[0]?.message?.content || "";
    if (content.trim()) return content;

    console.warn(
      `[DeepSeek] 第 ${attempt} 次请求返回空内容（finish_reason: ${response.choices[0]?.finish_reason ?? "unknown"}）`
    );
  }

  throw new Error("AI 没有返回内容，请重新发送一次");
}

/**
 * 发送流式对话请求到 DeepSeek
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string> {
  const c = getClient();

  const stream = await c.chat.completions.create({
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
