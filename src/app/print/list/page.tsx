import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { PrintList } from "@/components/app/print/print-list";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";

export default async function PrintListPage() {
  const ws = await getActiveWorkspace();
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
