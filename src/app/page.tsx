import PdfUpload from "@/components/PdfUpload";

export default function Home() {
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
          <div className="text-sm text-ink-muted font-sans">
            MVP 阶段
          </div>
        </div>
      </header>

      {/* 主要内容区 */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12 sm:py-16">
        <div className="max-w-2xl w-full">
          {/* 标语 */}
          <div className="text-center mb-10 sm:mb-12 animate-fade-in">
            <h1 className="text-2xl sm:text-3xl font-serif text-ink mb-4 leading-relaxed">
              不是让 AI 替你读书
              <br />
              而是让 AI 陪你一起思考
            </h1>
            <p className="text-ink-light font-sans text-base leading-relaxed">
              你读一本书，影子读者也在读。
              <br />
              你产生疑问，作者本人与你讨论。
              <br />
              你形成观点，它帮你记录和梳理。
            </p>
          </div>

          {/* 书籍上传区域 */}
          <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <PdfUpload />
          </div>

          {/* 功能说明 */}
          <div className="mt-16 grid grid-cols-1 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FeatureItem
              step="01"
              title="上传"
              description="上传一本 PDF 或 EPUB 书籍，开启阅读旅程"
            />
            <FeatureItem
              step="02"
              title="理解"
              description="AI 深度分析书籍内容：核心思想、章节结构、关键概念"
            />
            <FeatureItem
              step="03"
              title="对话"
              description="以作者本人的身份与 AI 讨论，求同存异，不讨好你"
            />
            <FeatureItem
              step="04"
              title="记录"
              description="点击「思想总结」，AI 梳理你的观点与思想变化"
            />
          </div>
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

function FeatureItem({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-paper-100 transition-colors">
      <span className="text-accent font-serif text-lg shrink-0">{step}</span>
      <div>
        <h3 className="font-serif text-ink text-base mb-1">{title}</h3>
        <p className="text-sm text-ink-light font-sans">{description}</p>
      </div>
    </div>
  );
}
