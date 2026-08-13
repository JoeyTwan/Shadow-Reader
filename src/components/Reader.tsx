"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ChatPanel from "@/components/ChatPanel";

interface ChapterItem {
  title: string;
  text: string;
  level?: number;
}

interface ReadingProgress {
  bookId: string;
  mode: "scroll" | "page";
  scrollRatio: number;
  pageIndex: number;
  updatedAt: string;
}

interface BookDetail {
  meta: {
    bookId: string;
    fileName: string;
    fileType: string;
    title?: string;
    author?: string;
    chapterCount?: number;
    pageCount: number;
  };
  chapters: ChapterItem[];
  progress: ReadingProgress | null;
}

type ReadMode = "scroll" | "page";

const FONT_KEY = "shadow-reader-fontsize";
const MIN_FONT = 15;
const MAX_FONT = 30;

export default function Reader({ bookId }: { bookId: string }) {
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<ReadMode>("scroll");
  const [fontSize, setFontSize] = useState(18);
  const [pageIndex, setPageIndex] = useState(0);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const modeRef = useRef<ReadMode>("scroll");
  const ratioRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 是否真的产生过阅读行为（滚动/翻页），用于卸载时决定是否保存进度，
  // 避免 dev 模式 StrictMode 挂载即卸载时把进度覆盖为 0
  const hasReadRef = useRef(false);

  // 加载书籍数据
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/book/${bookId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "加载失败");
        }
        const data: BookDetail = await res.json();
        if (cancelled) return;
        setDetail(data);

        // 恢复上次的阅读模式与进度
        const savedMode = data.progress?.mode ?? "scroll";
        setMode(savedMode);
        modeRef.current = savedMode;
        if (savedMode === "page") {
          setPageIndex(data.progress?.pageIndex ?? 0);
        } else {
          ratioRef.current = data.progress?.scrollRatio ?? 0;
        }
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "加载失败");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 字号偏好
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (n >= MIN_FONT && n <= MAX_FONT) setFontSize(n);
      }
    } catch {
      // 忽略 localStorage 异常
    }
  }, []);

  // 滚动模式下恢复到上次阅读位置
  // 依赖 fontSize：字号从本地偏好恢复后重新对齐，避免内容高度变化导致位置漂移
  useEffect(() => {
    if (detail && mode === "scroll" && scrollRef.current) {
      const apply = () => {
        const el = scrollRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 0) {
          el.scrollTop = ratioRef.current * max;
        }
      };
      // 先等首帧渲染完成，再等字体/布局稳定后二次对齐
      requestAnimationFrame(apply);
      const timer = setTimeout(apply, 100);
      return () => clearTimeout(timer);
    }
  }, [detail, mode, fontSize]);

  // 保存进度（防抖）
  const scheduleSave = useCallback(
    (next: { mode?: ReadMode; ratio?: number; page?: number }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId,
              mode: next.mode ?? modeRef.current,
              scrollRatio: next.ratio ?? ratioRef.current,
              pageIndex: next.page ?? pageIndexRef.current,
            }),
          });
        } catch {
          // 保存失败不打断阅读
        }
      }, 1200);
    },
    [bookId]
  );

  // 用 ref 同步 pageIndex，避免闭包过期
  const pageIndexRef = useRef(0);
  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);

  // 组件卸载时保存最后一次进度
  // hasReadRef 守卫：dev 模式 StrictMode 会「挂载-卸载-再挂载」，
  // 若没有真实阅读行为就发送会覆盖掉之前保存的进度
  useEffect(() => {
    const saveNow = () => {
      if (!hasReadRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const body = JSON.stringify({
        bookId,
        mode: modeRef.current,
        scrollRatio: ratioRef.current,
        pageIndex: pageIndexRef.current,
      });
      navigator.sendBeacon?.(
        "/api/progress",
        new Blob([body], { type: "application/json" })
      );
    };
    // 刷新 / 关闭标签页时兜底保存
    window.addEventListener("pagehide", saveNow);
    return () => {
      window.removeEventListener("pagehide", saveNow);
      saveNow();
    };
  }, [bookId]);

  // 翻页分页：把全部章节的段落按目标字数切成页
  const pages = useMemo(() => {
    if (!detail) return [];
    const TARGET = fontSize * 40; // 字号越大每页字数越少
    const result: { chapterIndex: number; paras: string[] }[] = [];
    let current: string[] = [];
    let len = 0;
    detail.chapters.forEach((ch, ci) => {
      const paras = ch.text
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const p of paras) {
        current.push(p);
        len += p.length;
        if (len >= TARGET) {
          result.push({ chapterIndex: ci, paras: current });
          current = [];
          len = 0;
        }
      }
    });
    if (current.length > 0) {
      result.push({
        chapterIndex: detail.chapters.length - 1,
        paras: current,
      });
    }
    return result;
  }, [detail, fontSize]);

  // 滚动监听：更新当前章节 + 防抖保存进度
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    hasReadRef.current = true;
    const ratio =
      el.scrollHeight - el.clientHeight > 0
        ? el.scrollTop / (el.scrollHeight - el.clientHeight)
        : 0;
    ratioRef.current = ratio;

    // 定位当前章节
    let ci = 0;
    for (let i = 0; i < chapterRefs.current.length; i++) {
      const ref = chapterRefs.current[i];
      if (ref && ref.offsetTop <= el.scrollTop + el.clientHeight * 0.3) {
        ci = i;
      }
    }
    setCurrentChapter(ci);
    scheduleSave({ mode: "scroll", ratio });
  }, [scheduleSave]);

  const goChapter = (ci: number) => {
    if (mode === "page") {
      // 翻页模式：跳到该章节的第一页
      let idx = 0;
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].chapterIndex === ci) {
          idx = i;
          break;
        }
      }
      hasReadRef.current = true;
      setPageIndex(idx);
      ratioRef.current = pages.length > 1 ? idx / (pages.length - 1) : 0;
      scheduleSave({ mode: "page", page: idx });
    } else {
      chapterRefs.current[ci]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 切换阅读模式
  const toggleMode = () => {
    const next: ReadMode = mode === "scroll" ? "page" : "scroll";
    setMode(next);
    modeRef.current = next;
    if (next === "page") {
      // 从滚动比例估算页码
      const idx = Math.min(
        pages.length - 1,
        Math.max(0, Math.round(ratioRef.current * (pages.length - 1)))
      );
      setPageIndex(idx);
      scheduleSave({ mode: "page", page: idx });
    } else {
      // 从页码估算滚动比例
      const ratio = pages.length > 1 ? pageIndexRef.current / (pages.length - 1) : 0;
      ratioRef.current = ratio;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = ratio * scrollRef.current.scrollHeight;
        }
      });
      scheduleSave({ mode: "scroll", ratio });
    }
  };

  const adjustFont = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT, Math.max(MIN_FONT, prev + delta));
      try {
        localStorage.setItem(FONT_KEY, String(next));
      } catch {
        // 忽略
      }
      return next;
    });
  };

  const prevPage = () => {
    if (pageIndex > 0) {
      const idx = pageIndex - 1;
      hasReadRef.current = true;
      setPageIndex(idx);
      ratioRef.current = pages.length > 1 ? idx / (pages.length - 1) : 0;
      scheduleSave({ mode: "page", page: idx });
    }
  };
  const nextPage = () => {
    if (pageIndex < pages.length - 1) {
      const idx = pageIndex + 1;
      hasReadRef.current = true;
      setPageIndex(idx);
      ratioRef.current = pages.length > 1 ? idx / (pages.length - 1) : 0;
      scheduleSave({ mode: "page", page: idx });
    }
  };

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modeRef.current !== "page") return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") nextPage();
      if (e.key === "ArrowLeft") prevPage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-ink-light mb-4">{loadError}</p>
          <Link
            href="/"
            className="px-6 py-2 bg-accent text-white rounded-lg font-sans text-sm hover:bg-accent-dark transition-colors"
          >
            返回书架
          </Link>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-paper-300 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const bookTitle = detail.meta.title || detail.meta.fileName.replace(/\.(pdf|epub)$/i, "");
  const bookAuthor = detail.meta.author || "未知作者";
  const percent = Math.round(
    mode === "page"
      ? (pages.length > 1 ? pageIndex / (pages.length - 1) : 0) * 100
      : ratioRef.current * 100
  );
  const currentPage = pages[pageIndex];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="border-b border-paper-200 bg-white px-3 sm:px-6 py-2.5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="text-ink-muted hover:text-ink transition-colors font-sans text-sm shrink-0"
            >
              ← 书架
            </Link>
            <div className="min-w-0">
              <h1 className="font-serif text-ink text-sm sm:text-base truncate">
                《{bookTitle}》
                <span className="text-ink-muted font-sans text-xs ml-1.5">
                  {bookAuthor}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 进度 */}
            <span className="hidden sm:inline text-xs text-ink-muted font-sans tabular-nums">
              {percent}%
            </span>

            {/* 字号调节 */}
            <div className="flex items-center border border-paper-200 rounded-lg overflow-hidden">
              <button
                onClick={() => adjustFont(-1)}
                disabled={fontSize <= MIN_FONT}
                className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-100 transition-colors disabled:opacity-30 font-sans text-sm"
                title="减小字号"
              >
                A−
              </button>
              <button
                onClick={() => adjustFont(1)}
                disabled={fontSize >= MAX_FONT}
                className="w-8 h-8 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-100 transition-colors disabled:opacity-30 font-sans text-sm"
                title="增大字号"
              >
                A+
              </button>
            </div>

            {/* 翻页模式切换 */}
            <button
              onClick={toggleMode}
              className="px-2.5 h-8 rounded-lg border font-sans text-xs transition-colors border-paper-200 text-ink-muted hover:border-accent-light hover:text-ink"
              title="切换滚动/翻页模式"
            >
              {mode === "scroll" ? "📖 翻页" : "↕ 滚动"}
            </button>

            {/* 对话按钮 */}
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`px-3 h-8 rounded-lg font-sans text-xs transition-colors ${
                chatOpen
                  ? "bg-accent text-white"
                  : "border border-accent text-accent hover:bg-accent hover:text-white"
              }`}
            >
              💬 对话
            </button>
          </div>
        </div>
      </header>

      {/* 主体：目录 + 正文 + 对话面板 */}
      <div className="flex-1 flex min-h-0">
        {/* 章节目录（PC） */}
        <aside
          className={`hidden md:flex w-52 lg:w-56 shrink-0 border-r border-paper-200 bg-paper-50 flex-col ${
            chatOpen ? "md:hidden" : ""
          }`}
        >
          <div className="px-4 py-3 text-xs font-sans text-ink-muted border-b border-paper-200">
            目录 · {detail.chapters.length} 章
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {detail.chapters.map((ch, ci) => {
              const level = ch.level ?? 1;
              // 按层级缩进 + 字号区分：一级章节最突出，二级缩进，三级更缩进更小
              const indent =
                level >= 3
                  ? "pl-12 text-xs"
                  : level === 2
                  ? "pl-8 text-[13px]"
                  : "pl-4 text-sm font-medium";
              return (
                <button
                  key={ci}
                  onClick={() => goChapter(ci)}
                  className={`block w-full text-left py-1.5 pr-3 font-sans truncate transition-colors border-l-2 ${indent} ${
                    currentChapter === ci && mode === "scroll"
                      ? "text-accent bg-accent/5 border-accent"
                      : "text-ink-light hover:text-ink hover:bg-paper-100 border-transparent"
                  }`}
                >
                  {ch.title}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 正文区 */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-paper-50">
          {mode === "scroll" ? (
            /* 滚动模式 */
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
                {detail.chapters.map((ch, ci) => (
                  <section
                    key={ci}
                    ref={(el) => {
                      chapterRefs.current[ci] = el;
                    }}
                    className="mb-12"
                  >
                    <h2
                      className="font-serif text-ink font-bold mb-6"
                      style={{
                        fontSize:
                          (ch.level ?? 1) === 1
                            ? fontSize + 6
                            : (ch.level ?? 1) === 2
                            ? fontSize + 3
                            : fontSize,
                      }}
                    >
                      {ch.title}
                    </h2>
                    <div style={{ fontSize }}>
                      {ch.text
                        .split(/\n+/)
                        .map((p) => p.trim())
                        .filter((p) => p.length > 0)
                        .map((p, pi) => (
                          <p
                            key={pi}
                            className="text-ink leading-[1.9] mb-4 whitespace-pre-wrap"
                          >
                            {p}
                          </p>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            /* 翻页模式 */
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12 min-h-full flex flex-col">
                {currentPage ? (
                  <>
                    <h2
                      className="font-serif text-ink font-bold mb-6"
                      style={{
                        fontSize:
                          (detail.chapters[currentPage.chapterIndex]?.level ?? 1) === 1
                            ? fontSize + 6
                            : (detail.chapters[currentPage.chapterIndex]?.level ?? 1) === 2
                            ? fontSize + 3
                            : fontSize,
                      }}
                    >
                      {detail.chapters[currentPage.chapterIndex]?.title}
                    </h2>
                    <div className="flex-1" style={{ fontSize }}>
                      {currentPage.paras.map((p, pi) => (
                        <p
                          key={pi}
                          className="text-ink leading-[1.9] mb-4 whitespace-pre-wrap"
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                    <div className="mt-8 pt-4 border-t border-paper-200 flex items-center justify-between">
                      <button
                        onClick={prevPage}
                        disabled={pageIndex === 0}
                        className="px-4 py-2 rounded-lg border border-paper-300 text-ink-light font-sans text-sm hover:border-accent-light hover:text-ink transition-colors disabled:opacity-30"
                      >
                        ← 上一页
                      </button>
                      <span className="text-xs text-ink-muted font-sans tabular-nums">
                        {pageIndex + 1} / {pages.length}
                      </span>
                      <button
                        onClick={nextPage}
                        disabled={pageIndex >= pages.length - 1}
                        className="px-4 py-2 rounded-lg border border-paper-300 text-ink-light font-sans text-sm hover:border-accent-light hover:text-ink transition-colors disabled:opacity-30"
                      >
                        下一页 →
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-ink-muted font-sans text-sm">没有可显示的内容</p>
                )}
              </div>
            </div>
          )}

          {/* 对话入口浮动按钮（手机端 & 面板未打开时） */}
          {!chatOpen && (
            <button
              onClick={() => setChatOpen(true)}
              className="absolute bottom-5 right-4 sm:right-6 md:hidden flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-accent text-white shadow-lg font-sans text-sm hover:bg-accent-dark transition-colors"
            >
              💬 跟作者聊聊
            </button>
          )}
        </div>

        {/* 对话面板（PC 右侧分栏 / 手机全屏抽屉） */}
        {chatOpen && (
          <>
            {/* 手机遮罩 */}
            <div
              className="fixed inset-0 bg-black/30 z-30 md:hidden"
              onClick={() => setChatOpen(false)}
            />
            <div className="fixed inset-0 md:static md:inset-auto z-40 md:z-auto md:w-[380px] lg:w-[420px] md:shrink-0 md:border-l md:border-paper-200 bg-white flex flex-col">
              <ChatPanel bookId={bookId} onClose={() => setChatOpen(false)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
