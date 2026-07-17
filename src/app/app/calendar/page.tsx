import { AppPageHeader } from "@/components/app/page-header";
import { RoomBrief } from "@/components/app/room/room-brief";
import { CalendarApp } from "@/components/app/calendar/calendar-app";

// D4: was async + getActiveWorkspace() which caused a Suspense boundary
// against the parent /app/loading.tsx (board-shaped skeleton). workspaceId
// is already in DomainProvider context from the layout, CalendarApp reads
// it directly via useActiveWorkspace() so this page no longer suspends.
// RoomBrief keeps that contract: its server data is fetched in the layout.
export default function CalendarPage() {
  return (
    <>
      <AppPageHeader brief={<RoomBrief />} />
      <CalendarApp />
    </>
  );
}
