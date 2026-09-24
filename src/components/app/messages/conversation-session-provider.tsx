"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import type { DraftCache, OutgoingCache, ScrollCache } from "./conversation-client-model";
import type { TaskDiscussionOutgoingCache } from "@/components/app/detail-panel/conversation-feed";

type SessionCaches = { actorId: string; drafts: DraftCache; outgoing: OutgoingCache;
  scroll: ScrollCache; taskDiscussions: TaskDiscussionOutgoingCache };
const SessionContext = createContext<SessionCaches | null>(null);
const newCaches = (actorId: string): SessionCaches => ({
  actorId, drafts: new Map(), outgoing: new Map(), scroll: new Map(), taskDiscussions: new Map(),
});

/** Memory only; the authenticated layout owns this across client route navigation. */
export function ConversationSessionProvider({ actorId, children }: { actorId: string; children: ReactNode }) {
  return <SessionOwner key={actorId} actorId={actorId}>{children}</SessionOwner>;
}

function SessionOwner({ actorId, children }: { actorId: string; children: ReactNode }) {
  const [caches] = useState(() => newCaches(actorId));
  useEffect(() => () => {
    caches.drafts.clear(); caches.outgoing.clear(); caches.scroll.clear(); caches.taskDiscussions.clear();
  }, [caches]);
  return <SessionContext.Provider value={caches}>{children}</SessionContext.Provider>;
}

/**
 * The server already authenticated `clerkId` before rendering this tree, so
 * the page renders at once while Clerk loads in the browser. It only steps in
 * when the loaded browser session belongs to a different account (a sign-in
 * in another tab), because the caches below are scoped to the server's actor.
 */
export function AuthenticatedConversationSession({ actorId, clerkId, children }: { actorId: string; clerkId: string; children: ReactNode }) {
  const auth = useAuth();
  if (auth.isLoaded && auth.userId !== clerkId) return <AccountChanged />;
  return <ConversationSessionProvider actorId={actorId}>{children}</ConversationSessionProvider>;
}

function AccountChanged() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div role="status" className="max-w-[420px] rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] p-6 shadow-[var(--v3-shadow-1)]">
        <p className="text-[15px] font-semibold text-[color:var(--v3-text)]">Your account changed.</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--v3-text-2)]">
          You signed in as someone else in another tab. Reload to continue with your current account.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex h-[34px] items-center rounded-[var(--v3-radius)] bg-[color:var(--v3-accent)] px-3.5 text-[13px] font-medium text-[color:var(--v3-on-accent)] hover:bg-[color:var(--v3-accent-hover)]"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export function useConversationCaches(actorId: string) {
  const shared = useContext(SessionContext);
  const [local] = useState(() => newCaches(actorId));
  return shared?.actorId === actorId ? shared : local;
}
