import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { PrintList } from "@/components/app/print/print-list";

export default async function PrintListPage() {
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
    <PrintList
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
