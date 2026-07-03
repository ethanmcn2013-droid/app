import { AppPageHeader } from "@/components/app/page-header";
import { CalendarApp } from "@/components/app/calendar/calendar-app";

// D4: was async + getActiveWorkspace() which caused a Suspense boundary
// against the parent /app/loading.tsx (board-shaped skeleton). workspaceId
// is already in DomainProvider context from the layout, CalendarApp reads
// it directly via useActiveWorkspace() so this page no longer suspends.
export default function CalendarPage() {
  return (
    <>
      <AppPageHeader />
      <CalendarApp />
    </>
  );
}
