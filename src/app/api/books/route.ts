import { NextResponse } from "next/server";
import { listBooks } from "@/lib/storage";

export const dynamic = "force-dynamic";

// 书架列表：所有书 + 各自阅读进度
export async function GET() {
  try {
    const books = await listBooks();
    return NextResponse.json({ books });
  } catch (error) {
    console.error("[Shadow Reader] 获取书架失败:", error);
    return NextResponse.json({ error: "获取书架失败" }, { status: 500 });
  }
}
