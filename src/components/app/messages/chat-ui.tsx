"use client";

/**
 * Messages v3 presentational parts. They render state and report intent;
 * they never fetch, send or decide access. The live Project conversation
 * client and the review preview both compose them.
 */

import { Fragment, useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { projectColor } from "@/components/shell/app-sidebar";
import { shouldSendComposerKey } from "./conversation-client-model";
import { activeMentionQuery, dayKey, fullStampLabel, groupMessages, initialsOf, linkLabel, mentionCandidates, mentionsPerson, timeLabel, tokenizeBody, toneOf, type ChatClock, type ChatMessage, type ChatPerson, type ChatTaskStatus } from "./chat-view-model";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import styles from "./chat.module.css";

/* ── Icons: 16px, 1.5 stroke, inherit colour ─────────────────────────── */

function Svg({ children, size = 16, className }: { children: ReactNode; size?: number; className?: string }) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

export const ChatIcon = {
  search: (p: { size?: number }) => <Svg {...p}><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></Svg>,
  compose: (p: { size?: number }) => <Svg {...p}><path d="M13.5 8.5v4a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h4" /><path d="M11.6 2.4a1.35 1.35 0 0 1 1.9 1.9L8 9.8l-2.5.7.7-2.5Z" /></Svg>,
  send: (p: { size?: number }) => <Svg {...p}><path d="M8 13V3.5M3.75 7.5 8 3.25l4.25 4.25" /></Svg>,
  at: (p: { size?: number }) => <Svg {...p}><circle cx="8" cy="8" r="2.5" /><path d="M10.5 8v1a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.4 4.8" /></Svg>,
  smile: (p: { size?: number }) => <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M5.75 9.5a2.75 2.75 0 0 0 4.5 0" /><path d="M6 6.5h.01M10 6.5h.01" strokeWidth={2} /></Svg>,
  thread: (p: { size?: number }) => <Svg {...p}><path d="M2.5 4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6.5L3.5 13.5V11a1 1 0 0 1-1-1Z" /><path d="M5.5 6h5M5.5 8h3" /></Svg>,
  close: (p: { size?: number }) => <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>,
  back: (p: { size?: number }) => <Svg {...p}><path d="M10 3.5 5.5 8l4.5 4.5" /></Svg>,
  chevron: (p: { size?: number }) => <Svg {...p}><path d="m6.5 4.5 3.5 3.5-3.5 3.5" /></Svg>,
  panel: (p: { size?: number }) => <Svg {...p}><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M10 3v10" /></Svg>,
  edit: (p: { size?: number }) => <Svg {...p}><path d="M10.6 2.9a1.4 1.4 0 0 1 2 2L5.5 12l-2.75.75L3.5 10Z" /></Svg>,
  trash: (p: { size?: number }) => <Svg {...p}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" /></Svg>,
  task: (p: { size?: number }) => <Svg {...p}><rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.25" /><path d="m5.5 8 1.75 1.75L10.75 6.25" /></Svg>,
  external: (p: { size?: number }) => <Svg {...p}><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" /></Svg>,
  globe: (p: { size?: number }) => <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M2.5 8h11M8 2.25c1.6 1.6 2.4 3.5 2.4 5.75S9.6 12.15 8 13.75C6.4 12.15 5.6 10.25 5.6 8S6.4 3.85 8 2.25Z" /></Svg>,
  lock: (p: { size?: number }) => <Svg {...p}><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" /></Svg>,
  users: (p: { size?: number }) => <Svg {...p}><circle cx="6" cy="5.5" r="2.25" /><path d="M2 13c.4-2.2 2-3.5 4-3.5s3.6 1.3 4 3.5" /><path d="M10.5 3.4a2.25 2.25 0 0 1 0 4.2M11.5 9.7c1.3.4 2.2 1.6 2.5 3.3" /></Svg>,
  info: (p: { size?: number }) => <Svg {...p}><circle cx="8" cy="8" r="5.75" /><path d="M8 7.25v3.5M8 5.25h.01" /></Svg>,
  warning: (p: { size?: number }) => <Svg {...p}><path d="M7.13 2.9a1 1 0 0 1 1.74 0l5 8.75a1 1 0 0 1-.87 1.5H3a1 1 0 0 1-.87-1.5Z" /><path d="M8 6.5v2.75M8 11.25h.01" /></Svg>,
  retry: (p: { size?: number }) => <Svg {...p}><path d="M13 8a5 5 0 1 1-1.46-3.54" /><path d="M13 2.75V5h-2.25" /></Svg>,
  hash: (p: { size?: number }) => <Svg {...p}><path d="M6.25 2.5 5 13.5M11 2.5 9.75 13.5M3 6h10.5M2.5 10H13" /></Svg>,
};

/* ── Identity ───────────────────────────────────────────────────────── */

export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return <span aria-hidden="true" className={styles.avatar} data-tone={toneOf(id)} style={{ "--size": `${size}px` } as React.CSSProperties}>{initialsOf(name)}</span>;
}

