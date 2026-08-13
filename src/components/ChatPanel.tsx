"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface InsightSummary {
  userViews: string[];
  disagreements: string[];
  agreements: string[];
  shifts: string[];
  openQuestions: string[];
  generatedAt: string;
}

interface LoadData {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  fileName: string;
  messages: ChatMessage[];
  insights: InsightSummary | null;
}

// Web Speech API 最小类型声明（尚未进入 TypeScript 标准库）
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// 语音识别能力检测（Web Speech API，Chrome/Edge 及部分 Android 浏览器支持）
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * 与作者对话的面板（嵌入阅读页使用）
 *
 * 职责：加载对话历史、发送消息、语音输入、思想总结生成与展示。
 * 一本书一个作者一套对话，与阅读进度互不干扰。
 */
export default function ChatPanel({
  bookId,
  onClose,
}: {
  bookId: string;
  onClose: () => void;
}) {
  const [bookTitle, setBookTitle] = useState("这本书");
  const [bookAuthor, setBookAuthor] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");

  // 语音输入状态
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = getSpeechRecognition() !== null;

  // 思想总结状态
  const [insight, setInsight] = useState<InsightSummary | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 输入框自动增高：内容多时撑高，最多 10 行后内部滚动不再扩张
  const MAX_INPUT_HEIGHT = 220; // 约 10 行（text-sm 行高 20px + 上下 padding）
  const resizeInput = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT) + "px";
    el.style.overflowY =
      el.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  };

  // 加载对话历史
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/conversation?bookId=${bookId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "加载失败");
        }
        const data: LoadData = await res.json();
        setBookTitle(data.bookTitle);
        setBookAuthor(data.bookAuthor || "");
        setMessages(data.messages);
        setInsight(data.insights);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "加载失败");
      }
    }
    load();
  }, [bookId]);

  // 新消息时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, insight]);

  // 输入内容变化（含语音识别填入）时自动增高输入框
  useEffect(() => {
    if (inputRef.current) resizeInput(inputRef.current);
  }, [input]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    // 先显示用户消息
    const userMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, message: content }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "发送失败");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `（发送失败：${e instanceof Error ? e.message : "请重试"}）`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // 语音输入：点击开始/停止识别
  const toggleVoice = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      alert(
        "当前浏览器不支持语音输入，请使用 Chrome 或 Edge 浏览器，或直接用文字输入。"
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = "";
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      setInput((prev) => {
        const base = finalText
          ? prev.endsWith(finalText)
            ? prev
            : prev + finalText
          : prev;
        return interim ? base + interim : base;
      });
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = (event: { error: string }) => {
      console.error("语音识别错误:", event.error);
      setListening(false);
    };

    setListening(true);
    recognition.start();
  };

  const handleInsight = async () => {
    if (generatingInsight) return;
    setGeneratingInsight(true);
    setInsightError("");

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "生成失败");
      }

      const data = await res.json();
      setInsight(data.insight);
      setTimeout(() => {
        document.getElementById("insight-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : "生成失败，请重试");
    } finally {
      setGeneratingInsight(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-ink-light mb-4">{loadError}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-accent text-white rounded-lg font-sans text-sm hover:bg-accent-dark transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  const authorLabel = bookAuthor || `《${bookTitle}》作者`;

  return (
    <div className="flex flex-col h-full">
      {/* 面板标题栏 */}
      <div className="border-b border-paper-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h3 className="font-serif text-ink text-base truncate">
            与 {authorLabel} 对话
          </h3>
          <p className="text-[11px] text-ink-muted font-sans truncate">
            《{bookTitle}》· 求同存异
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInsight}
            disabled={generatingInsight || messages.length === 0}
            className="px-3 py-1.5 rounded-lg font-sans text-xs border border-accent text-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingInsight ? "总结中..." : "思想总结"}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-paper-100 hover:text-ink transition-colors"
            title="收起对话"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto bg-paper-50">
        <div className="px-4 py-5">
          {messages.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-serif text-ink text-base mb-2">
                读到哪想聊了，就说两句。
              </p>
              <p className="text-ink-muted font-sans text-xs leading-relaxed">
                你可以提问、质疑或分享想法，
                <br />
                {authorLabel} 会与你求同存异地讨论。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-accent text-white rounded-2xl rounded-br-sm px-4 py-2.5">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[92%] bg-white border border-paper-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
                      <p className="text-[11px] text-ink-muted font-sans mb-1">
                        {authorLabel}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
                        {m.content}
                      </p>
                    </div>
                  </div>
                )
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-paper-200 rounded-2xl rounded-bl-sm px-5 py-3.5">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce" />
                      <span
                        className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-ink-muted rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 思想总结展示 */}
          {insight && (
            <div id="insight-section" className="mt-5">
              <div className="bg-white border border-accent-light rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif text-ink text-sm font-semibold">
                    思想总结
                  </h4>
                  <span className="text-[10px] text-ink-muted font-sans">
                    {new Date(insight.generatedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <InsightSection
                  title="你的核心理念"
                  items={insight.userViews}
                  accent
                />
                <InsightSection
                  title="与作者的分歧"
                  items={insight.disagreements}
                />
                <InsightSection
                  title="与作者的共鸣"
                  items={insight.agreements}
                />
                <InsightSection
                  title="你的思想变化"
                  items={insight.shifts}
                />
                <InsightSection
                  title="值得继续探索的问题"
                  items={insight.openQuestions}
                />
                <p className="mt-3 text-[10px] text-ink-muted font-sans border-t border-paper-100 pt-2.5">
                  继续对话后，再次点击「思想总结」即可基于最新对话更新。
                </p>
              </div>
            </div>
          )}

          {insightError && (
            <p className="mt-3 text-red-600 font-sans text-xs">{insightError}</p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 输入区域（文字 + 语音） */}
      <div className="border-t border-paper-200 bg-white px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          {/* 语音输入按钮 */}
          <button
            onClick={toggleVoice}
            title={
              speechSupported
                ? listening
                  ? "停止录音"
                  : "语音输入（说中文）"
                : "当前浏览器不支持语音输入"
            }
            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors border ${
              listening
                ? "bg-red-500 border-red-500 text-white"
                : speechSupported
                ? "border-paper-300 text-accent hover:bg-accent hover:text-white"
                : "border-paper-200 text-ink-muted opacity-50"
            }`}
          >
            {listening ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-3 bg-white rounded-full animate-pulse" />
                <span
                  className="w-1.5 h-4 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-1.5 h-3 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
              </span>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              listening
                ? "正在听你说话，说完自动填入..."
                : "写下你的想法、疑问或质疑..."
            }
            rows={1}
            className="flex-1 min-w-0 resize-none border border-paper-300 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent transition-colors font-sans bg-paper-50 leading-5 overflow-y-hidden"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 bg-accent text-white rounded-xl font-sans text-sm hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightSection({
  title,
  items,
  accent = false,
}: {
  title: string;
  items: string[];
  accent?: boolean;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-3">
      <h5
        className={`text-xs font-sans font-medium mb-1.5 ${
          accent ? "text-accent-dark" : "text-ink-light"
        }`}
      >
        {title}
      </h5>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-xs text-ink leading-relaxed flex gap-1.5"
          >
            <span className="text-ink-muted shrink-0">·</span>
            <span className="whitespace-pre-wrap">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
