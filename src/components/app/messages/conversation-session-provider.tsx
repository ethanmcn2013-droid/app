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

export function AuthenticatedConversationSession({ actorId, clerkId, children }: { actorId: string; clerkId: string; children: ReactNode }) {
  const auth = useAuth();
  if (!auth.isLoaded) return <p role="status">Checking your session…</p>;
  if (auth.userId !== clerkId) return <p role="status">Your account changed. Reload to continue with your current account.</p>;
  return <ConversationSessionProvider actorId={actorId}>{children}</ConversationSessionProvider>;
}

export function useConversationCaches(actorId: string) {
  const shared = useContext(SessionContext);
  const [local] = useState(() => newCaches(actorId));
  return shared?.actorId === actorId ? shared : local;
}
