"use client";

/**
 * MentionField — a textarea with a caret-anchored @mention popover
 * (Delight Layer Phase 3, Collaboration).
 *
 * Adapted from the component-lab Caret-Anchored Mention Popover and re-skinned
 * to the Signal Studio design system: light-locked, Geist, DS tokens, one
 * indigo accent, calm motion honouring prefers-reduced-motion.
 *
 * A textarea exposes only selectionStart (a character index), never the
 * caret's x/y. So this measures the caret by re-typesetting value.slice(0,
 * caret) into an invisible mirror that copies the textarea's own box metrics,
 * then reads a marker span's offset. The popover anchors to THAT point — it
 * follows what you're typing, not the field's corner. Focus never leaves the
 * textarea; ↑↓/Enter/Tab drive the list via aria-activedescendant.
 *
 * Drop-in for a plain <textarea>: same value/onChange/onKeyDown/placeholder/
 * className props. When the popover is open it intercepts nav keys; otherwise
 * it forwards onKeyDown so the host's Enter-to-send still works.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface MentionPerson {
  id: string;
  name: string;
  handle: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

// Style props that affect where a glyph lands — copied to the mirror so its
// text grid matches the textarea's exactly.
const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
  "lineHeight",
  "textIndent",
] as const;

function findToken(text: string, caret: number) {
  const before = text.slice(0, caret);
  const match = /(?:^|[\s([{])@([\w-]*)$/.exec(before);
  if (!match) return null;
  return { start: caret - match[1].length - 1, end: caret, query: match[1] };
}

function rank(people: MentionPerson[], query: string): MentionPerson[] {
  if (!query) return people;
  const q = query.toLowerCase();
  const scored: { person: MentionPerson; score: number }[] = [];
  for (const person of people) {
    const name = person.name.toLowerCase();
    const handle = person.handle.toLowerCase();
    let score = -1;
    if (name.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (handle.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 1;
    else if (handle.includes(q)) score = 0;
    if (score >= 0) scored.push({ person, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.person);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  people: MentionPerson[];
  /** Called when the popover is NOT consuming the key (host Enter-to-send). */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onKeyDown">;

export const MentionField = forwardRef<HTMLTextAreaElement, Props>(function MentionField(
  { value, onChange, people, onKeyDown, className, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => innerRef.current!, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const listboxId = useId();

  const [token, setToken] = useState<{ start: number; end: number; query: string } | null>(null);
  const [matches, setMatches] = useState<MentionPerson[]>([]);
  const [active, setActive] = useState(0);
  const [caret, setCaret] = useState<{ x: number; y: number; h: number } | null>(null);
  const [placeAbove, setPlaceAbove] = useState(false);

  const open = token !== null && matches.length > 0;

  const measureCaret = useCallback((caretIndex: number) => {
    const ta = innerRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    const cs = getComputedStyle(ta);
    for (const prop of MIRROR_PROPS) {
      mirror.style[prop] = cs[prop];
    }
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = ta.value.slice(0, caretIndex);
    const marker = document.createElement("span");
    marker.textContent = "​";
    mirror.appendChild(marker);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const x = ta.offsetLeft + marker.offsetLeft - ta.scrollLeft;
    const y = ta.offsetTop + marker.offsetTop - ta.scrollTop;
    setCaret({ x, y, h: lineHeight });
  }, []);

  const sync = useCallback(
    (overrideIndex?: number) => {
      const ta = innerRef.current;
      if (!ta) return;
      const caretIndex = overrideIndex ?? ta.selectionStart ?? ta.value.length;
      const found = findToken(ta.value, caretIndex);
      if (found) {
        const ranked = rank(people, found.query);
        setToken(found);
        setMatches(ranked);
        setActive(0);
        measureCaret(caretIndex);
      } else {
        setToken(null);
        setMatches([]);
      }
    },
    [people, measureCaret],
  );

  // Re-sync after a controlled value change, and restore a pending caret
  // after a mention insertion.
  useLayoutEffect(() => {
    const ta = innerRef.current;
    if (!ta) return;
    const pending = pendingCaretRef.current;
    pendingCaretRef.current = null;
    if (pending != null) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(pending, pending);
    }
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Flip above when the caret popover would overflow the viewport bottom.
  useLayoutEffect(() => {
    if (!open || !caret || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const listH = listRef.current?.offsetHeight ?? 0;
    const belowTop = rect.top + caret.y + caret.h + 6;
    setPlaceAbove(belowTop + listH + 12 > window.innerHeight && rect.top + caret.y - listH - 6 >= 8);
  }, [open, caret, matches.length]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const insert = useCallback(
    (person: MentionPerson) => {
      const ta = innerRef.current;
      if (!ta || !token) return;
      const mention = `@${person.name}`;
      const next = `${value.slice(0, token.start)}${mention} ${value.slice(ta.selectionStart)}`;
      pendingCaretRef.current = token.start + mention.length + 1;
      setToken(null);
      setMatches([]);
      onChange(next);
    },
    [token, value, onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insert(matches[active]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setToken(null);
        setMatches([]);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div ref={wrapRef} className="relative flex-1">
      <textarea
        {...rest}
        ref={innerRef}
        value={value}
        className={className}
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-${active}` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={() => sync()}
        onClick={() => sync()}
        onFocus={() => sync()}
        onBlur={() => {
          setToken(null);
          setMatches([]);
        }}
        onScroll={() => {
          if (token) measureCaret(innerRef.current?.selectionStart ?? 0);
        }}
      />
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap [overflow-wrap:break-word]"
      />

      <AnimatePresence>
        {open && caret ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: placeAbove ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute z-40 w-60 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated p-1 shadow-[0_16px_40px_-16px_rgba(20,21,26,0.35)]"
            style={
              placeAbove
                ? { left: Math.max(0, caret.x), bottom: `calc(100% - ${caret.y}px + 6px)` }
                : { left: Math.max(0, caret.x), top: caret.y + caret.h + 6 }
            }
          >
            <ul role="listbox" id={listboxId} aria-label="People to mention" ref={listRef} className="max-h-[15rem] overflow-y-auto">
              {matches.map((person, index) => (
                <li
                  key={person.id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insert(person);
                  }}
                  onMouseMove={() => setActive(index)}
                  className={
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors " +
                    (index === active ? "bg-brand-soft/50" : "hover:bg-bg-sunken/50")
                  }
                >
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 flex-none place-items-center rounded-full bg-bg-sunken text-[9px] font-semibold tracking-[0.02em] text-ink-soft"
                  >
                    {initials(person.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[12.5px] font-medium text-ink">{person.name}</span>
                    <span className="truncate text-[10.5px] text-ink-quiet">@{person.handle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {open ? (
        <span className="sr-only" aria-live="polite">
          {matches.length} {matches.length === 1 ? "person" : "people"} found. Up and down to navigate, Enter to mention.
        </span>
      ) : null}
    </div>
  );
}) as (props: Props & { ref?: React.Ref<HTMLTextAreaElement> }) => ReactNode;

/** Build a mention pool from user ids + a resolver, de-duped, handle from name. */
export function toMentionPeople(
  ids: string[],
  resolve: (id: string) => { name: string } | undefined,
): MentionPerson[] {
  const seen = new Set<string>();
  const out: MentionPerson[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const name = resolve(id)?.name?.trim();
    if (!name || name === "Someone") continue;
    out.push({ id, name, handle: name.toLowerCase().replace(/\s+/g, "") });
  }
  return out;
}
