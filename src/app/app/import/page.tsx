import { redirect } from "next/navigation";
import { isFirstRun } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { getActiveWorkspaceNameAction } from "@/server/actions/import";
import { ImportApp } from "@/components/app/import/import-app";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_WORKSPACE_NAME } from "@/server/demo/tasks-demo";

// /app/import is a runtime, DB-backed view, never prerender it.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Import, Tasks",
};

export default async function ImportPage() {
  if (isDemoMode()) {
    return <ImportApp workspaceName={DEMO_WORKSPACE_NAME} />;
  }

  const ws = await getActiveWorkspace();
  // Mirror the rest of the /app shell: fresh installs land at /welcome
  // first, even if the user typed /app/import directly.
  if (await isFirstRun(ws)) {
    redirect("/welcome");
  }
  const workspaceName = await getActiveWorkspaceNameAction();
  return <ImportApp workspaceName={workspaceName} />;
}
