import { requireAppAccessTasks } from "@/server/app-access";
import { NotebookPage } from "@/modules/notes";


export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notes · Signal Studio",
};

/**
 * /app/notes — Notes module landing page.
 *
 * Defence-in-depth gate (AD-005): the access check is called here even though
 * the /app layout already enforces it. The function is a read-then-redirect
 * with no side effects; calling it twice is harmless.
 *
 * It must be the SAME gate the layout uses. This page called the allowlist-only
 * requireAppAccess() until 2026-08-12, which made the redundant check narrower
 * than the one above it: the layout admitted an invited collaborator and this
 * line then bounced them to /waitlist. Defence in depth only holds when the
 * inner gate is no stricter than the outer one — src/server/app-gate-parity.test.mjs
 * now enforces that.
 */
export default async function NotesPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> },
) {
  await requireAppAccessTasks();
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
