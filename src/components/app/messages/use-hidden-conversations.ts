"use client";
import { useEffect, useState } from "react";
import { hiddenConversationKey, readHiddenConversations } from "./hidden-conversations";

export function useHiddenConversations(actorId: string) {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    const read = () => { try { setHidden(readHiddenConversations(window.localStorage, actorId)); } catch { /* Storage disabled. */ } };
    read(); window.addEventListener("storage", read); window.addEventListener("signal:chat:hidden", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("signal:chat:hidden", read); };
  }, [actorId]);
  function change(next: string[]) {
    setHidden(next);
    try { window.localStorage.setItem(hiddenConversationKey(actorId), JSON.stringify(next)); window.dispatchEvent(new Event("signal:chat:hidden")); } catch { /* The session preference still works. */ }
  }
  return { hidden, hide: (id: string) => change([...new Set([...hidden, id])]), restore: (id: string) => change(hidden.filter((value) => value !== id)) };
}
