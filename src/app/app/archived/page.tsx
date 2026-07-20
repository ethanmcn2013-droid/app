import { getArchivedTasks } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { AppPageHeader } from "@/components/app/page-header";
import { ArchivedApp } from "@/components/app/archived/archived-app";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const ws = await getActiveWorkspace();
  const tasks = await getArchivedTasks(ws);
  return (
    <>
      <AppPageHeader />
      <ArchivedApp tasks={tasks} />
    </>
  );
}
