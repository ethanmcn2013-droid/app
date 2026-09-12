import type { ReactNode } from "react";
import styles from "./prototype.module.css";

export type DeliveryState = "sent" | "pending" | "failed" | "uncertain";

export type PrototypeMessage = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
  delivery?: DeliveryState;
  requestId?: string;
  replies?: number;
  directed?: boolean;
};

export type ConversationSummary = {
  id: string;
  kind: "project" | "dm" | "discussion";
  title: string;
  detail: string;
  unread?: number;
  initials: string;
};

export function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden="true" className={styles.icon} height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </svg>
  );
}

export function AudienceHeader({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "active" | "pending" | "blocked" | "archived" | "unavailable";
}) {
  const label = status === "active" ? "Can send" : status.replace("_", " ");
  return (
    <header className={styles.audienceHeader}>
      <div>
        <div className={styles.titleLine}>
          <h1>{title}</h1>
          <span className={styles.audiencePill} data-status={status}>{label}</span>
        </div>
        <p>{description}</p>
      </div>
      <button aria-label="Conversation details" className={styles.iconButton} type="button">
        <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>
      </button>
    </header>
  );
}

export function ConversationList({
  items,
  projectName,
  activeId,
  onSelect,
}: {
  items: ConversationSummary[];
  projectName: string;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Conversations" className={styles.conversationList}>
      <div className={styles.listHeading}>
        <h2>Messages</h2>
        <button aria-label="Start a conversation" className={styles.iconButton} type="button">
          <Icon><path d="M12 5v14M5 12h14" /></Icon>
        </button>
      </div>
      <p className={styles.projectLabel}>{projectName}</p>
      {items.map((item) => (
        <button
          aria-current={activeId === item.id ? "page" : undefined}
          aria-label={`${item.title}, ${item.detail}`}
          className={styles.conversationRow}
          data-active={activeId === item.id || undefined}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <span className={styles.avatar} data-kind={item.kind}>{item.initials}</span>
          <span className={styles.conversationCopy}>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </span>
          {item.unread ? <span aria-label={`${item.unread} unread`} className={styles.unread}>{item.unread}</span> : null}
        </button>
      ))}
      <div className={styles.quietNotice}>
        <Icon size={16}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></Icon>
        <span><strong>Quiet until 12:30</strong><small>Directed messages stay in your inbox.</small></span>
      </div>
    </nav>
  );
}

function DeliveryLabel({ state }: { state: DeliveryState }) {
  if (state === "sent") return null;
  const copy = state === "pending" ? "Sending…" : state === "failed" ? "Not sent" : "Checking whether this sent";
  return <span className={styles.delivery} data-state={state}>{copy}</span>;
}

export function MessageFeed({
  messages,
  onReply,
  onRetry,
}: {
  messages: PrototypeMessage[];
  onReply: (message: PrototypeMessage) => void;
  onRetry: (message: PrototypeMessage) => void;
}) {
  return (
    <ol aria-label="Conversation history" className={styles.feed}>
      <li className={styles.dayDivider}><span>Today · 12 September</span></li>
      {messages.map((message) => (
        <li className={styles.message} data-directed={message.directed || undefined} key={message.id}>
          <span className={styles.avatar}>{message.initials}</span>
          <div className={styles.messageBody}>
            <div className={styles.messageMeta}><strong>{message.author}</strong><time>{message.time}</time></div>
            <p>{message.body}</p>
            <div className={styles.messageActions}>
              <DeliveryLabel state={message.delivery ?? "sent"} />
              {message.delivery === "failed" || message.delivery === "uncertain" ? (
                <button onClick={() => onRetry(message)} type="button">Retry same request</button>
              ) : null}
              {message.delivery === undefined || message.delivery === "sent" ? (
                <button onClick={() => onReply(message)} type="button">{message.replies ? `${message.replies} replies` : "Reply"}</button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WorkPreview({
  kind,
  source,
  onClose,
}: {
  kind: "task" | "note";
  source: string;
  onClose: () => void;
}) {
  return (
    <section aria-label={kind === "task" ? "Create dated task preview" : "Save to my Notes preview"} className={styles.workPreview}>
      <div className={styles.previewHeading}>
        <div><h2>{kind === "task" ? "Create a task" : "Save to my Notes"}</h2><p>Preview only · nothing will be saved</p></div>
        <button aria-label="Close preview" className={styles.iconButton} onClick={onClose} type="button">
          <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>
        </button>
      </div>
      <blockquote>{source}</blockquote>
      {kind === "task" ? (
        <div className={styles.formGrid}>
          <label>Task name<input defaultValue="Confirm launch copy" /></label>
          <label>Due date<input defaultValue="2026-09-18" type="date" /></label>
          <label className={styles.wideField}>Project<input defaultValue="Website launch" readOnly /></label>
          <div className={styles.handoff}><span>On create</span><strong>Tasks · Schedule</strong><small>The date stays in Tasks. It does not publish to Timeline.</small></div>
        </div>
      ) : (
        <div className={styles.notePromise}>
          <span className={styles.lockMark}><Icon size={16}><rect height="10" rx="2" width="14" x="5" y="10" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon></span>
          <div><strong>Private to you</strong><p>A new note would be owned by you, with a safe link back to this message.</p></div>
        </div>
      )}
      <button className={styles.previewAction} onClick={onClose} type="button">Confirm preview</button>
    </section>
  );
}

export function ThreadPanel({
  root,
  replies,
  draft,
  onDraftChange,
  onClose,
  onSend,
}: {
  root: PrototypeMessage;
  replies: PrototypeMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <aside aria-label={`Replies to ${root.author}`} className={styles.threadPanel}>
      <div className={styles.previewHeading}>
        <div><h2>Replies</h2><p>One conversation thread</p></div>
        <button aria-label="Close replies" className={styles.iconButton} onClick={onClose} type="button"><Icon><path d="m6 6 12 12M18 6 6 18" /></Icon></button>
      </div>
      <div className={styles.threadRoot}><strong>{root.author}</strong><p>{root.body}</p></div>
      <ol className={styles.threadReplies}>
        {replies.map((reply) => <li key={reply.id}><span className={styles.avatar}>{reply.initials}</span><div><strong>{reply.author}</strong><time>{reply.time}</time><p>{reply.body}</p></div></li>)}
      </ol>
      <div className={styles.threadComposer}>
        <textarea aria-label="Reply in thread" onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); onSend(); }
          if (event.key === "Escape") onClose();
        }} placeholder="Reply in thread" rows={3} value={draft} />
        <button disabled={!draft.trim()} onClick={onSend} type="button">Reply</button>
      </div>
    </aside>
  );
}
