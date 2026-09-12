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
 * 两层容错：
 * 1. 空回复重试：DeepSeek 偶发返回空 content（reasoning 模型偶发把内容
 *    放进思考字段、或服务端瞬时异常），此时自动重试，避免把空字符串
 *    当作正常回复返回给用户。
 * 2. 截断续写：当 finish_reason 为 "length"（撞到 max_tokens 上限）时，
 *    自动带上已生成内容再请求一次，让模型接着写完，避免"话说到一半就停"。
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const c = getClient();

  const baseParams = {
    model: options.model || DEFAULT_MODEL,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  // 单次请求的空内容最大重试次数
  const MAX_EMPTY_RETRIES = 2;
  // 因长度上限被截断时的最大续写次数
  const MAX_CONTINUATIONS = 2;

  let conversation: ChatMessage[] = [...messages];
  let fullText = "";

  for (let step = 0; step <= MAX_CONTINUATIONS; step++) {
    let text = "";
    let finishReason: string | null | undefined;

    // ---- 单次请求（含空内容重试）----
    for (let attempt = 1; attempt <= MAX_EMPTY_RETRIES; attempt++) {
      const response = await c.chat.completions.create({
        ...baseParams,
        messages: conversation,
      });
      const choice = response.choices[0];
      finishReason = choice?.finish_reason;
      text = choice?.message?.content || "";

      if (text.trim()) break;

      console.warn(
        `[DeepSeek] 第 ${attempt} 次请求返回空内容（finish_reason: ${finishReason ?? "unknown"}）`
      );
    }

    // 完全拿不到内容
    if (!text.trim()) {
      if (!fullText) {
        throw new Error("AI 没有返回内容，请重新发送一次");
      }
      // 已有部分内容时，保留已生成的部分
      break;
    }

    fullText += text;

    // 正常结束，无需续写
    if (finishReason !== "length") break;

    // 已用尽续写次数
    if (step === MAX_CONTINUATIONS) {
      console.warn("[DeepSeek] 已达最大续写次数，回复仍可能不完整");
      break;
    }

    console.warn(
      `[DeepSeek] 回复撞到长度上限被截断，自动续写第 ${step + 1} 次`
    );
    conversation = [
      ...conversation,
      { role: "assistant", content: fullText },
      {
        role: "user",
        content:
          "请紧接着上文继续写完，不要重复已经说过的内容，也不要在开头添加任何说明或过渡语。",
      },
    ];
  }

  return fullText;
}

/**
 * 发送流式对话请求到 DeepSeek
 *
 * 与 chat() 保持一致的两层容错：
 * 1. 完全没有产出内容时自动重试（已产出则不重试，避免内容重复）
 * 2. 撞到长度上限（finish_reason 为 "length"）时自动续写，保证内容完整
 * 3. 传输中途断开时，返回已经生成的部分，避免用户白等
 */
export async function* chatStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string> {
  const c = getClient();

  const baseParams = {
    model: options.model || DEFAULT_MODEL,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
    stream: true as const,
  };

  const MAX_EMPTY_RETRIES = 2;
  const MAX_CONTINUATIONS = 2;

  let conversation: ChatMessage[] = [...messages];
  let fullText = "";

  for (let step = 0; step <= MAX_CONTINUATIONS; step++) {
    let produced = false;
    let finishReason: string | null | undefined;

    for (let attempt = 1; attempt <= MAX_EMPTY_RETRIES; attempt++) {
      try {
        const stream = await c.chat.completions.create({
          ...baseParams,
          messages: conversation,
        });

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
          }
          const delta = choice?.delta?.content;
          if (delta) {
            produced = true;
            fullText += delta;
            yield delta;
          }
        }
      } catch (error) {
        // 传输中断：已经产出的内容照常返回，避免用户白等
        if (produced) {
          console.warn("[DeepSeek] 流式传输中断，返回已生成内容:", error);
          return;
        }
        throw error;
      }

      if (produced) break;

      console.warn(
        `[DeepSeek] 流式第 ${attempt} 次未产出任何内容（finish_reason: ${finishReason ?? "unknown"}）`
      );
    }

    if (!produced) {
      if (!fullText) {
        throw new Error("AI 没有返回内容，请重新发送一次");
      }
      return;
    }

    if (finishReason !== "length") return;
    if (step === MAX_CONTINUATIONS) {
      console.warn("[DeepSeek] 已达最大续写次数，回复仍可能不完整");
      return;
    }

    console.warn(`[DeepSeek] 流式回复被截断，自动续写第 ${step + 1} 次`);
    conversation = [
      ...conversation,
      { role: "assistant", content: fullText },
      {
        role: "user",
        content:
          "请紧接着上文继续写完，不要重复已经说过的内容，也不要在开头添加任何说明或过渡语。",
      },
    ];
  }
}
