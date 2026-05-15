"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DOMAINS, type DomainId, type DomainPack } from "@/lib/domains";

/** Active-workspace + domain context. The app layout resolves the
 *  active workspace once at the server-component boundary; this
 *  provider hands the resulting `(domain, workspaceId, workspaceSlug)`
 *  triple to every client component below. The DomainProvider name
 *  is kept for cycle 14 callsite continuity. */
type DomainCtx = {
  pack: DomainPack;
  workspaceId: string;
  workspaceSlug: string;
};

const DomainContext = createContext<DomainCtx | null>(null);

export function DomainProvider({
  domain,
  workspaceId,
  workspaceSlug,
  children,
}: {
  domain: DomainId;
  workspaceId: string;
  workspaceSlug: string;
  children: ReactNode;
}) {
  return (
    <DomainContext.Provider
      value={{ pack: DOMAINS[domain], workspaceId, workspaceSlug }}
    >
      {children}
    </DomainContext.Provider>
  );
}

export function useDomain(): DomainPack {
  const v = useContext(DomainContext);
  if (!v) {
    // Fall back to wedding rather than throwing — callers may render
    // outside the app shell (e.g. marketing pages embed components).
    // Wedding (not marketing) so an out-of-shell render still shows a
    // real 80% audience, never the tech-company dogfood board.
    return DOMAINS.wedding;
  }
  return v.pack;
}

/** Active workspace metadata. Returns null when called outside the
 *  app shell — callers should branch and skip workspace-specific UI
 *  (export menu, iCal subscribe URL) in that case. */
export function useActiveWorkspace(): {
  id: string;
  slug: string;
} | null {
  const v = useContext(DomainContext);
  if (!v) return null;
  return { id: v.workspaceId, slug: v.workspaceSlug };
}
