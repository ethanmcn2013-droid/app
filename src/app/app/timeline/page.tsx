import { AppPageHeader } from "@/components/app/page-header";
import { RoomBrief } from "@/components/app/room/room-brief";
import { TimelineApp } from "@/components/app/timeline/timeline-app";

export default function TimelinePage() {
  return (
    <>
      <AppPageHeader brief={<RoomBrief />} />
      <TimelineApp />
    </>
  );
}
