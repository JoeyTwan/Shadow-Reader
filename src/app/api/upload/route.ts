import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

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
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
    }

    // 验证文件类型
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "请上传 PDF 格式的文件" },
        { status: 400 }
      );
    }

    // 验证文件大小（50MB）
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小不能超过 50MB" },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成唯一 bookId
    const bookId = crypto.randomUUID();

    // 确保上传目录存在
    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    // 保存 PDF 文件
    const filePath = path.join(uploadDir, `${bookId}.pdf`);
    await writeFile(filePath, buffer);

    // 解析 PDF 获取基本信息
    const pdfData = await parsePdf(buffer);

    // 保存提取的文本（后续 AI 分析用）
    const textPath = path.join(uploadDir, `${bookId}.txt`);
    await writeFile(textPath, pdfData.text, "utf-8");

    // 保存书籍元信息
    const metaPath = path.join(uploadDir, `${bookId}.meta.json`);
    const meta = {
      bookId,
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdfData.pageCount,
      uploadedAt: new Date().toISOString(),
      textLength: pdfData.text.length,
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    console.log(`[Shadow Reader] 书籍上传成功: ${file.name} (${bookId})`);

    return NextResponse.json({
      bookId,
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdfData.pageCount,
    });
  } catch (error) {
    console.error("[Shadow Reader] 上传失败:", error);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