export function ProjectTile({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return <span aria-hidden="true" className={styles.tile} data-kind="project" style={{ "--size": `${size}px`, background: projectColor(id) } as React.CSSProperties}>{Array.from(name.trim())[0]?.toUpperCase() ?? "P"}</span>;
}

export function StatusGlyph({ status }: { status: ChatTaskStatus }) {
  return <svg aria-hidden="true" className={styles.statusGlyph} data-status={status} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray={status === "todo" ? "2.2 2" : undefined} />
    {status === "doing" ? <path d="M8 4a4 4 0 0 1 0 8Z" fill="currentColor" /> : null}
    {status === "review" ? <path d="M8 4a4 4 0 1 1-4 4h4Z" fill="currentColor" /> : null}
    {status === "done" ? <><circle cx="8" cy="8" r="6" fill="currentColor" /><path d="m5.5 8.1 1.7 1.7 3.3-3.4" stroke="var(--v3-canvas)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></> : null}
  </svg>;
}

export function TaskTile({ status, size = 36 }: { status: ChatTaskStatus; size?: number }) {
  return <span aria-hidden="true" className={styles.tile} data-kind="task" style={{ "--size": `${size}px` } as React.CSSProperties}><StatusGlyph status={status} /></span>;
}

/* ── Conversation list ──────────────────────────────────────────────── */

export type ChatListItem = Readonly<{
  id: string;
  title: string;
  leading: ReactNode;
  preview?: string;
  time?: string;
  /**
   * Slack-style attention. `count` draws a pill (unread direct messages, or
   * mentions of you); `activity` without a count draws a quiet dot. Either
   * sets the name in bold.
   */
  count?: number;
  countNoun?: "message" | "mention";
  activity?: boolean;
  tag?: string;
  /** A row that navigates elsewhere (a task discussion in Tasks). */
  href?: string;
  accessibleName?: string;
}>;

export type ChatListSection = Readonly<{
  id: string;
  label: string;
  items: readonly ChatListItem[];
  action?: ReactNode;
  empty?: ReactNode;
  after?: ReactNode;
}>;

export function ChatList({ title, subtitle, headerAction, query, onQuery, sections, selectedId, onSelect, footer, onNavigateKey }: {
  title: string; subtitle?: string; headerAction?: ReactNode;
  query?: string; onQuery?: (value: string) => void;
  sections: readonly ChatListSection[]; selectedId?: string | null;
  onSelect: (id: string) => void; footer?: ReactNode;
  onNavigateKey?: (event: KeyboardEvent) => void;
}) {
  const searching = Boolean(query?.trim());
  const visible = sections.filter((section) => !searching || section.items.length);
  return <nav aria-label="Conversations" className={styles.list} onKeyDown={onNavigateKey}>
    <div className={styles.listHead}>
      <div><h1 className={styles.listTitle}>{title}</h1>{subtitle ? <p className={styles.listSub}>{subtitle}</p> : null}</div>
      {headerAction}
    </div>
    {onQuery ? <div className={styles.search} role="search">
      <ChatIcon.search />
      <input aria-label="Search conversations" onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && query) { event.preventDefault(); onQuery(""); } }} placeholder="Search conversations" type="search" value={query ?? ""} />
      {query ? <button aria-label="Clear search" className={`${styles.iconButton} ${styles.searchClear}`} onClick={() => onQuery("")} type="button"><ChatIcon.close size={14} /></button> : null}
    </div> : null}
    <div className={styles.listScroll}>
      {visible.map((section) => <section aria-labelledby={`chat-section-${section.id}`} className={styles.section} key={section.id}>
        <div className={styles.sectionHead}><h2 className={styles.sectionLabel} id={`chat-section-${section.id}`}>{section.label}</h2>{section.action}</div>
        {section.items.length ? <ul className={styles.rows}>{section.items.map((item) => <li key={item.id}><ChatListRow item={item} selected={item.id === selectedId} onSelect={onSelect} /></li>)}</ul> : section.empty ? <div className={styles.listEmpty}>{section.empty}</div> : null}
        {section.after}
      </section>)}
      {searching && !visible.length ? <p className={styles.noMatch} role="status"><strong>No conversations match</strong><span>Try a name, a task or a word from a message.</span></p> : null}
      {footer ? <div className={styles.listFoot}>{footer}</div> : null}
    </div>
  </nav>;
}

