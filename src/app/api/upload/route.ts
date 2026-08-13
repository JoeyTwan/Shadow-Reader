import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_EXTENSIONS = [".pdf", ".epub"];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// PDF 解析使用动态导入，避免构建时问题
async function parsePdf(buffer: Buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error) {
    console.error("PDF 解析失败:", error);
    return {
      text: "",
      pageCount: 0,
    };
  }
}

export async function POST(request: NextRequest) {
  let bookId = "";
  let uploadDir = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
    }

    // 校验扩展名（MIME 类型不可靠，EPUB 常被识别为 octet-stream）
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "请上传 PDF 或 EPUB 格式的文件" },
        { status: 400 }
      );
    }

    // 校验文件大小（200MB）
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件大小不能超过 200MB" },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成唯一 bookId
    bookId = crypto.randomUUID();

    // 确保上传目录存在
    uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    // 保存原始文件
    const filePath = path.join(uploadDir, `${bookId}${ext}`);
    await writeFile(filePath, buffer);

    // 按格式解析提取文本
    let text = "";
    let pageCount = 0;
    let chapterCount = 0;
    let bookTitle = "";
    let bookAuthor = "";
    let chapters: { title: string; text: string }[] | null = null;

    if (ext === ".pdf") {
      const pdfData = await parsePdf(buffer);
      text = pdfData.text;
      pageCount = pdfData.pageCount;
    } else {
      const { extractEpub } = await import("@/lib/epub");
      const epubData = await extractEpub(buffer);
      text = epubData.text;
      chapterCount = epubData.chapterCount;
      bookTitle = epubData.title;
      bookAuthor = epubData.author;
      chapters = epubData.chapters;
    }

    // 保存提取的文本（后续 AI 分析用）
    const textPath = path.join(uploadDir, `${bookId}.txt`);
    await writeFile(textPath, text, "utf-8");

    // EPUB 额外保存章节结构（阅读器目录/翻页用）
    if (chapters) {
      const chaptersPath = path.join(uploadDir, `${bookId}.chapters.json`);
      await writeFile(
        chaptersPath,
        JSON.stringify(chapters, null, 2),
        "utf-8"
      );
    }

    // 初始化阅读进度（从 0 开始）
    const progressPath = path.join(uploadDir, `${bookId}.progress.json`);
    await writeFile(
      progressPath,
      JSON.stringify(
        {
          bookId,
          mode: "scroll",
          scrollRatio: 0,
          pageIndex: 0,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );

    // 保存书籍元信息
    const metaPath = path.join(uploadDir, `${bookId}.meta.json`);
    const meta = {
      bookId,
      fileName: file.name,
      fileType: ext.slice(1),
      fileSize: file.size,
      pageCount,
      chapterCount,
      title: bookTitle,
      author: bookAuthor,
      uploadedAt: new Date().toISOString(),
      textLength: text.length,
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    console.log(
      `[Shadow Reader] 书籍上传成功: ${file.name} (${bookId}, ${ext.slice(1)})`
    );

    return NextResponse.json({
      bookId,
      fileName: file.name,
      fileType: ext.slice(1),
      fileSize: file.size,
      pageCount,
      chapterCount,
      title: bookTitle,
    });
  } catch (error) {
    console.error("[Shadow Reader] 上传失败:", error);
    // 清理本次上传已写入的孤儿文件（原书/文本/章节等），不留尾巴
    if (bookId && uploadDir) {
      try {
        const { readdir: listDir, unlink: removeFile } = await import(
          "fs/promises"
        );
        const files = await listDir(uploadDir);
        await Promise.all(
          files
            .filter((name) => name.startsWith(`${bookId}.`))
            .map((name) => removeFile(path.join(uploadDir, name)).catch(() => {}))
        );
        console.log(`[Shadow Reader] 已清理失败上传的残留文件: ${bookId}`);
      } catch (cleanupError) {
        console.warn("[Shadow Reader] 清理残留文件失败:", cleanupError);
      }
    }
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
