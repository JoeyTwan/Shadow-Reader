import { NextResponse } from "next/server";
import { deleteBook } from "@/lib/storage";

export const dynamic = "force-dynamic";

// 删除一本书及其所有关联数据
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId } = await params;
    if (!bookId) {
      return NextResponse.json({ error: "缺少 bookId" }, { status: 400 });
    }

    await deleteBook(bookId);

    return NextResponse.json({ success: true, bookId });
  } catch (error) {
    console.error("[Shadow Reader] 删除书籍失败:", error);
    return NextResponse.json({ error: "删除书籍失败" }, { status: 500 });
  }
}
