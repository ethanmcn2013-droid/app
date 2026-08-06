"use client";

import { usePathname } from "next/navigation";
import { isBareChromePath } from "@/lib/bare-artifact-path";

/**
 * Hides suite chrome on the routes that must not wear it.
 *
 * Today that is the Timeline owner preview, whose whole job is to show the
 * page an audience receives. A product rail or a Studio Bar over it would make
 * the screen a claim about the audience's page rather than the page itself.
 *
 * This is a client component on purpose, and the purpose is correctness rather
 * than interactivity. The shared /app layout is a server component: it runs on
 * a document request and then not again, so a decision it makes from a request
 * header sticks for the life of the document. Soft-navigate into the preview
 * and the chrome the layout already rendered stays on screen; soft-navigate
 * out of a cold-loaded preview and the chrome never comes back. `usePathname`
 * re-evaluates on every client navigation, so both directions are right
 * without auditing a single link, and the app keeps its soft navigation
 * everywhere else.
 *
 * The chrome still renders in the layout — it is only withheld here — so Tasks,
 * Notes and every other /app route are untouched.
 */
export function SuiteChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (isBareChromePath(pathname)) return null;
  return <>{children}</>;
}
