"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationResult, PairState } from "@/lib/conversations/contracts";
import { conversationHeaders } from "./conversation-client-model";
import styles from "./conversation-workspace.module.css";

export type DirectMessageScope = Readonly<{
  conversationId: string; projectId: ProjectId; kind: "dm"; audienceEpoch: number;
  lifecycle: "active" | "archived"; pairState: PairState;
  other: Readonly<{ id: string; name: string }>; requesterId: string;
  blockOwnerId: string | null; ownConfirmed: boolean; canWrite: boolean; canRead: boolean;
}>;
type Operation = "accept" | "decline" | "block" | "unblock" | "leave" | "reopen";
type Member = Readonly<{ id: string; name: string }>;
const requestId = () => `dm_${crypto.randomUUID().replaceAll("-", "")}`;

async function request<T>(fixtureActor: string | undefined, fields: Record<string, unknown>, signal?: AbortSignal, mutation = false): Promise<ConversationResult<T>> {
  const query = new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value)]));
  const response = await fetch(mutation ? "/api/conversations" : `/api/conversations?${query}`, {
    method: mutation ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal,
    headers: conversationHeaders(fixtureActor, mutation), ...(mutation ? { body: JSON.stringify(fields) } : {}),
  });
  return response.json();
}

export function DirectMessageDirectory({ actorId, projectId, fixtureActor, selectedId, onSelect }: Readonly<{
  actorId: string; projectId: ProjectId; fixtureActor?: string; selectedId?: string;
  onSelect: (scope: DirectMessageScope | null) => void;
}>) {
  const [pairs, setPairs] = useState<readonly DirectMessageScope[]>([]);
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<{ recipientId: string; clientRequestId: string } | null>(null);
  const mounted = useRef(true);
  const listRevision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const capturedRevision = listRevision.current;
      try {
        const result = await request<readonly DirectMessageScope[]>(fixtureActor, { action: "dm-list", projectId }, controller.signal);
        if (controller.signal.aborted || capturedRevision !== listRevision.current) return;
        if (result.ok) { setPairs(result.value); setError(null); }
        else if (result.code === "unavailable" || result.code === "unauthenticated") { setPairs([]); setMembers([]); setChoosing(false); }
        else setError("Private conversations could not be refreshed.");
      } catch { if (!controller.signal.aborted && capturedRevision === listRevision.current) setError("Private conversations are offline."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, 5000); }
    }
    void refresh();
    return () => { mounted.current = false; controller.abort(); clearTimeout(timer); };
  }, [projectId, fixtureActor]);
  async function choose() {
    setChoosing(true); setError(null);
    try {
      const result = await request<{ members: readonly Member[] }>(fixtureActor, { action: "task-destination", projectId });
      if (!mounted.current) return;
      if (result.ok) setMembers(result.value.members.filter((member) => member.id !== actorId));
      else setError("Project members are unavailable. Try again shortly.");
    } catch { if (mounted.current) setError("Project members are offline."); }
  }
  async function sendRequest() {
    if (!recipientId || busy) return;
    const current = attempt ?? { recipientId, clientRequestId: requestId() };
    setAttempt(current); setBusy(true); setError(null);
    try {
      const result = await request<{ scope: DirectMessageScope }>(fixtureActor, { action: "dm-request", projectId, ...current }, undefined, true);
      if (!mounted.current) return;
      if (result.ok) {
        listRevision.current += 1;
        setPairs((existing) => [...existing.filter((pair) => pair.conversationId !== result.value.scope.conversationId), result.value.scope]);
        setChoosing(false); setRecipientId(""); setAttempt(null); onSelect(result.value.scope);
      } else if (result.code === "temporarily_unavailable") setError("The request outcome is unknown. Retry to check the same request.");
      else { setAttempt(null); setError("This private conversation is unavailable. Its participation settings may have changed."); }
    } catch { if (mounted.current) setError("The request outcome is unknown. Retry to check the same request."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className={styles.privateDirectory} aria-label="Private Project conversations">
    <div><h2>Private</h2><button aria-label="Request a private conversation" onClick={() => void choose()} type="button">+</button></div>
    <button className={styles.roomChoice} aria-current={!selectedId ? "page" : undefined} onClick={() => onSelect(null)} type="button">Project conversation</button>
    {pairs.map((pair) => <button className={styles.roomChoice} aria-current={selectedId === pair.conversationId ? "page" : undefined} key={pair.conversationId} onClick={() => onSelect(pair)} type="button"><strong>{pair.other.name}</strong><span>{pair.canWrite ? "Private conversation" : pair.pairState.replaceAll("_", " ")}</span></button>)}
    {choosing ? <div className={styles.requestForm}><label>Person<select disabled={busy || attempt !== null} onChange={(event) => setRecipientId(event.target.value)} value={recipientId}><option value="">Choose a Project member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p>They receive a request. Messages begin after they accept.</p><button disabled={!recipientId || busy} onClick={() => void sendRequest()} type="button">{busy ? "Checking request…" : attempt ? "Retry request" : "Request conversation"}</button><button disabled={busy || attempt !== null} onClick={() => setChoosing(false)} type="button">Cancel</button></div> : null}
    {error ? <p role="status">{error}</p> : null}
  </section>;
}

export function DirectMessageControls({ actorId, scope, fixtureActor, onChange }: Readonly<{ actorId: string; scope: DirectMessageScope; fixtureActor?: string; onChange: (scope: DirectMessageScope) => void }>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<{ operation: Operation; clientRequestId: string; expectedAudienceEpoch: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current?.abort(); }, []);
  async function change(operation: Operation) {
    if (busy) return;
    const current = attempt ?? { operation, clientRequestId: requestId(), expectedAudienceEpoch: scope.audienceEpoch };
    setAttempt(current); setBusy(true); setError(null);
    const signal = controller.current?.signal;
    try {
      const result = await request<{ scope: DirectMessageScope }>(fixtureActor, { action: "dm-transition", projectId: scope.projectId, conversationId: scope.conversationId, ...current }, signal, true);
      if (signal?.aborted) return;
      if (result.ok) { setAttempt(null); onChange(result.value.scope); }
      else if (result.code === "temporarily_unavailable") setError("The change outcome is unknown. Retry this change.");
      else { setAttempt(null); setError(result.code === "audience_changed" ? "Participation changed. Review the latest state before trying again." : "That change is unavailable."); }
    } catch { if (!signal?.aborted) setError("The change outcome is unknown. Retry this change."); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  const actions: [Operation, string][] = [];
  if (scope.lifecycle === "active") {
    if (scope.pairState === "pending" && scope.requesterId !== actorId) actions.push(["accept", "Accept conversation"], ["decline", "Decline"]);
    if (scope.pairState === "rejoin_pending" && !scope.ownConfirmed) actions.push(["reopen", "Confirm reopening"]);
    if (scope.blockOwnerId === actorId) actions.push(["unblock", "Unblock"]);
  }
  if (!scope.blockOwnerId && scope.pairState !== "declined" && scope.pairState !== "left") actions.push(["block", "Block"]);
  if (scope.canRead && scope.pairState !== "left" && scope.pairState !== "membership_lost") actions.push(["leave", "Leave conversation"]);
  const description = !scope.canRead && scope.pairState !== "pending" ? "You no longer have access to messages here." : scope.canWrite ? "Only the two of you can read this conversation." : scope.pairState === "pending" ? (scope.requesterId === actorId ? "Your request is waiting for acceptance. No message has been sent." : "You have a request for a private conversation in this Project. Accept to begin exchanging messages.") : scope.pairState === "rejoin_pending" ? "Both people must confirm reopening. Restoring Project membership does not restart this conversation." : scope.pairState === "blocked" ? "This conversation is blocked. Previously available history remains read only." : "This conversation is read only. Participation must be restored before messages can resume.";
  // The mapped click handlers read the request controller only when invoked, never during render.
  // eslint-disable-next-line react-hooks/refs
  return <section className={styles.pairControls} aria-label="Private conversation participation"><p>{description}</p><div>{attempt ? <button disabled={busy} onClick={() => void change(attempt!.operation)} type="button">Retry change</button> : actions.map(([operation, label]) => <button disabled={busy} key={operation} onClick={() => void change(operation)} type="button">{label}</button>)}</div>{error ? <p role="alert">{error}</p> : null}</section>;
}
