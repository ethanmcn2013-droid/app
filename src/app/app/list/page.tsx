import { AppPageHeader } from "@/components/app/page-header";
import { RoomBrief } from "@/components/app/room/room-brief";
import { ListApp } from "@/components/app/list/list-app";

export default function ListPage() {
  return (
    <>
      <AppPageHeader brief={<RoomBrief />} />
      <ListApp />
    </>
  );
}
