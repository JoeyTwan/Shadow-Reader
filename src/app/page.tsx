import PdfUpload from "@/components/PdfUpload";
import BookCard from "@/components/BookCard";
import { listBooks } from "@/lib/storage";

// 书架数据来自本地文件系统，每次请求都重新读取
export const dynamic = "force-dynamic";

export default async function Home() {
  const books = await listBooks();

  return (
    <main className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-paper-200 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif text-ink leading-none">
              Shadow Reader<span className="text-ink-muted mx-1.5">·</span>影子读者
            </h1>
            <p className="text-xs text-ink-muted font-sans mt-1.5">
              不是让 AI 替你读书，而是让 AI 陪你一起思考
            </p>
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
                <h2 className="text-2xl sm:text-3xl font-serif text-ink mb-4 leading-relaxed">
                  不是让 AI 替你读书
                  <br />
                  而是让 AI 陪你一起思考
                </h2>
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
