"use client";

import { motion } from "motion/react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { dueClause, isLate, ME, personById, type Commitment, type PersonId } from "./data";
import { Icon } from "./icons";
import { DatePicker, Floating, ForPicker, PersonPicker, WaitingPicker, type Placement } from "./Pickers";
import s from "./c5.module.css";

export type TokenKind = "owner" | "action" | "due" | "for" | "waiting" | "menu";

const TITLES: Record<TokenKind, string> = {
  owner: "Who will do it",
  action: "What they will do",
  due: "By when",
  for: "Who it is for",
  waiting: "Waiting on someone",
  menu: "More",
};

function placementFor(el: HTMLElement | null): Placement {
  if (!el) return { x: "left", y: "down" };
  const r = el.getBoundingClientRect();
  return {
    x: r.left + 320 > window.innerWidth - 16 ? "right" : "left",
    y: r.bottom + 400 > window.innerHeight && r.top > 420 ? "up" : "down",
  };
}

/** A word you can click. Reads as text first: a dotted underline, a hover fill. */
function Token({
  kind,
  label,
  tone,
  strong,
  ghost,
  open,
  onOpen,
  children,
}: {
  kind: TokenKind;
  label: string;
  tone?: "late" | "wait" | "none" | "soon";
  strong?: boolean;
  ghost?: boolean;
  open: boolean;
  onOpen: (el: HTMLElement) => void;
  children: ReactNode;
}) {
  const cls = [
    s.token,
    tone === "late" ? s.tokLate : "",
    tone === "wait" ? s.tokWait : "",
    tone === "none" ? s.tokNone : "",
    tone === "soon" ? s.tokSoon : "",
    strong ? s.tokStrong : "",
    ghost ? s.tokGhost : "",
    open ? s.tokOpen : "",
  ].join(" ");
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(e.currentTarget);
    }
  };
  return (
    <span
      role="button"
      tabIndex={0}
      className={cls}
      data-token={kind}
      aria-label={label}
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(e.currentTarget);
      }}
      onKeyDown={onKey}
    >
      {children}
    </span>
  );
}

/** The new word fades up into place when a token changes. */
function Word({ text }: { text: string }) {
  return (
    <motion.span
      key={text}
      className={s.word}
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {text}
    </motion.span>
  );
}

export type SentenceProps = {
  item: Commitment;
  kept: boolean;
  focused: boolean;
  flash: boolean;
  phone: boolean;
  open: TokenKind | null;
  onOpen: (kind: TokenKind | null) => void;
  onPatch: (patch: Partial<Commitment>) => void;
  onToggle: () => void;
  onNudge: () => void;
  onRemove: () => void;
  onFocus: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  draggable: boolean;
  asked?: boolean;
  onTake?: () => void;
};

