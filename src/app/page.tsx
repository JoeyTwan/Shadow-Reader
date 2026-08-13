import Link from "next/link";
import PdfUpload from "@/components/PdfUpload";
import { listBooks, type BookShelfItem } from "@/lib/storage";

// 书架数据来自本地文件系统，每次请求都重新读取
export const dynamic = "force-dynamic";

// 封面占位色板（按 bookId 哈希取色）
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

export default async function Home() {
  const books = await listBooks();

  return (
    <main className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-paper-200 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-serif text-ink">
              Shadow Reader
            </span>
            <span className="text-sm text-ink-muted font-sans">
              影子读者
            </span>
          </div>
          {books.length > 0 && <PdfUpload compact />}
        </div>
      </header>

      {/* 主要内容区 */}
      <div className="flex-1 px-4 sm:px-8 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {books.length === 0 ? (
            /* 空状态：产品标语 + 上传引导 */
            <>
              <div className="text-center mb-10 sm:mb-12 animate-fade-in">
                <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-4 leading-relaxed">
                  不是让 AI 替你读书
                  <br />
                  而是让 AI 陪你一起思考
                </h1>
                <p className="text-ink-light font-sans text-base leading-relaxed">
                  上传一本书，像走进作者的房间。
                  <br />
                  你读他的书，随时与他本人讨论。
                  <br />
                  你形成观点，它帮你记录和梳理。
                </p>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <PdfUpload />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-ink text-xl sm:text-2xl">
                  我的书架
                </h2>
                <span className="text-sm text-ink-muted font-sans">
                  {books.length} 本
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {books.map((book) => (
                  <BookCard key={book.bookId} book={book} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 页脚 */}
      <footer className="border-t border-paper-200 px-8 py-6">
        <div className="max-w-5xl mx-auto text-center text-sm text-ink-muted font-sans">
          Shadow Reader — 阅读不是孤独的。
        </div>
      </footer>
    </main>
  );
}

function BookCard({ book }: { book: BookShelfItem }) {
  const title = book.title || book.fileName.replace(/\.(pdf|epub)$/i, "");
  const author = book.author || "未知作者";
  const firstChar = title.trim().charAt(0) || "书";
  const ratio = book.progress?.scrollRatio ?? 0;
  const percent = Math.round(ratio * 100);

  return (
    <Link
      href={`/read/${book.bookId}`}
      className="group bg-white border border-paper-200 rounded-xl overflow-hidden hover:shadow-md hover:border-accent-light transition-all animate-fade-in"
    >
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
  );
}
