import { getTasks, getWorkspaceName } from "@/server/db/queries";
import { PrintCalendar } from "@/components/app/print/print-calendar";
import {
  gatePrintProject,
  PrintRefusal,
  type PrintSearchParams,
} from "../print-project";

export default async function PrintCalendarPage({
  searchParams,
}: {
  searchParams: PrintSearchParams;
}) {
  const gate = await gatePrintProject("/print/calendar", searchParams);
  if (gate.kind === "refused") return <PrintRefusal />;
  const ws = gate.workspaceId;

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
    <PrintCalendar
      tasks={tasks}
      workspaceName={workspaceName}
      generatedAt={generatedAt}
    />
  );
}
