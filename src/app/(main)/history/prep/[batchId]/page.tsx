import { HistoryPrepBatchClient } from "@/components/history/HistoryPrepBatchClient";

export default async function HistoryPrepBatchPage(props: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await props.params;
  return <HistoryPrepBatchClient batchId={batchId} />;
}
