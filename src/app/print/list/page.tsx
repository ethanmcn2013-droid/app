import { getTasks } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { PrintList } from "@/components/app/print/print-list";

export default async function PrintListPage() {
  const ws = await getActiveWorkspace();
  const [tasks, wsRow] = await Promise.all([
    getTasks(ws),
    db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, ws))
      .then((rows) => rows[0]),
  ]);

  const workspaceName = wsRow?.name ?? "Tasks";
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
