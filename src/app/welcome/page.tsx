import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { isFirstRun } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { getTemplate, TEMPLATES } from "@/lib/templates";
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

  // T1.2 — if the workspace was created via the templates flow
  // (Tasks remix toast inviting a Roadmap, or any future template-led
  // signup), `templateId` is set on the workspaces row. The picker
  // should know — otherwise we ask the user to re-pick a domain when
  // they've already chosen a template.
  let pendingTemplate: { id: string; name: string } | null = null;
  const [row] = await db
    .select({ templateId: workspaces.templateId })
    .from(workspaces)
    .where(eq(workspaces.id, ws));
  if (row?.templateId && TEMPLATES.some((t) => t.id === row.templateId)) {
    const t = getTemplate(row.templateId);
    pendingTemplate = { id: t.id, name: t.name };
  }

  return <WelcomePicker pendingTemplate={pendingTemplate} />;
}
