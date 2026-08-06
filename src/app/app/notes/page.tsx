import { requireAppAccess } from "@/server/require-app-access";
import { NotebookPage } from "@/modules/notes";


export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notes · Signal Studio",
};

/**
 * /app/notes — Notes module landing page.
 *
 * Defence-in-depth gate (AD-005): requireAppAccess() is called here even
 * though the /app layout's AppShell already enforces it. The function is
 * a read-then-redirect with no side effects; calling it twice is harmless.
 */
export default async function NotesPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> },
) {
  await requireAppAccess();
  return (
    <div data-notes-module>
      <NotebookPage searchParams={props.searchParams} />
    </div>
  );
}
