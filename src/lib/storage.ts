/**
 * 文件存储工具
 *
 * 管理上传的 PDF 文件和提取的文本。
 * MVP 阶段使用本地文件系统存储。
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function getBookFilePath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.pdf`);
}

export function getBookTextPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.txt`);
}

export function getBookMetaPath(bookId: string): string {
  return path.join(UPLOAD_DIR, `${bookId}.meta.json`);
}

export async function saveBookFile(bookId: string, buffer: Buffer) {
  await ensureUploadDir();
  await writeFile(getBookFilePath(bookId), buffer);
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
  fileSize: number;
  pageCount: number;
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
