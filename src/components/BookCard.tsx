"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BookShelfItem } from "@/lib/storage";

const COVER_COLORS = [
  "bg-[#8b7355]",
  "bg-[#5b6d8a]",
  "bg-[#7a6a5f]",
  "bg-[#4e6e5d]",
  "bg-[#8a5a5a]",
  "bg-[#6b5b8a]",
];

function coverColor(bookId: string): string {
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash * 31 + bookId.charCodeAt(i)) >>> 0;
  }
  return COVER_COLORS[hash % COVER_COLORS.length];
}

export default function BookCard({ book }: { book: BookShelfItem }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const title = book.title || book.fileName.replace(/\.(pdf|epub)$/i, "");
  const author = book.author || "未知作者";
  const firstChar = title.trim().charAt(0) || "书";
  const ratio = book.progress?.scrollRatio ?? 0;
  const percent = Math.round(ratio * 100);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  const closeModal = () => {
    if (deleting) return;
    setShowModal(false);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/books/${book.bookId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowModal(false);
        router.refresh();
      }
    } catch {
      // 静默失败，用户可重试
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="group relative bg-white border border-paper-200 rounded-xl overflow-hidden hover:shadow-md hover:border-accent-light transition-all animate-fade-in">
        {/* 删除按钮 */}
        <button
          onClick={openModal}
          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full text-sm font-sans bg-black/30 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
          title="删除这本书"
        >
          ×
        </button>

        <Link href={`/read/${book.bookId}`} className="block">
          {/* 封面占位 */}
          <div
            className={`${coverColor(book.bookId)} h-32 sm:h-40 flex items-center justify-center`}
          >
            <span className="text-4xl sm:text-5xl font-serif text-white/90">
              {firstChar}
            </span>
          </div>
          <div className="p-3 sm:p-4">
            <h3 className="font-serif text-ink text-sm sm:text-base truncate group-hover:text-accent transition-colors">
              {title}
            </h3>
            <p className="text-xs text-ink-muted font-sans mt-0.5 truncate">
              {author}
            </p>
            {/* 阅读进度 */}
            <div className="mt-3">
              <div className="h-1 rounded-full bg-paper-100 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-muted font-sans mt-1.5 flex items-center justify-between">
                <span>{percent > 0 ? `已读 ${percent}%` : "未开始"}</span>
                <span className="group-hover:text-accent transition-colors">
                  继续阅读 →
                </span>
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* 删除确认弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>

            <h4 className="text-center font-serif text-ink text-lg mb-1">
              删除这本书？
            </h4>
            <p className="text-center text-sm text-ink-light font-sans mb-1">
              《{title}》
            </p>
            <p className="text-center text-xs text-ink-muted font-sans leading-relaxed">
              删除后，阅读进度、对话记录和思想总结都将一起清空，且无法恢复。
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-paper-300 text-ink-light rounded-xl font-sans text-sm hover:bg-paper-100 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-sans text-sm hover:bg-red-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deleting && (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {deleting ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