function ChatListRow({ item, selected, onSelect }: { item: ChatListItem; selected: boolean; onSelect: (id: string) => void }) {
  const count = item.count ?? 0;
  const noun = item.countNoun ?? "message";
  const loud = count > 0 || Boolean(item.activity) || Boolean(item.tag);
  const countText = count ? noun === "message" ? `${count} unread ${count === 1 ? "message" : "messages"}` : `${count} ${count === 1 ? "mention" : "mentions"}` : null;
  const name = item.accessibleName ?? [item.title, item.tag, countText, !count && item.activity ? "new activity" : null].filter(Boolean).join(", ");
  const inner = <>
    {item.leading}
    <span className={styles.rowText}>
      <span className={styles.rowTitle}><span>{item.title}</span>{item.tag ? <span className={styles.tag}>{item.tag}</span> : null}</span>
      {item.preview ? <span className={styles.rowPreview}>{item.preview}</span> : null}
    </span>
    <span className={styles.rowMeta}>
      {item.time ? <span className={styles.rowTime}>{item.time}</span> : null}
      {item.href ? <span className={styles.rowOut}><ChatIcon.external size={13} /></span> : null}
      {count ? <span aria-hidden="true" className={styles.badge}>{count > 99 ? "99+" : count}</span> : item.activity ? <span aria-hidden="true" className={styles.activity} /> : null}
    </span>
  </>;
  if (item.href) return <a aria-label={name} className={styles.row} href={item.href}>{inner}</a>;
  return <button aria-current={selected ? "true" : undefined} aria-label={name} className={styles.row} data-conversation-row={item.id} data-unread={loud ? "" : undefined} onClick={() => onSelect(item.id)} type="button">{inner}</button>;
}

/* ── Header ─────────────────────────────────────────────────────────── */

export function ChatHeader({ leading, title, subtitle, onBack, backLabel = "All conversations", backRef, actions, titleId }: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; onBack?: () => void; backLabel?: string; backRef?: Ref<HTMLButtonElement>; actions?: ReactNode; titleId?: string;
}) {
  return <header className={styles.header}>
    {onBack ? <button aria-label={backLabel} className={`${styles.iconButton} ${styles.back}`} onClick={onBack} ref={backRef} type="button"><ChatIcon.back /></button> : null}
    {leading}
    <div className={styles.headerText}>
      <h2 className={styles.headerTitle} id={titleId}><span>{title}</span></h2>
      {subtitle ? <div className={styles.headerSub}>{subtitle}</div> : null}
    </div>
    {actions ? <div className={styles.headerActions}>{actions}</div> : null}
  </header>;
}

export function Dot() {
  return <span aria-hidden="true" className={styles.dot} />;
}

export function Pill({ children, tone }: { children: ReactNode; tone?: "warning" | "accent" }) {
  return <span className={styles.pill} data-tone={tone}>{children}</span>;
}

/* ── Stream ─────────────────────────────────────────────────────────── */

/**
 * Keeps a scroller on its latest message while the reader is there: when
 * content arrives, when the pane is revealed on a phone, and when a side
 * panel narrows it and text reflows. Scrolling up releases it; `pin`
 * (after you send, or on opening a conversation) takes it back down.
 */
export function useBottomAnchor(threshold = 80) {
  const pinned = useRef(true);
  const node = useRef<HTMLDivElement | null>(null);
  const [away, setAway] = useState(false);
  const ref = useCallback((element: HTMLDivElement | null) => {
    node.current = element;
    if (!element) return;
    // A scroll the browser makes while reflowing (scroll anchoring) arrives
    // before the resize callback. Only a scroll over unchanged geometry is
    // the reader's own, so only that may release the anchor.
    let height = element.scrollHeight;
    let viewport = element.clientHeight;
    const settle = () => {
      height = element.scrollHeight;
      viewport = element.clientHeight;
      if (pinned.current) element.scrollTop = height;
    };
    const onScroll = () => {
      if (element.scrollHeight !== height || element.clientHeight !== viewport) return;
      const distance = height - viewport - element.scrollTop;
      pinned.current = distance < threshold;
      setAway(distance > 320);
    };
    const observer = new ResizeObserver(settle);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    element.addEventListener("scroll", onScroll, { passive: true });
    settle();
    return () => { observer.disconnect(); element.removeEventListener("scroll", onScroll); };
  }, [threshold]);
  const pin = useCallback((smooth = false) => {
    pinned.current = true;
    const element = node.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);
  return { ref, pin, away };
}

/** Floats at the foot of a stream once the reader has scrolled well up. */
export function JumpToLatest({ onClick }: { onClick: () => void }) {
  return <button className={styles.jump} onClick={onClick} type="button"><ChatIcon.send size={14} /><span>Jump to latest</span></button>;
}

export type MessageActions = Readonly<{
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage, body: string) => void;
  onDelete?: (message: ChatMessage) => void;
  canChange?: (message: ChatMessage) => boolean;
  /** Extra toolbar buttons, e.g. Create task in the live client. */
  extraTools?: (message: ChatMessage) => ReactNode;
  /** Extra lines under a message body, e.g. a unread marker or task receipt. */
  extraMeta?: (message: ChatMessage) => ReactNode;
  onRetry?: (message: ChatMessage) => void;
}>;

