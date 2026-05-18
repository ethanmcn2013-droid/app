/**
 * Server-side wrapper for SiteNav.
 *
 * Reads Clerk auth state at render time and passes `isAuthed` to the
 * client SiteNav component. This avoids any client-side auth fetch and
 * ensures the nav is correct on first paint (no flash of Sign-in when
 * already authed). DESIGN.md §14 — "Kill the false Sign in" pattern.
 *
 * Usage: replace <SiteNav /> with <SiteNavServer /> on every marketing
 * page server component (page.tsx, etc.). The client SiteNav is not
 * changed — it remains a client component for the mobile-menu state.
 */

import { auth } from "@clerk/nextjs/server";
import { SiteNav } from "./site-nav";

export async function SiteNavServer() {
  let isAuthed = false;
  try {
    const { userId } = await auth();
    isAuthed = Boolean(userId);
  } catch {
    // Clerk not configured (dev / preview without keys) — render unauthed
    isAuthed = false;
  }
  return <SiteNav isAuthed={isAuthed} />;
}
