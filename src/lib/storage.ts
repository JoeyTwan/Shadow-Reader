/**
 * 文件存储工具
 *
 * 管理上传的书籍文件（PDF/EPUB）和提取的文本。
 * MVP 阶段使用本地文件系统存储。
 */

import { readFile, writeFile, mkdir, readdir, unlink } from "fs/promises";
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

export function getChaptersPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.chapters.json`);
}

export function getProgressPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.progress.json`);
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

/**
 * 阅读进度持久化
 *
 * 每本书一份 progress.json：
 * {
 *   bookId, mode: "scroll" | "page",
 *   scrollRatio: 0-1（滚动模式阅读位置），
 *   pageIndex（翻页模式当前页），
 *   updatedAt
 * }
 */

export interface ReadingProgress {
  bookId: string;
  mode: "scroll" | "page";
  scrollRatio: number;
  pageIndex: number;
  updatedAt: string;
}

export async function readReadingProgress(
  bookId: string
): Promise<ReadingProgress | null> {
  try {
    const data = await readFile(getProgressPath(bookId), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveReadingProgress(progress: ReadingProgress) {
  await ensureUploadDir();
  await writeFile(
    getProgressPath(progress.bookId),
    JSON.stringify(progress, null, 2),
    "utf-8"
  );
}

/**
 * 书架：扫描 uploads 目录所有书籍元信息，合并阅读进度，按上传时间倒序。
 */
export interface BookShelfItem extends BookMeta {
  progress: ReadingProgress | null;
  lastReadAt: string;
}

export async function listBooks(): Promise<BookShelfItem[]> {
  await ensureUploadDir();
  const files = await readdir(UPLOAD_DIR);
  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

  const books = await Promise.all(
    metaFiles.map(async (f) => {
      try {
        const meta = JSON.parse(
          await readFile(path.join(UPLOAD_DIR, f), "utf-8")
        ) as BookMeta;
        const progress = await readReadingProgress(meta.bookId);
        return {
          ...meta,
          progress,
          lastReadAt: progress?.updatedAt ?? meta.uploadedAt,
        } satisfies BookShelfItem;
      } catch {
        return null;
      }
    })
  );

  return books
    .filter((b): b is BookShelfItem => b !== null)
    .sort((a, b) => (a.lastReadAt < b.lastReadAt ? 1 : -1));
}

/**
 * 删除一本书的所有关联文件（原书、文本、章节、进度、对话记录等）。
 * 采用按 bookId 前缀扫描目录的方式，确保任何后缀的文件都能删干净，
 * 不会因为新增了文件类型而留下尾巴。
 */
export async function deleteBook(bookId: string): Promise<void> {
  let files: string[];
  try {
    files = await readdir(UPLOAD_DIR);
  } catch {
    // uploads 目录不存在，无需清理
    return;
  }
  const prefix = `${bookId}.`;
  await Promise.all(
    files
      .filter((name) => name.startsWith(prefix))
      .map(async (name) => {
        try {
          await unlink(path.join(UPLOAD_DIR, name));
        } catch (e) {
          console.warn(`[Shadow Reader] 删除文件失败: ${name}`, e);
        }
      })
  );
}