export function MessageStream({ label, messages, people, selfId, clock, intro, before, after, newSinceId, actions, editingId, onEditingChange, openThreadId, targetId, scrollerRef, onScroll, emptyNote, freshIds, observe, lead, leadLabel, jump }: {
  label: string;
  /** A thread: the original message, shown first and apart from its replies. */
  lead?: ChatMessage;
  leadLabel?: string;
  messages: readonly ChatMessage[];
  people: readonly ChatPerson[];
  selfId: string | null;
  clock: ChatClock;
  intro?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  newSinceId?: string | null;
  actions?: MessageActions;
  editingId?: string | null;
  onEditingChange?: (id: string | null) => void;
  openThreadId?: string | null;
  targetId?: string | null;
  scrollerRef?: Ref<HTMLDivElement>;
  onScroll?: () => void;
  emptyNote?: ReactNode;
  freshIds?: ReadonlySet<string>;
  /** Live client: attach observation sentinels to delivered messages. */
  observe?: boolean;
  /** Sticky control at the foot of the stream, e.g. JumpToLatest. */
  jump?: ReactNode;
}) {
  const sections = groupMessages(messages, clock, undefined, newSinceId);
  const leadDay = lead ? dayKey(lead.createdAt, clock) : null;
  const itemProps = { actions, clock, onEditingChange, observe, people, selfId };
  return <div aria-label={label} className={styles.stream} onScroll={onScroll} ref={scrollerRef} role="region" tabIndex={0}>
    <div className={styles.streamInner}>
      <div className={styles.anchored} data-lead={lead ? "" : undefined}>
      {intro}
      {before}
      {lead ? <>
        <ol aria-label="Original message" className={styles.threadRoot}>
          <MessageItem {...itemProps} actions={actions ? { ...actions, onReply: undefined } : undefined} editing={editingId === lead.id} first fresh={false} message={lead} target={false} threadOpen={false} />
        </ol>
        {leadLabel ? <div className={styles.replyRule}>{leadLabel}</div> : null}
      </> : null}
      <ol aria-label={lead ? "Replies" : "Conversation history"} className={styles.feed}>
        {sections.map((section, sectionIndex) => <li className={styles.day} data-plain={sectionIndex === 0 && section.key === leadDay ? "" : undefined} key={section.key}>
          {sectionIndex === 0 && section.key === leadDay ? null : <div className={styles.dayLabel}><span>{section.label}</span></div>}
          <ol aria-label={section.label} className={styles.dayBody}>
            {section.runs.map((run) => run.messages.map((message, index) => <Fragment key={message.id}>
              <MessageItem {...itemProps} editing={editingId === message.id} first={index === 0} fresh={freshIds?.has(message.id) ?? false} message={message} newStart={newSinceId === message.id} target={targetId === message.id} threadOpen={openThreadId === message.id} />
            </Fragment>))}
          </ol>
        </li>)}
      </ol>
      {!messages.length && emptyNote ? <div className={styles.intro}><p className={styles.introText}>{emptyNote}</p></div> : null}
      {after}
      </div>
      {jump}
    </div>
  </div>;
}

function MessageBody({ body, people, selfId }: { body: string; people: readonly ChatPerson[]; selfId: string | null }) {
  const segments = tokenizeBody(body, people, selfId);
  return <>{segments.map((segment, index) => segment.kind === "mention"
    ? <span className={styles.mention} data-self={segment.self || undefined} key={index}>{segment.text}</span>
    : segment.kind === "link"
      ? <a className={styles.link} href={segment.href} key={index} rel="noopener noreferrer nofollow" target="_blank">{segment.text}</a>
      : <Fragment key={index}>{segment.text}</Fragment>)}</>;
}

