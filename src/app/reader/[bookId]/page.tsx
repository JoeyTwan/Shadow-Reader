import ReaderClient from "@/components/ReaderClient";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  return <ReaderClient bookId={bookId} />;
}
