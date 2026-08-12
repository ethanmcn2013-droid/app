import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getColumnConfig } from "@/server/actions/board";
import { publicBoardColumns } from "@/lib/public-board-lanes";
import { PrintBoard } from "@/components/app/print/print-board";
import {
  gatePrintProject,
  PrintRefusal,
  type PrintSearchParams,
} from "../print-project";

export default async function PrintBoardPage({
  searchParams,
}: {
  searchParams: PrintSearchParams;
}) {
  const gate = await gatePrintProject("/print/board", searchParams);
  if (gate.kind === "refused") return <PrintRefusal />;
  const ws = gate.workspaceId;

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
