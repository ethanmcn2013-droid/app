import { AppPageHeader } from "@/components/app/page-header";
import { MyWeekApp } from "@/components/app/my-week/my-week-app";

export const dynamic = "force-dynamic";

export default function MyTasksPage() {
  return (
    <>
      <AppPageHeader />
      <MyWeekApp />
    </>
  );
}