function MessageItem({ message, people, selfId, clock, first, actions, editing, onEditingChange, threadOpen, target, fresh, observe, newStart }: {
  message: ChatMessage; people: readonly ChatPerson[]; selfId: string | null; clock: ChatClock; first: boolean;
  actions?: MessageActions; editing: boolean; onEditingChange?: (id: string | null) => void; threadOpen: boolean; target: boolean; fresh: boolean; observe?: boolean; newStart?: boolean;
}) {
  const author = people.find((person) => person.id === message.authorId);
  const name = message.authorId === null ? "Deleted account" : author?.name ?? (message.authorId === selfId ? "You" : "Project member");
  const stamp = fullStampLabel(message.createdAt, clock);
  const time = timeLabel(message.createdAt, clock);
  const removed = message.body === null;
  const delivered = !message.delivery || message.delivery === "sent";
  const mine = message.authorId !== null && message.authorId === selfId;
  const canChange = !removed && delivered && mine && (actions?.canChange?.(message) ?? true);
  const links = removed ? [] : tokenizeBody(message.body!, people, selfId).filter((segment) => segment.kind === "link");
  const mentionsMe = !mine && !removed && selfId !== null && mentionsPerson(message.body, people, selfId);
  const replyAuthors = (message.replyAuthorIds ?? []).map((id) => people.find((person) => person.id === id) ?? { id, name: id === selfId ? "You" : "Project member" });
  const tools = !removed && delivered && !editing ? <>
    {actions?.onReply && message.rootId == null ? <button aria-label={message.replyCount ? "Open thread" : "Reply in thread"} className={styles.tool} onClick={() => actions.onReply!(message)} title={message.replyCount ? "Open thread" : "Reply in thread"} type="button"><ChatIcon.thread /></button> : null}
    {actions?.extraTools?.(message)}
    {canChange && actions?.onEdit ? <button aria-label="Edit message" className={styles.tool} onClick={() => onEditingChange?.(message.id)} title="Edit" type="button"><ChatIcon.edit /></button> : null}
    {canChange && actions?.onDelete ? <button aria-label="Delete message" className={styles.tool} data-danger="" onClick={() => actions.onDelete!(message)} title="Delete" type="button"><ChatIcon.trash /></button> : null}
  </> : null;
  return <li className={styles.msg} data-delivery={message.delivery} data-first={first || undefined} data-fresh={fresh || undefined} data-mentions-me={mentionsMe || undefined} data-message-id={message.id} data-new-start={newStart || undefined} data-target={target || undefined} tabIndex={-1}>
    {newStart ? <span className={styles.srOnly}>New messages start here.</span> : null}
    {observe && !removed ? <span aria-hidden="true" data-message-observe="" data-observe-message-id={message.id} style={{ position: "absolute", inset: "0 0 auto", height: 24, pointerEvents: "none" }} /> : null}
    <div className={styles.gutter}>{first ? <Avatar id={message.authorId ?? "removed"} name={name} /> : <time className={styles.gutterTime} dateTime={new Date(message.createdAt).toISOString()} title={stamp}>{time}</time>}</div>
    <div className={styles.content}>
      {first ? <div className={styles.meta}>
        <span className={styles.author}>{name}</span>
        <time className={styles.time} dateTime={new Date(message.createdAt).toISOString()} title={stamp}>{time}</time>
        {message.editedAt && !removed ? <span className={styles.edited}>Edited</span> : null}
      </div> : <span className={styles.srOnly}>{name}, {time}</span>}
      {removed ? <p className={styles.body} data-removed="">Message removed</p>
        : editing && actions?.onEdit ? <InlineEditor initial={message.body!} onCancel={() => onEditingChange?.(null)} onSave={(body) => { actions.onEdit!(message, body); onEditingChange?.(null); }} />
          : <p className={styles.body}><MessageBody body={message.body!} people={people} selfId={selfId} />{!first && message.editedAt ? <span className={styles.edited}> (edited)</span> : null}</p>}
      {links.length || message.linkedTask ? <div className={styles.cards}>
        {links.slice(0, 2).map((link) => link.kind === "link" ? <a className={styles.card} href={link.href} key={link.href} rel="noopener noreferrer nofollow" target="_blank">
          <span className={styles.cardIcon}><ChatIcon.globe /></span>
          <span className={styles.cardText}><span className={styles.cardTitle}>{linkLabel(link.href)}</span><span className={styles.cardSub}>Link · opens in a new tab</span></span>
          <span className={styles.cardArrow}><ChatIcon.external size={14} /></span>
        </a> : null)}
        {message.linkedTask ? <a className={styles.card} href={message.linkedTask.href}>
          <span className={styles.cardIcon}>{message.linkedTask.status ? <StatusGlyph status={message.linkedTask.status} /> : <ChatIcon.task />}</span>
          <span className={styles.cardText}><span className={styles.cardTitle}>{message.linkedTask.title}</span><span className={styles.cardSub}>{message.linkedTask.statusLabel ? `${message.linkedTask.statusLabel} · ` : ""}Task created from this message</span></span>
          <span className={styles.cardArrow}><ChatIcon.chevron size={14} /></span>
        </a> : null}
      </div> : null}
      {message.replyCount && actions?.onReply ? <button aria-expanded={threadOpen} className={styles.thread} onClick={() => actions.onReply!(message)} type="button">
        <span aria-hidden="true" className={styles.threadFaces}><AvatarStack max={3} members={replyAuthors} size="sm" /></span>
        <span className={styles.threadCount}>{message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}</span>
        {message.lastReplyAt ? <span className={styles.threadLast}>Last reply {timeLabel(message.lastReplyAt, clock)}</span> : null}
        <span className={styles.threadGo}><ChatIcon.chevron size={14} /></span>
      </button> : null}
      {message.delivery && message.delivery !== "sent" ? <div className={styles.delivery} data-state={message.delivery} role={message.delivery === "failed" ? "alert" : undefined}>
        {message.delivery === "sending" ? <><span aria-hidden="true" className={styles.spinner} />Sending</> : message.delivery === "uncertain" ? <><ChatIcon.info size={13} />Checking whether this sent</> : <><ChatIcon.warning size={13} />Not sent</>}
        {message.delivery !== "sending" && actions?.onRetry ? <button className={styles.buttonQuiet} onClick={() => actions.onRetry!(message)} type="button">Try again</button> : null}
      </div> : null}
      {actions?.extraMeta?.(message)}
    </div>
    {tools ? <div aria-label={`Actions for ${name}'s message`} className={styles.toolbar} role="group">{tools}</div> : null}
  </li>;
}

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 240)}px`;
  }, [value]);
  return ref;
}

function InlineEditor({ initial, onSave, onCancel }: { initial: string; onSave: (body: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const ref = useAutosize(value);
  const valid = value.trim().length > 0;
  return <div className={styles.editor}>
    <textarea aria-label="Edit message" autoFocus onChange={(event) => setValue(event.target.value)} onFocus={(event) => { const end = event.currentTarget.value.length; event.currentTarget.setSelectionRange(end, end); }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); }
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && valid) { event.preventDefault(); onSave(value); }
    }} ref={ref} rows={1} value={value} />
    <div className={styles.editorBar}>
      <span className={styles.editorHint}>Escape to cancel · Enter to save</span>
      <button className={styles.button} onClick={onCancel} type="button">Cancel</button>
      <button className={styles.buttonPrimary} disabled={!valid || value === initial} onClick={() => onSave(value)} type="button">Save</button>
    </div>
  </div>;
}

export function Outgoing({ state, children, actions }: { state: "pending" | "uncertain" | "failed" | "recovered"; children: ReactNode; actions?: ReactNode }) {
  return <div className={styles.outgoing}><span /><div className={styles.outgoingCard} data-state={state}>{children}{actions ? <div className={styles.outgoingActions}>{actions}</div> : null}</div></div>;
}

export function ConversationIntro({ mark, title, text, actions }: { mark: ReactNode; title: ReactNode; text: ReactNode; actions?: ReactNode }) {
  return <div className={styles.intro}>
    {mark}
    <h3 className={styles.introTitle}>{title}</h3>
    <p className={styles.introText}>{text}</p>
    {actions ? <div className={styles.introActions}>{actions}</div> : null}
  </div>;
}

export function Notice({ tone, title, children, action, role }: { tone?: "accent" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; action?: ReactNode; role?: "alert" | "status" }) {
  return <div className={styles.notice} data-tone={tone} role={role}>
    <span className={styles.noticeIcon}>{tone === "danger" || tone === "warning" ? <ChatIcon.warning /> : <ChatIcon.info />}</span>
    <span>{title ? <strong>{title}. </strong> : null}{children}</span>
    {action}
  </div>;
}

export function Notices({ children }: { children: ReactNode }) {
  return <div className={styles.notices}>{children}</div>;
}

export function CenterState({ mark, title, text, actions, role }: { mark?: ReactNode; title: ReactNode; text?: ReactNode; actions?: ReactNode; role?: "alert" | "status" }) {
  return <div className={styles.center}><div className={styles.centerCard} role={role}>
    {mark ?? <span className={styles.halo}><ChatIcon.thread size={26} /></span>}
    <h3 className={styles.centerTitle}>{title}</h3>
    {text ? <p className={styles.centerText}>{text}</p> : null}
    {actions ? <div className={styles.centerActions}>{actions}</div> : null}
  </div></div>;
}

/* ── Composer ───────────────────────────────────────────────────────── */

const EMOJI: readonly (readonly [string, string])[] = [
  ["👍", "Thumbs up"], ["🙏", "Thank you"], ["✅", "Done"], ["👀", "Looking"], ["🎉", "Celebrate"], ["❤️", "Heart"], ["😊", "Smile"], ["😅", "Phew"],
  ["🤞", "Fingers crossed"], ["👏", "Applause"], ["💡", "Idea"], ["📌", "Pin"], ["☔", "Rain"], ["☀️", "Sun"], ["🥂", "Cheers"], ["💐", "Flowers"],
];

export type ComposerHandle = Readonly<{ focus: () => void }>;

export function Composer({ value, onChange, onSend, label, placeholder, people, selfId, mentionIds, onMentionIdsChange, unavailableMentionIds, sendDisabled, disabled, blocked, count, note, onArrowUpEmpty, onEscape, inputRef, autoFocus, showHint = true }: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  label: string;
  placeholder: string;
  /** People who can be notified. Empty hides the mention affordance. */
  people: readonly ChatPerson[];
  selfId: string | null;
  mentionIds: readonly string[];
  onMentionIdsChange?: (ids: readonly string[]) => void;
  unavailableMentionIds?: readonly string[];
  sendDisabled?: boolean;
  disabled?: boolean;
  /** Replaces the input with an explanation (read only, paused, offline). */
  blocked?: ReactNode;
  count?: ReactNode;
  note?: ReactNode;
  onArrowUpEmpty?: () => void;
  onEscape?: () => void;
  inputRef?: (node: HTMLTextAreaElement | null) => void;
  autoFocus?: boolean;
  showHint?: boolean;
}) {
  const textareaRef = useAutosize(value);
  const [caret, setCaret] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const mentionable = people.filter((person) => person.id !== selfId);
  const query = caret === null || !onMentionIdsChange || !mentionable.length ? null : activeMentionQuery(value, caret);
  const open = query !== null && dismissedAt !== query.start;
  const options = open ? mentionCandidates(mentionable, query.query, selfId) : [];
  const listId = `composer-mentions-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const active = options[Math.min(activeIndex, Math.max(0, options.length - 1))];
  const canSend = !sendDisabled && !disabled && value.trim().length > 0;

  function setNode(node: HTMLTextAreaElement | null) {
    textareaRef.current = node;
    inputRef?.(node);
  }

  function insertAt(text: string, start: number, end: number) {
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    const position = start + text.length;
    requestAnimationFrame(() => { const node = textareaRef.current; if (!node) return; node.focus(); node.setSelectionRange(position, position); setCaret(position); });
  }

  function pick(person: ChatPerson) {
    if (!query || caret === null) return;
    insertAt(`@${person.name} `, query.start, caret);
    if (!mentionIds.includes(person.id)) onMentionIdsChange?.([...mentionIds, person.id]);
    setActiveIndex(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && options.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (Math.min(current, options.length - 1) + delta + options.length) % options.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && active) { event.preventDefault(); pick(active); return; }
      if (event.key === "Escape") { event.preventDefault(); setDismissedAt(query!.start); return; }
    }
    if (event.key === "Escape" && onEscape) { event.preventDefault(); onEscape(); return; }
    if (event.key === "ArrowUp" && !value && onArrowUpEmpty) { event.preventDefault(); onArrowUpEmpty(); return; }
    const mobileReturn = typeof window !== "undefined" && window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
    if (shouldSendComposerKey({ key: event.key, shiftKey: event.shiftKey, composing: event.nativeEvent.isComposing, mobileReturn })) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  const chosen = mentionIds.map((id) => ({ id, person: people.find((person) => person.id === id), unavailable: unavailableMentionIds?.includes(id) ?? false }));

  return <div className={styles.composerWrap} data-signal-bottom-nav="composer">
    <div className={styles.composer} data-disabled={blocked || disabled ? "" : undefined}>
      {blocked ? <div className={styles.composerBlocked} role="status"><ChatIcon.info />{blocked}</div> : <>
        {open ? <div aria-label="People to notify" className={styles.popover} id={listId} role="listbox">
          <div className={styles.popoverLabel}>Notify someone</div>
          {options.length ? options.map((person) => <div aria-selected={person === active} className={styles.option} id={`${listId}-${person.id}`} key={person.id} onMouseDown={(event) => { event.preventDefault(); pick(person); }} onMouseEnter={() => setActiveIndex(options.indexOf(person))} role="option">
            <Avatar id={person.id} name={person.name} size={24} /><span>{person.name}</span>{person.role ? <small>{person.role}</small> : null}
          </div>) : <p className={styles.popoverEmpty}>No one in this conversation matches.</p>}
        </div> : null}
        {emojiOpen ? <div aria-label="Emoji" className={styles.popover} role="dialog" onBlur={(event) => { const next = event.relatedTarget as HTMLElement | null; if (!event.currentTarget.contains(next) && !next?.hasAttribute("data-emoji-toggle")) setEmojiOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEmojiOpen(false); textareaRef.current?.focus(); } }}>
          <div className={styles.popoverLabel}>Add emoji</div>
          <div className={styles.emojiGrid}>{EMOJI.map(([emoji, name], index) => <button aria-label={name} autoFocus={index === 0} className={styles.emoji} key={emoji} onClick={() => { const node = textareaRef.current; const start = node?.selectionStart ?? value.length; const end = node?.selectionEnd ?? value.length; setEmojiOpen(false); insertAt(emoji, start, end); }} title={name} type="button">{emoji}</button>)}</div>
        </div> : null}
        {chosen.length ? <div className={styles.notify}>
          <span>Notifies</span>
          {chosen.map(({ id, person, unavailable }) => <span className={styles.chip} data-unavailable={unavailable || undefined} key={id}>
            {person?.name ?? "Someone no longer here"}
            <button aria-label={`Stop notifying ${person?.name ?? "this person"}`} onClick={() => onMentionIdsChange?.(mentionIds.filter((item) => item !== id))} type="button"><ChatIcon.close size={12} /></button>
          </span>)}
        </div> : null}
        <textarea
          aria-activedescendant={open && active ? `${listId}-${active.id}` : undefined}
          aria-autocomplete={onMentionIdsChange ? "list" : undefined}
          aria-controls={open ? listId : undefined}
          aria-expanded={onMentionIdsChange ? open : undefined}
          aria-label={label}
          autoFocus={autoFocus}
          className={styles.composerInput}
          disabled={disabled}
          maxLength={8000}
          onBlur={() => setCaret(null)}
          onChange={(event) => { onChange(event.target.value); setCaret(event.target.selectionStart); setActiveIndex(0); setDismissedAt(null); }}
          onClick={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => { if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") setCaret(event.currentTarget.selectionStart); }}
          placeholder={placeholder}
          ref={setNode}
          role={onMentionIdsChange ? "combobox" : undefined}
          rows={1}
          value={value}
        />
        <div className={styles.composerBar}>
          {onMentionIdsChange && mentionable.length ? <button aria-label="Mention someone" className={styles.iconButton} disabled={disabled} onClick={() => { const node = textareaRef.current; const start = node?.selectionStart ?? value.length; const end = node?.selectionEnd ?? value.length; const spacer = start > 0 && !/\s$/.test(value.slice(0, start)) ? " " : ""; insertAt(`${spacer}@`, start, end); }} title="Mention someone" type="button"><ChatIcon.at /></button> : null}
          <button aria-expanded={emojiOpen} aria-label="Add emoji" className={styles.iconButton} data-emoji-toggle="" disabled={disabled} onClick={() => setEmojiOpen((current) => !current)} title="Add emoji" type="button"><ChatIcon.smile /></button>
          {count ?? null}
          {showHint ? <span className={styles.composerHint}><kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</span> : null}
          <button aria-label="Send message" className={styles.send} disabled={!canSend} onClick={onSend} title="Send" type="button"><ChatIcon.send /></button>
        </div>
      </>}
    </div>
    {note ? <p className={styles.composerNote}>{note}</p> : null}
  </div>;
}

