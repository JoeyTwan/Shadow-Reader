"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
  fileName: string;
  messages: ChatMessage[];
  insights: InsightSummary | null;
}

export default function ReaderClient({ bookId }: { bookId: string }) {
  const [bookTitle, setBookTitle] = useState("这本书");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");

  // 思想总结状态
  const [insight, setInsight] = useState<InsightSummary | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

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
      // 发送失败时把错误信息作为一条系统提示
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
      // 生成后滚动到总结区域
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-light mb-4">{loadError}</p>
          <Link
            href="/"
            className="px-6 py-2 bg-accent text-white rounded-lg font-sans text-sm hover:bg-accent-dark transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部栏 */}
      <header className="border-b border-paper-200 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="text-ink-muted hover:text-ink transition-colors font-sans text-sm shrink-0"
            >
              ← 返回
            </Link>
            <h1 className="font-serif text-ink text-lg truncate">
              {bookTitle}
            </h1>
            <span className="text-xs text-ink-muted font-sans shrink-0 hidden sm:inline">
              与作者对话
            </span>
          </div>
          <button
            onClick={handleInsight}
            disabled={generatingInsight || messages.length === 0}
            className="px-4 py-1.5 rounded-lg font-sans text-sm border border-accent text-accent hover:bg-accent hover:text-white transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingInsight ? "总结中..." : "思想总结"}
          </button>
        </div>
      </header>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-serif text-ink text-lg mb-3">
                《{bookTitle}》，开始了。
              </p>
              <p className="text-ink-muted font-sans text-sm leading-relaxed">
                你现在可以直接与这本书的作者对话。
                <br />
                说出你的想法、提问或质疑，作者会与你求同存异地讨论。
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] bg-accent text-white rounded-2xl rounded-br-sm px-5 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%] bg-paper-100 border border-paper-200 rounded-2xl rounded-bl-sm px-5 py-3">
                      <p className="text-xs text-ink-muted font-sans mb-1.5">
                        《{bookTitle}》作者
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
                  <div className="bg-paper-100 border border-paper-200 rounded-2xl rounded-bl-sm px-5 py-4">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-ink-muted rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-ink-muted rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="w-2 h-2 bg-ink-muted rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 思想总结展示区 */}
      {insight && (
        <div
          id="insight-section"
          className="border-t border-paper-200 bg-paper-50"
        >
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="bg-white border border-paper-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-ink text-lg">思想总结</h2>
                <span className="text-xs text-ink-muted font-sans">
                  {new Date(insight.generatedAt).toLocaleString("zh-CN")}
                </span>
              </div>

              <InsightSection
                title="你的核心理念"
                items={insight.userViews}
                accent
              />
              <InsightSection title="与作者的分歧" items={insight.disagreements} />
              <InsightSection title="与作者的共鸣" items={insight.agreements} />
              <InsightSection title="你的思想变化" items={insight.shifts} />
              <InsightSection
                title="值得继续探索的问题"
                items={insight.openQuestions}
              />

              <p className="mt-6 text-xs text-ink-muted font-sans border-t border-paper-100 pt-4">
                继续对话后，再次点击「思想总结」即可基于最新对话更新这份总结。
              </p>
            </div>
          </div>
        </div>
      )}

      {insightError && (
        <div className="max-w-3xl mx-auto px-6 py-2">
          <p className="text-red-600 font-sans text-sm">{insightError}</p>
        </div>
      )}

      {/* 输入区域 */}
      <div className="border-t border-paper-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter 发送，Shift+Enter 换行
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="写下你的想法、疑问或质疑，与作者讨论..."
            rows={1}
            className="flex-1 resize-none border border-paper-300 rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent transition-colors font-sans bg-paper-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-6 py-3 bg-accent text-white rounded-xl font-sans text-sm hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
    <div className="mb-5">
      <h3
        className={`text-sm font-sans font-medium mb-2 ${
          accent ? "text-accent-dark" : "text-ink-light"
        }`}
      >
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-ink leading-relaxed flex gap-2">
            <span className="text-ink-muted shrink-0">·</span>
            <span className="whitespace-pre-wrap">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
