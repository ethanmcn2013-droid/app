import { redirect } from "next/navigation";
import { getTasks, isFirstRun } from "@/server/db/queries";
import { getActiveWorkspace } from "@/server/auth";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";

// Print routes read the DB at request time — no static pre-render.
export const dynamic = "force-dynamic";

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getActiveWorkspace();

  // Same first-run gate as /app — uninitialized workspace must pick a
  // starter before any view (including print) is meaningful.
  if (await isFirstRun(ws)) {
    redirect("/welcome");
  }

  return (
    // The root layout already provides <html> + <body>.
    // This wrapper strips all app chrome and gives the browser
    // a clean white print surface.
    <div className="print-root">
      {children}
    </div>
  );
}
