import type { Metadata } from "next";
import { PipelineStatusView } from "@/components/PipelineStatus";

export const metadata: Metadata = { title: "Pipeline · Thai Oil Pulse" };

export default function PipelinePage() {
  return <PipelineStatusView />;
}
