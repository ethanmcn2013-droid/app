import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { PrintList } from "@/components/app/print/print-list";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import {
  gatePrintProject,
  PrintRefusal,
  type PrintSearchParams,
} from "../print-project";

export default async function PrintListPage({
  searchParams,
}: {
  searchParams: PrintSearchParams;
}) {
  const gate = await gatePrintProject("/print/list", searchParams);
  if (gate.kind === "refused") return <PrintRefusal />;
  const ws = gate.workspaceId;

  const [tasks, workspaceName, columnConfig] = await Promise.all([
    getTasks(ws),
    getWorkspaceName(ws),
    readWorkspaceColumnConfig(ws),
  ]);

  const generatedAt = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <PrintList
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
      columnConfig={columnConfig}
    />
  );
}