/* ── Side panel ─────────────────────────────────────────────────────── */

export function SidePanel({ label, title, subtitle, onClose, closeLabel, children, onBack }: { label: string; title: ReactNode; subtitle?: ReactNode; onClose: () => void; closeLabel: string; children: ReactNode; onBack?: () => void }) {
  return <aside aria-label={label} className={styles.side} onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onClose(); } }}>
    <div className={styles.sideHead}>
      {onBack ? <button aria-label="Back to conversation" className={`${styles.iconButton} ${styles.back}`} onClick={onBack} type="button"><ChatIcon.back /></button> : null}
      <div><h2 className={styles.sideTitle}>{title}</h2>{subtitle ? <p className={styles.sideSub}>{subtitle}</p> : null}</div>
      <button aria-label={closeLabel} className={styles.iconButton} onClick={onClose} type="button"><ChatIcon.close /></button>
    </div>
    {children}
  </aside>;
}

export function DetailsBlock({ label, children }: { label: string; children: ReactNode }) {
  return <section className={styles.detailsBlock}><h3 className={styles.detailsLabel}>{label}</h3>{children}</section>;
}

export function PeopleList({ people, selfId }: { people: readonly ChatPerson[]; selfId: string | null }) {
  return <ul className={styles.people}>{people.map((person) => <li className={styles.person} key={person.id}>
    <Avatar id={person.id} name={person.name} size={30} />
    <span><strong>{person.name}{person.id === selfId ? <span className={styles.you}>You</span> : null}</strong>{person.role ? <small>{person.role}</small> : null}</span>
  </li>)}</ul>;
}

