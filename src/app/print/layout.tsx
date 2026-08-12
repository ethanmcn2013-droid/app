// Print routes read the DB at request time, no static pre-render.
export const dynamic = "force-dynamic";

/**
 * Print chrome only. No Project resolution happens here — WP3 defect 3.
 *
 * This layout used to call `getActiveWorkspace` and run the first-run gate
 * against it. It cannot correctly gate anything Project-shaped, for a reason
 * that is a property of the framework rather than of this code: **a layout
 * does not receive `searchParams`**. `node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/layout.md` documents `children` and
 * `params` as the only props, and
 * `.../04-functions/use-pathname.md:38` states it directly — "Reading the
 * current URL from a Server Component is not supported. This design is
 * intentional to support layout state being preserved across page
 * navigations."
 *
 * So a layout asked to gate "the requested Project" can only ever gate the
 * cookie's, which is the defect. The gate moved to the pages, which do
 * receive `searchParams`; see `print-project.tsx`.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The root layout already provides <html> + <body>.
    // This wrapper strips all app chrome and gives the browser
    // a clean white print surface.
    <div className="print-root">
      {children}
    </div>
  );
}
