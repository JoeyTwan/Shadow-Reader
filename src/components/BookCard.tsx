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
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const title = book.title || book.fileName.replace(/\.(pdf|epub)$/i, "");
  const author = book.author || "未知作者";
  const firstChar = title.trim().charAt(0) || "书";
  const ratio = book.progress?.scrollRatio ?? 0;
  const percent = Math.round(ratio * 100);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/books/${book.bookId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // 静默失败，用户可重试
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="group relative bg-white border border-paper-200 rounded-xl overflow-hidden hover:shadow-md hover:border-accent-light transition-all animate-fade-in">
      {/* 删除按钮 */}
      <button
        onClick={handleDelete}
        onMouseLeave={() => confirming && setConfirming(false)}
        disabled={deleting}
        className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full text-sm font-sans transition-all ${
          deleting
            ? "bg-red-500 text-white opacity-70"
            : confirming
            ? "bg-red-500 text-white opacity-100"
            : "bg-black/30 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500"
        }`}
        title={confirming ? "再点一次确认删除" : "删除这本书"}
      >
        {deleting ? (
          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : confirming ? (
          "确认?"
        ) : (
          "×"
        )}
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
  );
}
