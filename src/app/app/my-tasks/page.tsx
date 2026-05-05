import { AppPageHeader } from "@/components/app/page-header";
import { MyTasksApp } from "@/components/app/my-tasks/my-tasks-app";

export const dynamic = "force-dynamic";

export default function MyTasksPage() {
  return (
    <>
      <AppPageHeader />
      <MyTasksApp />
    </>
  );
}
