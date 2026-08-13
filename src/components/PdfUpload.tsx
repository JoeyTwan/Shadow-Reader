"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UploadStatus = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

interface UploadResult {
  bookId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number;
  chapterCount: number;
}

export default function PdfUpload({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // 按扩展名校验（EPUB 的 MIME 类型不可靠）
      const validExt = /\.(pdf|epub)$/i.test(file.name);
      if (!validExt) {
        setStatus("error");
        setErrorMessage("请上传 PDF 或 EPUB 格式的文件");
        return;
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        setStatus("error");
        setErrorMessage("文件大小不能超过 200MB");
        return;
      }

      setStatus("uploading");
      setErrorMessage("");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "上传失败");
        }

        const data = await response.json();
        setResult(data);
        setStatus("success");
        // 刷新书架列表（新书出现在顶部）
        router.refresh();
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "上传失败，请重试"
        );
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleReset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {compact ? (
        <div className="flex flex-col items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "uploading"}
            className={`px-4 py-2 rounded-lg font-sans text-sm transition-colors flex items-center gap-1.5 border shrink-0 ${
              status === "error"
                ? "border-red-300 text-red-600 bg-red-50/30"
                : status === "success"
                ? "border-green-300 text-green-700 bg-green-50"
                : "border-paper-300 text-ink-light hover:border-accent-light hover:bg-paper-100"
            }`}
          >
            {status === "uploading" ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-paper-300 border-t-accent rounded-full animate-spin" />
                解析中...
              </>
            ) : status === "error" ? (
              "上传失败，点击重试"
            ) : status === "success" ? (
              "已加入书架 ✓"
            ) : (
              "＋ 上传新书"
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      ) : status === "success" && result ? (
        <div className="bg-white border border-paper-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="font-serif text-ink text-lg mb-2">
            已加入书架
          </h3>
          <p className="text-sm text-ink-light font-sans mb-1">
            {result.fileName}
          </p>
          <p className="text-xs text-ink-muted font-sans mb-6">
            {formatFileSize(result.fileSize)} ·{" "}
            {result.fileType === "epub"
              ? `${result.chapterCount} 章节`
              : `${result.pageCount} 页`}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href={`/read/${result.bookId}`}
              className="px-6 py-2 bg-accent text-white rounded-lg font-sans text-sm hover:bg-accent-dark transition-colors"
            >
              开始阅读
            </Link>
            <button
              className="px-6 py-2 border border-paper-300 text-ink-light rounded-lg font-sans text-sm hover:bg-paper-100 transition-colors"
              onClick={handleReset}
            >
              再传一本
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-accent bg-accent/5"
              : status === "error"
              ? "border-red-300 bg-red-50/30"
              : "border-paper-300 hover:border-accent-light hover:bg-paper-100/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {status === "uploading" ? (
            <div>
              <div className="w-10 h-10 mx-auto mb-4 border-3 border-paper-300 border-t-accent rounded-full animate-spin" />
              <p className="text-ink-light font-sans text-sm">
                正在上传并解析...
              </p>
            </div>
          ) : status === "error" ? (
            <div>
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="text-red-600 font-sans text-sm mb-2">
                {errorMessage}
              </p>
              <button
                className="text-accent font-sans text-sm hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
              >
                重新选择文件
              </button>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-paper-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="font-serif text-ink text-base mb-2">
                拖拽 PDF 或 EPUB 文件到此处
              </p>
              <p className="text-sm text-ink-muted font-sans">
                或点击选择文件 · 最大 200MB
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
