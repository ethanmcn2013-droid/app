import { requireAppAccessTasks } from "@/server/app-access";
import CurrentProjectPreview, { metadata } from "@/modules/timeline/app/audience/current-project-preview";
export const dynamic = "force-dynamic";
export { metadata };
export default async function CurrentProjectPreviewRoute(props: Parameters<typeof CurrentProjectPreview>[0]) {
  await requireAppAccessTasks();
  return <CurrentProjectPreview {...props} />;
}
