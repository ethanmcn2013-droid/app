"use client";

/**
 * Messages in review/demo mode. The seeded Orchard conversations live in this
 * component's memory: sending, replying, editing and accepting a request all
 * work, and none of it leaves the tab. Production uses ConversationWorkspace,
 * which talks to the conversation service behind its authorization.
 */

import { useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { openPalette } from "@/components/shell/app-shell";
import { publishChatDirectory, publishMessagesUnread } from "./messages-unread";
import { chatHref, demoChatDirectory } from "./chat-directory";
import { listTimeLabel, matchesQuery, previewText, type ChatMessage, type ChatPerson } from "./chat-view-model";
import { conversationAttention, demoReducer, initDemoState, rootMessages, threadReplies, unreadTotal, type DemoConversation, type DemoMessagesSnapshot, type DemoState } from "./demo-messages-model";
import { useBottomAnchor, JumpToLatest, Avatar, CenterState, ChatIcon, ChatList, Composer, ConversationIntro, DetailsBlock, Dot, MessageStream, PeopleList, Pill, ProjectTile, SidePanel, StatusGlyph, TaskTile, chatStyles as styles, type ChatListItem, type ChatListSection, type MessageActions } from "./chat-ui";

type Side = Readonly<{ kind: "thread"; rootId: string }> | Readonly<{ kind: "details" }> | null;

const draftKeyOf = (conversationId: string, rootId: string | null) => rootId ? `${conversationId}:${rootId}` : conversationId;
const PHONE_MAX = 679;

/**
 * What a reviewer did here survives moving around the app in this tab (the
 * route unmounts this view) and resets on reload. It is written only by an
 * effect, so the server never holds it.
 */
let kept: Readonly<{ snapshotKey: string; state: DemoState }> | null = null;
const snapshotKeyOf = (snapshot: DemoMessagesSnapshot) => `${snapshot.actorId}:${snapshot.clock.nowMs}:${snapshot.messages.length}`;

function initialState(snapshot: DemoMessagesSnapshot): DemoState {
  const first = snapshot.conversations[0];
  const state = kept?.snapshotKey === snapshotKeyOf(snapshot) ? kept.state : initDemoState(snapshot);
  return first ? demoReducer(state, { type: "open", conversationId: first.id }) : state;
}

export function DemoMessagesApp({ snapshot }: { snapshot: DemoMessagesSnapshot }) {
  const [state, dispatch] = useReducer(demoReducer, snapshot, initialState);
  const [selectedId, setSelectedId] = useState(snapshot.conversations[0]?.id ?? "");
  const [pane, setPane] = useState<"list" | "conversation">("list");
  const [side, setSide] = useState<Side>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [mentionDrafts, setMentionDrafts] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const mainAnchor = useBottomAnchor();
  const threadAnchor = useBottomAnchor();
  const backRef = useRef<HTMLButtonElement | null>(null);
  const sideTrigger = useRef<HTMLElement | null>(null);
  const startedAt = useRef<number | null>(null);
  const sequence = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams?.get("c") ?? null;
  const composing = searchParams?.get("new") === "1";
  const [peopleQuery, setPeopleQuery] = useState("");

  // The sidebar's Channels and Direct messages drive the open conversation
  // through the URL (?c=). Follow it during render, so the list and the pane
  // never disagree for a frame.
  const [followedUrl, setFollowedUrl] = useState<string | null>(null);
  if (urlId !== followedUrl) {
    setFollowedUrl(urlId);
    if (urlId && urlId !== selectedId && state.conversations.some((item) => item.id === urlId)) {
      setSelectedId(urlId);
      setEditingId(null);
      setSide((current) => current?.kind === "details" ? current : null);
      setPane("conversation");
      dispatch({ type: "open", conversationId: urlId });
    }
  }

  // Keep this tab's preview and feed the sidebar's Messages badge.
  useEffect(() => {
    kept = { snapshotKey: snapshotKeyOf(snapshot), state };
    publishMessagesUnread(unreadTotal(state.conversations));
    publishChatDirectory(demoChatDirectory(state.conversations, snapshot.people));
  }, [snapshot, state]);

  // A bare /app/messages names what it shows, so the sidebar can mark it.
  useEffect(() => {
    if (!urlId && !composing && selectedId) router.replace(chatHref(selectedId), { scroll: false });
  }, [urlId, composing, selectedId, router]);

  const people = snapshot.people;
  const selfId = snapshot.actorId;
  const clock = snapshot.clock;
  const personOf = (id: string | undefined) => people.find((person) => person.id === id);
  const conversation = state.conversations.find((item) => item.id === selectedId) ?? state.conversations[0];
  const members = (conversation?.memberIds ?? []).map((id) => personOf(id)).filter((person): person is ChatPerson => !!person);
  const roots = conversation ? rootMessages(state, conversation.id) : [];
  const threadRoot = side?.kind === "thread" ? state.messages.find((message) => message.id === side.rootId) : undefined;
  const replies = threadRoot ? threadReplies(state, threadRoot.id) : [];

  // A conversation or thread opens at its latest message.
  const { pin: pinMain } = mainAnchor;
  const { pin: pinThread } = threadAnchor;
  useLayoutEffect(() => { pinMain(); }, [selectedId, pinMain]);
  useLayoutEffect(() => { pinThread(); }, [threadRoot?.id, pinThread]);

  const now = () => {
    if (startedAt.current === null) startedAt.current = Date.now();
    return clock.nowMs + (Date.now() - startedAt.current);
  };

  function isPhone() {
    return (chatRef.current?.clientWidth ?? 1024) <= PHONE_MAX;
  }

  function select(id: string) {
    if (id !== urlId) router.replace(chatHref(id), { scroll: false });
    setSelectedId(id);
    setEditingId(null);
    setSide((current) => current?.kind === "details" ? current : null);
    setPane("conversation");
    dispatch({ type: "open", conversationId: id });
    if (isPhone()) requestAnimationFrame(() => backRef.current?.focus());
  }

  function openSide(next: Side) {
    sideTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSide(next);
  }

  function closeSide() {
    const trigger = sideTrigger.current;
    setSide(null);
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus(); });
  }

  function send(conversationId: string, rootId: string | null) {
    const key = draftKeyOf(conversationId, rootId);
    const body = drafts[key] ?? "";
    if (!body.trim()) return;
    sequence.current += 1;
    const id = `demo-local-${sequence.current}`;
    dispatch({ type: "send", conversationId, rootId, id, body, createdAt: now() });
    setDrafts((current) => ({ ...current, [key]: "" }));
    setMentionDrafts((current) => ({ ...current, [key]: [] }));
    setFreshIds((current) => new Set(current).add(id));
    if (rootId) pinThread(); else pinMain();
    setAnnouncement("Sending");
    window.setTimeout(() => { dispatch({ type: "settle", id }); setAnnouncement("Message sent"); }, 480);
  }

  function editLastOwn(list: readonly ChatMessage[]) {
    const last = [...list].reverse().find((message) => message.authorId === selfId && message.body !== null);
    if (last) setEditingId(last.id);
  }

  const actions: MessageActions = {
    onReply: (message) => openSide({ kind: "thread", rootId: message.id }),
    onEdit: (message, body) => { dispatch({ type: "edit", id: message.id, body, editedAt: now() }); setAnnouncement("Message edited"); },
    onDelete: (message) => { dispatch({ type: "remove", id: message.id }); setAnnouncement("Message removed"); },
  };
  const threadActions: MessageActions = { onEdit: actions.onEdit, onDelete: actions.onDelete };

  /* List */
  const q = query.trim();
  const lastOf = (item: DemoConversation) => rootMessages(state, item.id).at(-1);
  const rowFor = (item: DemoConversation): ChatListItem | null => {
    const last = lastOf(item);
    const direct = item.kind === "dm";
    let preview = item.request ? "Wants to message you privately" : previewText(last, people, selfId, direct) || "No messages yet";
    if (q) {
      const titleHit = matchesQuery(item.title, q);
      const hit = [...state.messages].reverse().find((message) => message.conversationId === item.id && message.body && matchesQuery(message.body, q));
      if (!titleHit && !hit) return null;
      if (hit && !titleHit) preview = previewText(hit, people, selfId, direct);
    }
    const leading = item.kind === "project" ? <ProjectTile id={snapshot.project.id} name={item.title} size={32} />
      : item.kind === "task" && item.task ? <TaskTile size={32} status={item.task.status} />
        : <Avatar id={item.otherId ?? item.id} name={item.title} size={32} />;
    const attention = conversationAttention(item);
    return { id: item.id, title: item.title, leading, preview, time: last && !item.request ? listTimeLabel(last.createdAt, clock) : undefined, count: attention.count, countNoun: item.kind === "dm" ? "message" : "mention", activity: attention.activity && !attention.request, tag: attention.request ? "Request" : undefined };
  };
  const rows = (kind: DemoConversation["kind"]) => state.conversations
    .filter((item) => item.kind === kind)
    .sort((a, b) => Number(Boolean(b.request)) - Number(Boolean(a.request)) || (lastOf(b)?.createdAt ?? 0) - (lastOf(a)?.createdAt ?? 0))
    .map(rowFor).filter((item): item is ChatListItem => item !== null);
  const sections: ChatListSection[] = [
    { id: "project", label: "Project", items: rows("project") },
    { id: "direct", label: "Direct messages", items: rows("dm"), empty: "No private conversations yet." },
    { id: "tasks", label: "Task threads", items: rows("task"), empty: "Task threads appear when someone comments on a task." },
  ];
  const order = sections.flatMap((section) => section.items.map((item) => item.id));

  function onChatKey(event: KeyboardEvent) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    const index = order.indexOf(selectedId);
    const next = order[(index + (event.key === "ArrowDown" ? 1 : -1) + order.length) % order.length];
    if (!next) return;
    event.preventDefault();
    select(next);
  }

  const newMessage = <div style={{ position: "relative" }}>
    <button aria-expanded={peopleOpen} aria-haspopup="menu" aria-label="New message" className={styles.iconButton} onClick={() => setPeopleOpen((open) => !open)} title="New message" type="button"><ChatIcon.compose /></button>
    {peopleOpen ? <div aria-label="Message someone" className={styles.popover} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setPeopleOpen(false); } }} role="menu" style={{ top: "calc(100% + 6px)", bottom: "auto", left: "auto", right: 0, width: 260 }}>
      <div className={styles.popoverLabel}>Message someone</div>
      {people.filter((person) => person.id !== selfId).map((person, index) => {
        const direct = state.conversations.find((item) => item.kind === "dm" && item.otherId === person.id);
        return <button autoFocus={index === 0} className={styles.option} key={person.id} onClick={() => { setPeopleOpen(false); if (direct) select(direct.id); }} role="menuitem" type="button">
          <Avatar id={person.id} name={person.name} size={24} /><span>{person.name}</span>{person.role ? <small>{person.role}</small> : null}
        </button>;
      })}
    </div> : null}
  </div>;

  const list = <ChatList
    headerAction={newMessage}
    onNavigateKey={(event) => { if (event.key === "Escape" && peopleOpen) setPeopleOpen(false); }}
    onQuery={setQuery}
    onSelect={select}
    query={query}
    sections={sections}
    selectedId={conversation?.id}
    subtitle={snapshot.project.name}
    title="Chat"
  />;

  if (!conversation) {
    return <main className={styles.page} id="app-main-content" tabIndex={-1}><div className={styles.chat}>{list}<section className={styles.pane}><CenterState text="Conversations appear here when your Project has members." title="No conversations yet" /></section></div></main>;
  }

  /* Conversation */
  const detailsOpen = side?.kind === "details";
  const other = personOf(conversation.otherId);
  const key = draftKeyOf(conversation.id, null);
  let leading: ReactNode;
  let subtitle: ReactNode;
  let headerActions: ReactNode;
  let intro: ReactNode;
  if (conversation.kind === "project") {
    leading = <ProjectTile id={snapshot.project.id} name={conversation.title} size={24} />;
    subtitle = <>Project conversation<Dot />{members.length} members</>;
    headerActions = <AvatarStack className={styles.headerStack} members={members} onClick={() => detailsOpen ? closeSide() : openSide({ kind: "details" })} pressed={detailsOpen} />;
    intro = <ConversationIntro actions={<><button className={styles.introButton} onClick={() => openSide({ kind: "details" })} type="button"><ChatIcon.panel />See members and details</button><Link className={styles.cuCard} href="/app/timeline"><span aria-hidden="true" className={styles.cuCardArt}><i /><i /><i /></span><span className={styles.cuCardText}><strong>Open the timeline</strong><span>See the dates and milestones for {snapshot.project.name}</span></span></Link></>} mark={null} text={<>Everyone in {conversation.title} can read this channel and reply. Messages stay inside this Project.</>} title={<>This is the start of #{conversation.title}</>} />;
  } else if (conversation.kind === "dm") {
    leading = <Avatar id={conversation.otherId ?? conversation.id} name={conversation.title} size={24} />;
    subtitle = <>{other?.role ? <>{other.role}<Dot /></> : null}<ChatIcon.lock />Private</>;
    headerActions = null;
    intro = <ConversationIntro actions={<><button className={styles.introButton} onClick={() => openSide({ kind: "details" })} type="button"><ChatIcon.user />View profile</button><Link className={styles.cuCard} href="/app/timeline"><span aria-hidden="true" className={styles.cuCardArt}><i /><i /><i /></span><span className={styles.cuCardText}><strong>Open the timeline</strong><span>See the dates and milestones for {snapshot.project.name}</span></span></Link></>} mark={null} text={<>Only the two of you can read this conversation. {other?.role ? `${conversation.title.split(/\s+/)[0]} is ${other.role.toLowerCase()} at ${snapshot.project.name}.` : ""}</>} title={<>This is the start of your conversation with {conversation.title}</>} />;
  } else {
    const task = conversation.task!;
    leading = <TaskTile size={24} status={task.status} />;
    subtitle = <><Pill><StatusGlyph status={task.status} />{task.statusLabel}</Pill>{task.dueLabel ? <Pill tone={task.dueLabel === "Due today" ? "warning" : undefined}>{task.dueLabel}</Pill> : null}<span>Task thread</span></>;
    headerActions = null;
    intro = <ConversationIntro actions={<><a className={styles.introButton} href={task.href}><ChatIcon.task />Open the task</a><Link className={styles.cuCard} href="/app/timeline"><span aria-hidden="true" className={styles.cuCardArt}><i /><i /><i /></span><span className={styles.cuCardText}><strong>Open the timeline</strong><span>See the dates and milestones for {snapshot.project.name}</span></span></Link></>} mark={null} text="Everyone in the Project can read this discussion and reply." title={<>Discussion on {task.title}</>} />;
  }

  const latestThread = [...roots].reverse().find((message) => (message.replyCount ?? 0) > 0);
  const request = conversation.request && conversation.request.requesterId !== selfId ? conversation.request : null;
  const pendingOwn = conversation.request && conversation.request.requesterId === selfId;
  const composer = <Composer
    blocked={request ? "Accept the request to start messaging." : pendingOwn ? "Messages begin after they accept." : undefined}
    label={`Message ${conversation.title}`}
    mentionIds={mentionDrafts[key] ?? []}
    onArrowUpEmpty={() => editLastOwn(roots)}
    onChange={(value) => setDrafts((current) => ({ ...current, [key]: value }))}
    onMentionIdsChange={(ids) => setMentionDrafts((current) => ({ ...current, [key]: ids }))}
    onSend={() => send(conversation.id, null)}
    people={members}
    placeholder={conversation.kind === "task" ? "Write a comment on this task" : conversation.kind === "dm" ? `Write to ${conversation.title}, press '@' to mention someone` : `Write to #${conversation.title}, press '@' to mention someone`}
    selfId={selfId}
    showHint={false}
    toolbar="full"
    value={drafts[key] ?? ""}
  />;

  const conversationPane = <section aria-labelledby="chat-conversation-title" className={styles.pane}>
    <header className={styles.cuHeader}>
      <div className={styles.cuTitleRow}>
        <button aria-label="All conversations" className={`${styles.iconButton} ${styles.back}`} onClick={() => setPane("list")} ref={backRef} type="button"><ChatIcon.back /></button>
        {leading}
        <h2 className={styles.cuTitle} id="chat-conversation-title">{conversation.kind === "project" ? `#${conversation.title}` : conversation.title}</h2>
        {conversation.kind === "dm" && other?.online ? <span className={styles.cuOnline}><span aria-hidden="true" />Online</span> : null}
        <button aria-label="Conversation details" className={styles.cuMore} onClick={() => detailsOpen ? closeSide() : openSide({ kind: "details" })} title="Details" type="button"><ChatIcon.more /></button>
        <span className={styles.cuSpacer} />
        {headerActions}
      </div>
      <nav aria-label="Conversation views" className={styles.cuTabs}>
        <button aria-current={detailsOpen ? undefined : "page"} className={styles.cuTab} onClick={() => { if (detailsOpen) closeSide(); }} type="button">Chat</button>
        <button aria-current={detailsOpen ? "page" : undefined} className={styles.cuTab} onClick={() => detailsOpen ? closeSide() : openSide({ kind: "details" })} type="button">Details</button>
        {conversation.kind === "task" && conversation.task ? <a className={styles.cuTab} href={conversation.task.href}>Task</a> : null}
        <span className="sr-only">{subtitle}</span>
      </nav>
    </header>
    <div className={styles.cuOverlay}>
      <Link className={styles.cuChip} href="/app/files">
        <span aria-hidden="true" className={styles.cuChipMark}><i /><i /><i /><i /></span>
        <span>Files, links<br />and notes</span>
      </Link>
      <div aria-label="Conversation tools" className={styles.cuRail} role="toolbar">
        <button aria-label="Search" className={styles.cuRailButton} onClick={() => openPalette()} title="Search" type="button"><ChatIcon.search /></button>
        <button aria-label={latestThread ? "Open the latest thread" : "No threads yet"} className={styles.cuRailButton} disabled={!latestThread} onClick={() => latestThread && openSide({ kind: "thread", rootId: latestThread.id })} title={latestThread ? "Latest thread" : "No threads yet"} type="button"><ChatIcon.thread /></button>
        <button aria-label="Details" aria-pressed={detailsOpen} className={styles.cuRailButton} onClick={() => detailsOpen ? closeSide() : openSide({ kind: "details" })} title="Details" type="button"><ChatIcon.user /></button>
      </div>
    </div>
    {request ? <CenterState
      actions={<><button className={styles.buttonPrimary} onClick={() => { dispatch({ type: "accept", conversationId: conversation.id }); setAnnouncement(`You can now message ${conversation.title}`); }} type="button">Accept</button><button className={styles.button} onClick={() => { const fallback = state.conversations.find((item) => item.kind === "project")?.id; dispatch({ type: "decline", conversationId: conversation.id }); setSide(null); if (fallback) select(fallback); setAnnouncement("Request declined"); }} type="button">Decline</button></>}
      mark={<Avatar id={conversation.otherId ?? conversation.id} name={conversation.title} size={56} />}
      text={<>In {snapshot.project.name}. Messages begin after you accept. If you decline, the request closes and nothing is shared.</>}
      title={`${conversation.title} wants to message you privately`}
    /> : <MessageStream
      actions={actions}
      clock={clock}
      editingId={editingId}
      freshIds={freshIds}
      intro={intro}
      jump={mainAnchor.away ? <JumpToLatest onClick={() => pinMain(true)} /> : null}
      label={`Messages in ${conversation.title}`}
      messages={roots}
      newSinceId={state.newSince[conversation.id] ?? null}
      onEditingChange={setEditingId}
      openThreadId={threadRoot?.id ?? null}
      people={people}
      scrollerRef={mainAnchor.ref}
      selfId={selfId}
    />}
    {composer}
  </section>;

  const pq = peopleQuery.trim();
  const directPeople = people.filter((person) => person.id !== selfId && (!pq || matchesQuery(person.name, pq) || (person.role ? matchesQuery(person.role, pq) : false)));
  const newMessagePane = <section aria-labelledby="chat-new-title" className={styles.pane}>
    <div className={styles.newMessage}>
      <h2 className={styles.cuTitle} id="chat-new-title">New direct message</h2>
      <label className={styles.newMessageSearch}>
        <ChatIcon.search />
        <span className={styles.srOnly}>Search people</span>
        <input autoFocus onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Search people by name or role" type="search" value={peopleQuery} />
      </label>
    </div>
    <ul aria-label="People" className={styles.newMessageList}>
      {directPeople.map((person) => {
        const direct = state.conversations.find((item) => item.kind === "dm" && item.otherId === person.id);
        return <li key={person.id}>
          <button className={styles.newMessagePerson} disabled={!direct} onClick={() => { if (direct) { setPeopleQuery(""); router.push(chatHref(direct.id), { scroll: false }); } }} type="button">
            <Avatar id={person.id} name={person.name} size={32} />
            <span className={styles.newMessageName}>{person.name}{person.role ? <small>{person.role}</small> : null}</span>
            <span className={styles.newMessageGo}>Message <ChatIcon.chevron size={14} /></span>
          </button>
        </li>;
      })}
      {directPeople.length === 0 ? <li className={styles.newMessageEmpty}>No one in {snapshot.project.name} matches.</li> : null}
    </ul>
    <div className={styles.composerWrap}>
      <div className={styles.composer} data-disabled="">
        <textarea aria-label="Message (choose someone first)" className={styles.composerInput} disabled placeholder="Choose someone above, then write your message" rows={2} />
      </div>
    </div>
  </section>;

  let sidePanel: ReactNode = null;
  if (side?.kind === "thread" && threadRoot) {
    const threadKey = draftKeyOf(conversation.id, threadRoot.id);
    sidePanel = <SidePanel closeLabel="Close thread" label="Thread" onBack={closeSide} onClose={closeSide} subtitle={`In ${conversation.title}`} title="Thread">
      <MessageStream
        actions={threadActions}
        clock={clock}
        editingId={editingId}
        freshIds={freshIds}
        label="Thread replies"
        lead={threadRoot}
        leadLabel={replies.length ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "No replies yet"}
        messages={replies}
        onEditingChange={setEditingId}
        people={people}
        scrollerRef={threadAnchor.ref}
        selfId={selfId}
      />
      <Composer
        autoFocus
        label="Reply in thread"
        mentionIds={mentionDrafts[threadKey] ?? []}
        onArrowUpEmpty={() => editLastOwn(replies)}
        onChange={(value) => setDrafts((current) => ({ ...current, [threadKey]: value }))}
        onMentionIdsChange={(ids) => setMentionDrafts((current) => ({ ...current, [threadKey]: ids }))}
        onSend={() => send(conversation.id, threadRoot.id)}
        people={members}
        placeholder="Reply"
        selfId={selfId}
        showHint={false}
        value={drafts[threadKey] ?? ""}
      />
    </SidePanel>;
  } else if (side?.kind === "details") {
    const linked = roots.filter((message) => message.linkedTask && message.body !== null);
    sidePanel = <SidePanel closeLabel="Close details" label="Conversation details" onBack={closeSide} onClose={closeSide} subtitle={conversation.title} title="Details">
      <div className={styles.details}>
        {conversation.kind === "dm" && other ? <DetailsBlock label="Person"><div className={styles.profile}><Avatar id={other.id} name={other.name} size={56} /><span className={styles.profileName}>{other.name}</span>{other.role ? <span className={styles.detailsText}>{other.role} · {snapshot.project.name}</span> : null}</div></DetailsBlock> : null}
        {conversation.kind === "task" && conversation.task ? <DetailsBlock label="Task"><div className={styles.taskCard}>
          <span className={styles.taskCardTitle}>{conversation.task.title}</span>
          <span className={styles.taskCardMeta}><Pill><StatusGlyph status={conversation.task.status} />{conversation.task.statusLabel}</Pill>{conversation.task.dueLabel ? <Pill tone={conversation.task.dueLabel === "Due today" ? "warning" : undefined}>{conversation.task.dueLabel}</Pill> : null}</span>
          <a className={styles.button} href={conversation.task.href} style={{ justifySelf: "start" }}>Open task</a>
        </div></DetailsBlock> : null}
        <DetailsBlock label="Privacy"><p className={styles.detailsText}>{conversation.about}</p></DetailsBlock>
        {conversation.kind !== "dm" ? <DetailsBlock label={`Members · ${members.length}`}><PeopleList people={members} selfId={selfId} /></DetailsBlock> : null}
        {linked.length ? <DetailsBlock label="Tasks from this conversation"><ul className={styles.linkedList}>{linked.map((message) => <li key={message.id}><a className={styles.card} href={message.linkedTask!.href}><span className={styles.cardIcon}><ChatIcon.task /></span><span className={styles.cardText}><span className={styles.cardTitle}>{message.linkedTask!.title}</span><span className={styles.cardSub}>From {personOf(message.authorId ?? undefined)?.name ?? "a message"}</span></span><span className={styles.cardArrow}><ChatIcon.chevron size={14} /></span></a></li>)}</ul></DetailsBlock> : null}
        <DetailsBlock label="Notifications"><p className={styles.detailsText}>Mention someone to notify them. Everything else waits here until they open the conversation.</p></DetailsBlock>
      </div>
    </SidePanel>;
  }

  return <main className={styles.page} id="app-main-content" tabIndex={-1}>
    <div className={styles.chat} data-directory="sidebar" data-pane={composing ? "conversation" : pane} data-preview="" data-side={sidePanel && !composing ? "" : undefined} onKeyDown={onChatKey} ref={chatRef}>
      {list}
      {composing ? newMessagePane : conversationPane}
      {composing ? null : sidePanel}
    </div>
    <p aria-live="polite" className={styles.srOnly} role="status">{announcement}</p>
  </main>;
}
