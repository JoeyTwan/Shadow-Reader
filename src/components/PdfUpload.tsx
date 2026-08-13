"use client";

import { useState, useCallback, useRef } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  bookId: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
}

export default function PdfUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setStatus("error");
      setErrorMessage("请上传 PDF 格式的文件");
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      setStatus("error");
      setErrorMessage("文件大小不能超过 50MB");
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
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "上传失败，请重试");
    }
  }, []);

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
      {status === "success" && result ? (
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
          <h3 className="font-serif text-ink text-lg mb-2">上传成功</h3>
          <p className="text-sm text-ink-light font-sans mb-1">
            {result.fileName}
          </p>
          <p className="text-xs text-ink-muted font-sans mb-6">
            {formatFileSize(result.fileSize)} · {result.pageCount} 页
          </p>
          <div className="flex gap-3 justify-center">
            <button
              className="px-6 py-2 bg-accent text-white rounded-lg font-sans text-sm hover:bg-accent-dark transition-colors"
              onClick={() => {
                // 后续跳转到对话页面
                window.location.href = `/reader?id=${result.bookId}`;
              }}
            >
              开始阅读
            </button>
            <button
              className="px-6 py-2 border border-paper-300 text-ink-light rounded-lg font-sans text-sm hover:bg-paper-100 transition-colors"
              onClick={handleReset}
            >
              重新上传
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
            accept="application/pdf"
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
                拖拽 PDF 文件到此处
              </p>
              <p className="text-sm text-ink-muted font-sans">
                或点击选择文件 · 最大 50MB
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
