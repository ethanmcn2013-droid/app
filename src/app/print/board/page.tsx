import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { getColumnConfig } from "@/server/actions/board";
import { publicBoardColumns } from "@/lib/public-board-lanes";
import { PrintBoard } from "@/components/app/print/print-board";

export default async function PrintBoardPage() {
  const ws = await getActiveWorkspace();
  const [tasks, workspaceName, columnConfig] = await Promise.all([
    getTasks(ws),
    getWorkspaceName(ws),
    getColumnConfig(ws),
  ]);
  const columns = publicBoardColumns(columnConfig, tasks);

  const generatedAt = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <PrintBoard
      columns={columns}
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
