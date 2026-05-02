import { HistoryDetailClient } from "@/components/history/HistoryDetailClient";

export default async function HistoryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <HistoryDetailClient docId={id} />;
}
