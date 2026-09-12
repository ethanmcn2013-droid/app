"use client";

import { useMemo, useRef, useState } from "react";
import {
  AudienceHeader,
  ConversationList,
  Icon,
  MessageFeed,
  RelatedWorkPanel,
  ThreadPanel,
  WorkPreview,
  type ConversationSummary,
  type PrototypeMessage,
} from "./prototype-panels";
import styles from "./prototype.module.css";

type Scenario = "project" | "pending" | "uncertain" | "failed" | "audience_changed" | "guest_preview" | "dm_pending" | "dm_active" | "dm_blocked" | "archived" | "unavailable";

type ProjectKey = "website" | "autumn";

const projectFixtures: Record<ProjectKey, { name: string; people: number; conversations: ConversationSummary[] }> = {
  website: { name: "Website launch", people: 6, conversations: [
    { id: "project", kind: "project", title: "Website launch", detail: "Project conversation · 6 people", unread: 2, initials: "WL" },
    { id: "dm", kind: "dm", title: "Maya Chen", detail: "Private in Website launch", unread: 1, initials: "MC" },
    { id: "discussion", kind: "discussion", title: "Confirm venue details", detail: "Task discussion · 3 replies", initials: "TD" },
  ] },
  autumn: { name: "Autumn exhibition", people: 4, conversations: [
    { id: "project", kind: "project", title: "Autumn exhibition", detail: "Project conversation · 4 people", unread: 1, initials: "AE" },
    { id: "dm", kind: "dm", title: "Jules Byrne", detail: "Private in Autumn exhibition", initials: "JB" },
    { id: "discussion", kind: "discussion", title: "Approve wall labels", detail: "Task discussion · 1 reply", initials: "AL" },
  ] },
};

const projectMessages: PrototypeMessage[] = [
  { id: "p1", author: "Maya Chen", initials: "MC", time: "09:18", body: "The venue confirmed Friday. Can we lock the homepage copy by Wednesday?", replies: 2, directed: true },
  { id: "p2", author: "Theo Grant", initials: "TG", time: "09:31", body: "Yes. I’ll put the final proof in Tasks and share the link here." },
  { id: "p3", author: "You", initials: "EM", time: "09:42", body: "I’ll confirm the launch copy and hand it over for the Friday review." },
];

const mayaMessages: PrototypeMessage[] = [
  { id: "m1", author: "Maya Chen", initials: "MC", time: "10:04", body: "Would you like me to take the venue follow-up?", directed: true },
  { id: "m2", author: "You", initials: "EM", time: "10:08", body: "Yes please. Keep it within Website launch and I’ll pick up the copy." },
];

const discussionMessages: PrototypeMessage[] = [
  { id: "d1", author: "Theo Grant", initials: "TG", time: "Yesterday", body: "The venue needs the final accessibility note before they sign off.", replies: 3 },
];

const autumnMessages: PrototypeMessage[] = [
  { id: "a1", author: "Jules Byrne", initials: "JB", time: "08:52", body: "The printer can hold the Friday slot if we approve the wall labels today.", directed: true },
  { id: "a2", author: "You", initials: "EM", time: "09:06", body: "I’ll review the final proof before lunch and create the dated approval task." },
];

const scenarioCopy: Record<Scenario, { status: "active" | "pending" | "blocked" | "archived" | "unavailable"; title: string; description: string }> = {
  project: { status: "active", title: "Website launch", description: "Visible to all 6 current project members" },
  pending: { status: "active", title: "Website launch", description: "Visible to all 6 current project members" },
  uncertain: { status: "active", title: "Website launch", description: "Visible to all 6 current project members" },
  failed: { status: "active", title: "Website launch", description: "Visible to all 6 current project members" },
  audience_changed: { status: "blocked", title: "Website launch", description: "Audience changed · review the current 5 project members before sending" },
  guest_preview: { status: "pending", title: "Guest audience preview", description: "Preview only · 6 members plus invited guest Sofia Reed · no access has been granted" },
  dm_pending: { status: "pending", title: "Maya Chen", description: "Private in Website launch · Maya must accept before messages can be sent" },
  dm_active: { status: "active", title: "Maya Chen", description: "Private between you and Maya · Website launch" },
  dm_blocked: { status: "blocked", title: "Maya Chen", description: "This private conversation is blocked · retained history remains visible" },
  archived: { status: "archived", title: "Website launch", description: "This project is archived · history is read only" },
  unavailable: { status: "unavailable", title: "Conversation unavailable", description: "It may have been removed or you may no longer have access" },
};