/* ── Loading ────────────────────────────────────────────────────────── */

function Bar({ width, height = 10, round }: { width: number | string; height?: number; round?: boolean }) {
  return <span aria-hidden="true" className={styles.skeleton} data-round={round || undefined} style={{ display: "block", width, height, flex: "none" }} />;
}

export function StreamSkeleton() {
  return <div aria-hidden="true" style={{ marginTop: "auto", paddingBottom: 12 }}>
    {[["62%", "44%"], ["78%"], ["54%", "70%", "30%"], ["66%"]].map((lines, index) => <div className={styles.skeletonMsg} key={index}>
      <Bar height={36} round width={36} />
      <div style={{ display: "grid", gap: 8, paddingTop: 2 }}><Bar height={10} width={index % 2 ? 90 : 120} />{lines.map((width, line) => <Bar height={12} key={line} width={width} />)}</div>
    </div>)}
  </div>;
}

export function ChatSkeleton({ label = "Loading messages" }: { label?: string }) {
  return <div className={styles.page}><div className={styles.chat} role="status" aria-label={label}>
    <div className={styles.list} aria-hidden="true">
      <div className={styles.listHead}><Bar height={20} width={110} /></div>
      <div className={styles.search}><Bar height={34} width="100%" /></div>
      <div className={styles.listScroll}>{Array.from({ length: 6 }, (_, index) => <div className={styles.skeletonRow} key={index}><Bar height={32} round width={32} /><div className={styles.skeletonLines}><Bar height={11} width={index % 2 ? "58%" : "72%"} /><Bar height={9} width={index % 3 ? "84%" : "64%"} /></div></div>)}</div>
    </div>
    <div className={styles.pane} aria-hidden="true">
      <div className={styles.header}><Bar height={36} width={36} /><div style={{ display: "grid", gap: 6 }}><Bar height={12} width={180} /><Bar height={9} width={120} /></div></div>
      <div className={styles.stream}><div className={styles.streamInner}><StreamSkeleton /></div></div>
      <div className={styles.composerWrap}><Bar height={86} width="100%" /></div>
    </div>
    <span className={styles.srOnly}>{label}</span>
  </div></div>;
}

export { styles as chatStyles };
