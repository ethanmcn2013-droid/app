"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { signalClerkAppearance } from "@/components/auth/clerk-appearance";

/**
 * Identity runtime mounted only by authenticated or auth-aware surfaces.
 *
 * The appearance lives in one place (components/auth/clerk-appearance.ts) and
 * is fed from here, so every Clerk surface agrees: the auth forms, the
 * UserButton in the app shell, the UserButton in the marketing nav.
 *
 * This used to carry its own inline appearance written as Tailwind class
 * strings. Clerk applies those as `className` while a component-level
 * appearance compiles to its own generated class, so the two fought on the
 * same elements and the primary button lost its fill entirely. One config
 * only; extend the shared one rather than adding a second here.
 */
export function ClerkRuntimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={signalClerkAppearance}>{children}</ClerkProvider>
  );
}
