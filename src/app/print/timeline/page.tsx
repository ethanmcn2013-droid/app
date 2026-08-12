import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { PrintTimeline } from "@/components/app/print/print-timeline";
import {
  gatePrintProject,
  PrintRefusal,
  type PrintSearchParams,
} from "../print-project";

export default async function PrintTimelinePage({
  searchParams,
}: {
  searchParams: PrintSearchParams;
}) {
  const gate = await gatePrintProject("/print/timeline", searchParams);
  if (gate.kind === "refused") return <PrintRefusal />;
  const ws = gate.workspaceId;

  const [tasks, workspaceName] = await Promise.all([
    getTasks(ws),
    getWorkspaceName(ws),
  ]);

  const generatedAt = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <PrintTimeline
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
