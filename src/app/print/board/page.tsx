import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { PrintBoard } from "@/components/app/print/print-board";

export default async function PrintBoardPage() {
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
    <PrintBoard
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
