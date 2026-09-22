"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationSessionProvider } from "./conversation-session-provider";

export function ConversationLabSession({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const actor = params.get("actor");
  const actorId = actor === "bob" ? "synthetic_bob" : actor === "charlie" ? "synthetic_charlie" : "synthetic_alice";
  return <ConversationSessionProvider actorId={actorId}>{children}</ConversationSessionProvider>;
}
