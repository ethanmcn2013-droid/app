import { requireAppAccessTasks } from "@/server/app-access";
import { LauncherPanel } from "@/components/shell/launcher/launcher-panel";
import { LAUNCHER_NAME } from "@/components/shell/launcher/launcher-catalog";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import { canShowMessagesForTools } from "./messages-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: `${LAUNCHER_NAME} · Signal Studio` };

/**
 * /app/tools: every app, connection and coming tool in one directory. The
 * same catalogue as the top bar's launcher, drawn as a page so deep links and
 * the sidebar row have a home.
 */
export default async function ToolsPage() {
  await requireAppAccessTasks();
  const messagesEnabled = await canShowMessagesForTools();
  return (
    <LauncherPanel
      variant="page"
      messagesEnabled={messagesEnabled}
      driveFlag={projectDriveUiEnabled()}
      currentPath="/app/tools"
    />
  );
}
