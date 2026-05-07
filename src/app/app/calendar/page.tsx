import { AppPageHeader } from "@/components/app/page-header";
import { CalendarApp } from "@/components/app/calendar/calendar-app";
import { getActiveWorkspace } from "@/server/auth";

export default async function CalendarPage() {
  const workspaceId = await getActiveWorkspace();
  return (
    <>
      <AppPageHeader />
      <CalendarApp workspaceId={workspaceId} />
    </>
  );
}
