import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { PrintTimeline } from "@/components/app/print/print-timeline";

export default async function PrintTimelinePage() {
  const ws = await getActiveWorkspace();
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
