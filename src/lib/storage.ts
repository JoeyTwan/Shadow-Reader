/**
 * 文件存储工具
 *
 * 管理上传的书籍文件（PDF/EPUB）和提取的文本。
 * MVP 阶段使用本地文件系统存储。
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function getBookFilePath(bookId: string, ext: string = "pdf"): string {
  return path.join(UPLOAD_DIR, `${bookId}.${ext}`);
}

export function getBookTextPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.txt`);
}

export function getBookMetaPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.meta.json`);
}

export function getConversationPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.conversation.json`);
}

export async function saveBookFile(bookId: string, buffer: Buffer, ext: string = "pdf") {
  await ensureUploadDir();
  await writeFile(getBookFilePath(bookId, ext), buffer);
}

export async function saveBookText(bookId: string, text: string) {
  await ensureUploadDir();
  await writeFile(getBookTextPath(bookId), text, "utf-8");
}

export async function saveBookMeta(bookId: string, meta: object) {
  await ensureUploadDir();
  await writeFile(getBookMetaPath(bookId), JSON.stringify(meta, null, 2), "utf-8");
}

export async function readBookText(bookId: string): Promise<string> {
  return readFile(getBookTextPath(bookId), "utf-8");
}

export interface BookMeta {
  bookId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number;
  chapterCount?: number;
  title?: string;
  author?: string;
  uploadedAt: string;
  textLength: number;
}

export async function readBookMeta(bookId: string): Promise<BookMeta> {
  const data = await readFile(getBookMetaPath(bookId), "utf-8");
  return JSON.parse(data);
}

export function generateBookId(): string {
  return crypto.randomUUID();
}

/**
 * 对话记录持久化
 *
 * 每本书一份对话记录文件，结构：
 * {
 *   bookId, bookTitle,
 *   messages: ConversationMessage[],
 *   insights: InsightSummary | null   // 最近一次思想总结
 * }
 */

export interface ConversationFile {
  bookId: string;
  bookTitle: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }[];
  insights: unknown | null;
}

export async function readConversation(bookId: string): Promise<ConversationFile | null> {
  try {
    const data = await readFile(getConversationPath(bookId), "utf-8");
    return JSON.parse(data);
  } catch {
    // 文件不存在视为还没有对话
    return null;
  }
}

export async function saveConversation(
  bookId: string,
  conversation: ConversationFile
): Promise<void> {
  await ensureUploadDir();
  await writeFile(
    getConversationPath(bookId),
    JSON.stringify(conversation, null, 2),
    "utf-8"
  );
}
