import { requireAppAccessTasks } from "@/server/app-access";
import { AutomationEditor } from "@/components/app/automations/automation-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automation · Signal Studio" };

/**
 * /app/automations/[id]: one draft on the canvas. The id names a draft in
 * the reader's own browser; the server knows nothing about it, so there is
 * nothing here to look up, authorize or leak. A draft this browser does not
 * hold is answered in the page ("This draft is not in this browser").
 */
export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppAccessTasks();
  const { id } = await params;
  return <AutomationEditor id={id} />;
}
