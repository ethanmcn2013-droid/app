import { redirect } from "next/navigation";
import { isFirstRun } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { WelcomePicker } from "@/components/welcome/welcome-picker";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome — Tasks",
};

export default async function WelcomePage() {
  const ws = await getActiveWorkspace();
  // Returning users skip the welcome (they came here from the URL bar
  // or an old bookmark). Push them straight back into the workspace.
  if (!(await isFirstRun(ws))) {
    redirect("/app/board");
  }
  return <WelcomePicker />;
}
