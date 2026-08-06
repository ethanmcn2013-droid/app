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
  // display:contents so this marker div does not become a height-auto box
  // between the shell's <main> and the workspace. It was collapsing every
  // percentage height inside Notes, which is why the empty states floated
  // and the Review card sat in a 245px band inside a 1080px viewport.
  return (
    <div data-notes-module style={{ display: "contents" }}>
      <NotebookPage searchParams={props.searchParams} />
    </div>
  );
}
