import { requireAppAccessTasks } from "@/server/app-access";
import { AutomationsList } from "@/components/app/automations/automations-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automations · Signal Studio" };

/**
 * /app/automations: a preview. The page reads nothing from the server and
 * writes nothing to it: every draft is kept in the reader's own browser, and
 * nothing runs. The gate is the same one the /app layout runs.
 */
export default async function AutomationsPage() {
  await requireAppAccessTasks();
  return <AutomationsList />;
}
