import { redirect } from "next/navigation";
import { isFirstRun } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { getActiveWorkspaceNameAction } from "@/server/actions/import";
import { ImportApp } from "@/components/app/import/import-app";

// /app/import is a runtime, DB-backed view, never prerender it.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Import, Tasks",
};

export default async function ImportPage() {
  const ws = await getActiveWorkspace();
  // Mirror the rest of the /app shell: fresh installs land at /welcome
  // first, even if the user typed /app/import directly.
  if (await isFirstRun(ws)) {
    redirect("/welcome");
  }
  const workspaceName = await getActiveWorkspaceNameAction();
  return <ImportApp workspaceName={workspaceName} />;
}