export function ProjectConversationPrototype() {
  const [project, setProject] = useState<ProjectKey>("website");
  const [scenario, setScenario] = useState<Scenario>("project");
  const [activeId, setActiveId] = useState("project");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, PrototypeMessage[]>>({ "website:project": projectMessages, "website:dm": mayaMessages, "website:discussion": discussionMessages, "autumn:project": autumnMessages, "autumn:dm": [], "autumn:discussion": [{ ...discussionMessages[0], id: "ad1", body: "The accessible type sizes are marked on the latest wall-label proof.", replies: 1 }] });
  const [replyingTo, setReplyingTo] = useState<PrototypeMessage | null>(null);
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [threadReplies, setThreadReplies] = useState<Record<string, PrototypeMessage[]>>({ p1: [{ id: "pr1", author: "You", initials: "EM", time: "09:22", body: "Wednesday works. I’ll turn the final line into a dated task." }] });
  const [preview, setPreview] = useState<"task" | "note" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"full" | "context">("full");
  const [relatedOpen, setRelatedOpen] = useState(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const workButtonRef = useRef<HTMLButtonElement>(null);

  const fixture = projectFixtures[project];
  const effectiveId = scenario.startsWith("dm_") ? "dm" : ["pending", "uncertain", "failed", "audience_changed", "guest_preview", "archived"].includes(scenario) ? "project" : activeId;
  const conversationKey = `${project}:${effectiveId}`;
  const selectedConversation = fixture.conversations.find((item) => item.id === effectiveId) ?? fixture.conversations[0];
  const baseCopy = scenario === "project" && effectiveId === "dm" ? scenarioCopy.dm_active : scenarioCopy[scenario];
  const copy = {
    ...baseCopy,
    title: effectiveId === "discussion" ? selectedConversation.title : baseCopy.title === "Website launch" ? fixture.name : baseCopy.title === "Maya Chen" ? selectedConversation.title : baseCopy.title,
    description: effectiveId === "discussion" ? `Task discussion in ${fixture.name} · visible to current project members` : baseCopy.description.replaceAll("Website launch", fixture.name).replaceAll("Maya", selectedConversation.title).replace("6 current project members", `${fixture.people} current project members`),
  };
  const blocked = copy.status !== "active" || effectiveId === "discussion";
  const visibleMessages = useMemo(() => scenario === "dm_pending" ? [] : messages[conversationKey] ?? [], [conversationKey, messages, scenario]);
  const selectedSource = replyingTo?.body ?? visibleMessages.at(-1)?.body ?? "Selected message";

  function chooseConversation(id: string) {
    setActiveId(id);
    setScenario(id === "dm" ? "dm_active" : "project");
    setReplyingTo(null);
  }

  function send() {
    const body = drafts[conversationKey]?.trim();
    if (!body || blocked) return;
    const delivery = scenario === "pending" ? "pending" : scenario === "uncertain" ? "uncertain" : scenario === "failed" ? "failed" : "sent";
    const requestId = `prototype-${effectiveId}-${Date.now()}`;
    setMessages((current) => ({ ...current, [conversationKey]: [...(current[conversationKey] ?? []), { id: requestId, requestId, author: "You", initials: "EM", body, time: "Now", delivery }] }));
    setDrafts((current) => ({ ...current, [conversationKey]: "" }));
  }

  function retry(message: PrototypeMessage) {
    setMessages((current) => ({
      ...current,
      [conversationKey]: (current[conversationKey] ?? []).map((item) => item.id === message.id ? { ...item, delivery: "sent", time: "Now · recovered" } : item),
    }));
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className={styles.prototype}>
      <aside aria-label="Signal Studio" className={styles.rail}>
        <a aria-label="Signal Studio home" className={styles.brandMark} href="#">S</a>
        <div className={styles.railTools}>
          <button aria-label="Home" type="button"><Icon><path d="m4 11 8-7 8 7v9H4Z" /></Icon></button>
          <button aria-label="Notes" type="button"><Icon><path d="M6 3h12v18H6zM9 8h6M9 12h6" /></Icon></button>
          <button aria-label="Tasks" type="button"><Icon><path d="M5 6h14M5 12h14M5 18h9" /></Icon></button>
          <button aria-label="Messages" aria-current="page" type="button"><Icon><path d="M4 5h16v12H9l-5 4Z" /></Icon></button>
        </div>
        <span className={styles.railAvatar}>EM</span>
      </aside>

      <div className={styles.labBar}>
        <div><strong>Project conversation</strong><span className={styles.labTruth}>Synthetic review lab · no data is saved or delivered</span><span className={styles.mobileTruth}>Preview · synthetic</span></div>
        <label>Project
          <select value={project} onChange={(event) => { setProject(event.target.value as ProjectKey); setActiveId("project"); setScenario("project"); setReplyingTo(null); }}>
            <option value="website">Website launch</option>
            <option value="autumn">Autumn exhibition</option>
          </select>
        </label>
        <label>Scenario
          <select value={scenario} onChange={(event) => { setScenario(event.target.value as Scenario); setReplyingTo(null); }}>
            <option value="project">Project conversation</option>
            <option value="pending">Pending send</option>
            <option value="uncertain">Uncertain send recovery</option>
            <option value="failed">Failed send recovery</option>
            <option value="audience_changed">Audience changed</option>
            <option value="guest_preview">Future guest preview</option>
            <option value="dm_pending">DM consent pending</option>
            <option value="dm_active">DM active</option>
            <option value="dm_blocked">DM blocked</option>
            <option value="archived">Project archived</option>
            <option value="unavailable">Conversation unavailable</option>
          </select>
        </label>
        <button className={styles.viewSwitch} onClick={() => setView((current) => current === "full" ? "context" : "full")} type="button">{view === "full" ? "Context panel" : "Full view"}</button>
      </div>

      <div className={styles.workspace} data-related={relatedOpen || undefined} data-view={view}>
        <ConversationList activeId={effectiveId} items={fixture.conversations} onSelect={chooseConversation} projectName={fixture.name} />
        <main className={styles.main}>
          <AudienceHeader {...copy} onToggleRelated={() => setRelatedOpen((open) => !open)} relatedOpen={relatedOpen} />
          {copy.status === "unavailable" ? (
            <div className={styles.emptyState}><span>?</span><h2>This conversation isn’t available</h2><p>Return to Messages and choose another conversation. No other project has been substituted.</p><button onClick={() => setScenario("project")} type="button">Back to project messages</button></div>
          ) : (
            <>
              <div className={styles.feedScroller}>
                {scenario === "dm_pending" ? <div className={styles.stateBanner}><strong>Waiting for {selectedConversation.title}</strong><span>Your request doesn’t include message text. You can send after they accept.</span></div> : null}
                {scenario === "guest_preview" ? <div className={styles.stateBanner}><strong>Guest flow preview only</strong><span>Sofia has no access. A later invitation would disclose the audience and history policy before acceptance.</span></div> : null}
                {scenario === "dm_blocked" ? <div className={styles.stateBanner} data-tone="danger"><strong>Messages are blocked</strong><span>You can read retained history, but neither person can send or receive alerts.</span></div> : null}
                {scenario === "audience_changed" ? <div className={styles.stateBanner} data-tone="danger"><strong>Review the audience</strong><span>A member left after this draft began. Return to the current audience before sending.</span></div> : null}
                {copy.status === "archived" ? <div className={styles.stateBanner}><strong>Read-only history</strong><span>Restore the project before anyone can send new messages.</span></div> : null}
                <MessageFeed messages={visibleMessages} onReply={setReplyingTo} onRetry={retry} />
              </div>
              <section aria-label="Message composer" className={styles.composer}>
                {blocked ? <p className={styles.composerBlocked}>{scenario === "guest_preview" ? "Guest messaging is not enabled in this prototype." : copy.status === "pending" ? `Sending unlocks after ${selectedConversation.title} accepts.` : scenario === "audience_changed" ? "Review the current audience before sending this draft." : copy.status === "blocked" ? "You can’t send in a blocked conversation." : effectiveId === "discussion" ? "Task Discussion remains canonical in Tasks." : "This history is read only."}</p> : (
                  <>
                    <textarea aria-label={`Message ${copy.title}`} onChange={(event) => setDrafts((current) => ({ ...current, [conversationKey]: event.target.value }))} onKeyDown={handleComposerKeyDown} placeholder={`Message ${copy.title}`} ref={composerRef} rows={2} value={drafts[conversationKey] ?? ""} />
                    <div className={styles.composerFooter}>
                      <div className={styles.actionMenuWrap}>
                        <button aria-expanded={menuOpen} aria-haspopup="menu" aria-label="Turn message into work" className={styles.addButton} onClick={() => setMenuOpen((open) => !open)} ref={workButtonRef} type="button"><Icon size={16}><path d="M12 5v14M5 12h14" /></Icon><span>Turn into work</span></button>
                        {menuOpen ? <div className={styles.actionMenu} onKeyDown={(event) => {
                          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
                          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
                          if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); workButtonRef.current?.focus(); }
                          if (event.key === "ArrowDown") { event.preventDefault(); buttons[(current + 1 + buttons.length) % buttons.length]?.focus(); }
                          if (event.key === "ArrowUp") { event.preventDefault(); buttons[(current - 1 + buttons.length) % buttons.length]?.focus(); }
                        }} role="menu"><button onClick={() => { setPreview("task"); setMenuOpen(false); }} role="menuitem" type="button"><strong>Create dated task</strong><span>Hand off to Tasks · Schedule</span></button><button onClick={() => { setPreview("note"); setMenuOpen(false); }} role="menuitem" type="button"><strong>Save to my Notes</strong><span>Private to you</span></button></div> : null}
                      </div>
                      <span className={styles.sendHint}><kbd>⌘</kbd><kbd>Enter</kbd></span>
                      <button className={styles.sendButton} disabled={!(drafts[conversationKey]?.trim())} onClick={send} type="button">Send</button>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </main>
        {relatedOpen ? <RelatedWorkPanel onClose={() => setRelatedOpen(false)} onOpenNote={() => setPreview("note")} onOpenTask={() => setPreview("task")} /> : null}
      </div>
      {replyingTo && !blocked ? <ThreadPanel draft={threadDrafts[replyingTo.id] ?? ""} onClose={() => setReplyingTo(null)} onDraftChange={(value) => setThreadDrafts((current) => ({ ...current, [replyingTo.id]: value }))} onSend={() => {
        const body = threadDrafts[replyingTo.id]?.trim();
        if (!body || blocked) return;
        setThreadReplies((current) => ({ ...current, [replyingTo.id]: [...(current[replyingTo.id] ?? []), { id: `reply-${Date.now()}`, author: "You", initials: "EM", time: "Now", body }] }));
        setThreadDrafts((current) => ({ ...current, [replyingTo.id]: "" }));
      }} replies={threadReplies[replyingTo.id] ?? []} root={replyingTo} /> : null}
      {preview ? <WorkPreview kind={preview} onClose={() => setPreview(null)} source={selectedSource} /> : null}
    </div>
  );
}
