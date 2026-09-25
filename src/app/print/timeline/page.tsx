import { redirect } from "next/navigation";
import type { PrintSearchParams } from "../print-project";

/**
 * The Schedule print view is retired with the Schedule view. Existing print
 * links open the board print, keeping the project.
 */
export default async function PrintTimelineRedirect({
  searchParams,
}: {
  searchParams: PrintSearchParams;
}) {
  const sp = await searchParams;
  const workspaceId = Array.isArray(sp.workspaceId) ? sp.workspaceId[0] : sp.workspaceId;
  redirect(workspaceId ? `/print/board?${new URLSearchParams({ workspaceId })}` : "/print/board");
}
