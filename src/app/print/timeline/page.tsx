import { getTasks } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { PrintTimeline } from "@/components/app/print/print-timeline";

export default async function PrintTimelinePage() {
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
    <PrintTimeline
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