export function Sentence({
  item,
  kept,
  focused,
  flash,
  phone,
  open,
  onOpen,
  onPatch,
  onToggle,
  onNudge,
  onRemove,
  onFocus,
  onDragStart,
  onDragEnd,
  draggable,
  asked,
  onTake,
}: SentenceProps) {
  const liRef = useRef<HTMLLIElement>(null);
  const [placement, setPlacement] = useState<Placement>({ x: "left", y: "down" });
  const owner = personById(item.owner);
  const waiting = personById(item.waitingOn);
  const late = isLate(item);
  const clause = dueClause(item);
  const close = () => onOpen(null);

  const openAt = (kind: TokenKind) => (el: HTMLElement) => {
    if (open === kind) return close();
    setPlacement(placementFor(el));
    onFocus();
    onOpen(kind);
  };

  const float = (kind: TokenKind, body: ReactNode, wide?: boolean) => (
    <Floating open={open === kind} phone={phone} title={TITLES[kind]} placement={placement} onClose={close} wide={wide}>
      {body}
    </Floating>
  );

  const commitAction = (el: HTMLElement) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text && text !== item.action) onPatch({ action: text });
    close();
  };

  const dueTone = late ? "late" : !item.due ? "none" : undefined;
  const ownerName = owner ? owner.name : "Someone";

  const waitText = waiting
    ? item.waitingFor
      ? `waiting on ${item.waitingFor} from ${waiting.name}`
      : `waiting on ${waiting.name}`
    : "waiting on …";

  const cls = [s.item, kept ? s.itemKept : "", focused ? s.itemFocused : "", flash ? s.itemFlash : "", open ? s.itemOpen : ""].join(" ");

  return (
    <motion.li
      ref={liRef}
      layout="position"
      layoutId={item.id}
      className={cls}
      data-id={item.id}
      transition={{ type: "spring", stiffness: 500, damping: 42 }}
      onMouseDown={onFocus}
    >
      {draggable && (
        <span
          className={s.grip}
          draggable
          aria-hidden
          title="Drag to hand this to someone else"
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", item.id);
            e.dataTransfer.effectAllowed = "move";
            if (liRef.current) e.dataTransfer.setDragImage(liRef.current, 24, 18);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >
          <Icon.grip size={14} />
        </span>
      )}

      <button
        type="button"
        className={kept ? `${s.check} ${s.checkOn}` : s.check}
        onClick={onToggle}
        aria-pressed={kept}
        aria-label={kept ? `Reopen: ${item.action}` : `Mark as kept: ${item.action}`}
      >
        <motion.span
          className={s.checkMark}
          initial={false}
          animate={kept ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 28 }}
        >
          <Icon.check size={12} strokeWidth={2.2} />
        </motion.span>
      </button>

      <div className={s.body}>
        <div className={s.sentence}>
          <span className={s.anchor}>
            <Token kind="owner" label={`Who: ${ownerName}. Change`} strong={!!owner} tone={owner ? undefined : "none"} open={open === "owner"} onOpen={openAt("owner")}>
              <Word text={ownerName} />
            </Token>
            {float("owner", <PersonPicker value={item.owner} noneLabel="Nobody yet" onPick={(id: PersonId | null) => { onPatch({ owner: id }); close(); }} />)}
          </span>{" "}
          will{" "}
          <span className={s.anchor}>
            {open === "action" ? (
              <span
                className={s.actionEdit}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="What they will do"
                ref={(el) => {
                  if (el && document.activeElement !== el) {
                    el.focus();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  }
                }}
                onBlur={(e) => commitAction(e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitAction(e.currentTarget);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.currentTarget.textContent = item.action;
                    close();
                  }
                }}
              >
                {item.action}
              </span>
            ) : (
              <Token kind="action" label={`What: ${item.action}. Edit`} open={false} onOpen={openAt("action")}>
                <Word text={item.action} />
              </Token>
            )}
          </span>
          {(item.forWhom || open === "for") && (
            <>
              {" "}
              <span className={s.anchor}>
                <Token kind="for" label={`For: ${item.forWhom ?? "nobody"}. Change`} ghost={!item.forWhom} open={open === "for"} onOpen={openAt("for")}>
                  <Word text={item.forWhom ? `for\u00a0${item.forWhom}` : "for …"} />
                </Token>
                {float("for", <ForPicker value={item.forWhom} onPick={(v) => { onPatch({ forWhom: v }); close(); }} />)}
              </span>
            </>
          )}
          {late || !item.due ? "," : ""}{" "}
          <span className={s.anchor}>
            <Token kind="due" label={`When: ${clause}. Change`} tone={dueTone} open={open === "due"} onOpen={openAt("due")}>
              <Word text={clause.replace(/ /g, "\u00a0")} />
            </Token>
            {float("due", <DatePicker value={item.due} onPick={(iso) => { onPatch({ due: iso }); close(); }} />)}
          </span>
          {(waiting || open === "waiting") && (
            <>
              ,{" "}
              <span className={s.anchor}>
                <Token kind="waiting" label={`${waitText}. Change`} tone="wait" ghost={!waiting} open={open === "waiting"} onOpen={openAt("waiting")}>
                  <Word text={waitText} />
                </Token>
                {float(
                  "waiting",
                  <WaitingPicker
                    value={item.waitingOn}
                    what={item.waitingFor}
                    exclude={item.owner}
                    onPick={(id, what) => {
                      onPatch({ waitingOn: id, waitingFor: id ? what : null });
                      close();
                    }}
                  />,
                )}
              </span>
            </>
          )}
          .
        </div>
        {asked && !kept ? (
          <p className={s.asked}>
            <Icon.nudge size={13} />
            Asked {owner?.name} for an update just now
          </p>
        ) : (
          late &&
          !kept &&
          owner &&
          owner.id !== ME && (
            <p className={s.meta}>
              <button type="button" className={s.metaLink} onClick={onNudge}>
                <Icon.nudge size={13} />
                Ask {owner.name} for an update
              </button>
            </p>
          )
        )}
        {item.note && (
          <p className={s.note}>
            <Icon.note size={13} />
            {item.note}
          </p>
        )}
      </div>

      <div className={s.takeSlot}>
        {onTake && !kept && (
          <button type="button" className={s.takeButton} onClick={onTake}>
            Take it
          </button>
        )}
      </div>

      <div className={s.rowActions}>
        <span className={s.anchor}>
          <button
            type="button"
            className={s.iconButton}
            aria-label="More"
            aria-expanded={open === "menu"}
            onClick={(e) => {
              if (open === "menu") return close();
              setPlacement({ ...placementFor(e.currentTarget), x: "right" });
              onFocus();
              onOpen("menu");
            }}
          >
            <Icon.more />
          </button>
          <Floating open={open === "menu"} phone={phone} title="More" placement={placement} onClose={close}>
            <div className={s.menu}>
              {item.owner && item.owner !== ME && (
                <button type="button" className={s.menuItem} onClick={() => { close(); onNudge(); }}>
                  <Icon.nudge /> Ask {owner?.name} for an update
                </button>
              )}
              <button type="button" className={s.menuItem} onClick={() => onOpen("waiting")}>
                <Icon.pause /> {waiting ? "Change who it is waiting on" : "Waiting on someone"}
              </button>
              <button type="button" className={s.menuItem} onClick={() => onOpen("for")}>
                <Icon.person /> {item.forWhom ? "Change who it is for" : "Say who it is for"}
              </button>
              <button type="button" className={s.menuItem} onClick={() => onOpen("action")}>
                <Icon.note /> Reword it
              </button>
              <hr className={s.menuRule} />
              <button type="button" className={`${s.menuItem} ${s.menuDanger}`} onClick={() => { close(); onRemove(); }}>
                <Icon.trash /> Remove this promise
              </button>
            </div>
          </Floating>
        </span>
      </div>
    </motion.li>
  );
}
