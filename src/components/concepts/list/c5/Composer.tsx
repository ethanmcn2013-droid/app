"use client";

import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { dueClause, personById } from "./data";
import { Icon } from "./icons";
import { parseSentence, type Parsed, type Span } from "./parse";
import { Avatar } from "./Pickers";
import s from "./c5.module.css";

const EXAMPLES = [
  "Tom will price the late food by Thursday for the Doyle 50th",
  "Niamh will call the Doyles about parking by tomorrow",
  "Someone will collect the hay bales by 3 October",
];

export type ComposerHandle = { focus: () => void };

function Mirror({ text, spans }: { text: string; spans: Span[] }) {
  const out: ReactNode[] = [];
  let i = 0;
  spans.forEach((sp, k) => {
    if (sp.start > i) out.push(text.slice(i, sp.start));
    const cls = [s.mirrorTok, sp.kind === "waiting" ? s.mirrorWait : "", sp.kind === "owner" ? s.mirrorOwner : ""].join(" ");
    out.push(
      <span key={`${k}-${sp.kind}-${sp.start}`} className={cls} data-kind={sp.kind}>
        {text.slice(sp.start, sp.end)}
      </span>,
    );
    i = sp.end;
  });
  if (i < text.length) out.push(text.slice(i));
  // A trailing space keeps a final newline measurable.
  out.push("​");
  return <>{out}</>;
}

export const Composer = forwardRef<ComposerHandle, { onAdd: (p: Parsed) => void }>(function Composer({ onAdd }, ref) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);
  const parsed = useMemo(() => parseSentence(text), [text]);
  const owner = personById(parsed.owner);
  const ready = parsed.action.length > 1;

  const submit = () => {
    if (!ready) return;
    onAdd(parsed);
    setText("");
  };

  const kinds = new Set(parsed.spans.map((sp) => sp.kind));

  return (
    <div className={[s.composer, focused ? s.composerFocused : "", text ? "" : s.composerEmpty].join(" ")}>
      <div className={s.composerAvatar} aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={parsed.ownerKnown ? (parsed.owner ?? "none") : "blank"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
            className={s.composerAvatarInner}
          >
            {parsed.ownerKnown && owner ? <Avatar person={owner} size={28} /> : <span className={s.composerBlank}><Icon.plus size={14} /></span>}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={s.composerMain}>
        <label className={s.srOnly} htmlFor="c5-composer">
          New promise, written as a sentence
        </label>
        <div className={s.composerField}>
          <div className={s.mirror} aria-hidden>
            {text ? (
              <Mirror text={text} spans={parsed.spans} />
            ) : (
              <span className={s.placeholder}>
                <span className={s.blank}>Someone</span> will <span className={s.blank}>do something</span> by{" "}
                <span className={s.blank}>a day</span>
              </span>
            )}
          </div>
          <textarea
            id="c5-composer"
            ref={area}
            className={s.composerInput}
            value={text}
            rows={1}
            spellCheck={false}
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setText(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setText("");
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className={s.composerFoot}>
          {text ? (
            <div className={s.readBack} aria-live="polite">
              <span className={kinds.has("owner") ? s.readOn : s.readOff}>
                {parsed.ownerKnown ? (owner ? owner.name : "Nobody yet") : "Who?"}
              </span>
              <span className={kinds.has("due") ? s.readOn : s.readOff}>
                {kinds.has("due") ? dueClause({ due: parsed.due, keptOn: null }) : "no date yet"}
              </span>
              {parsed.forWhom && <span className={s.readOn}>for {parsed.forWhom}</span>}
              {parsed.waitingOn && <span className={s.readWait}>waiting on {personById(parsed.waitingOn)?.name}</span>}
            </div>
          ) : (
            <div className={s.examples}>
              <span className={s.examplesLabel}>Write it the way you would say it. Try</span>
              <button type="button" className={s.example} onClick={() => { setText(EXAMPLES[0]); area.current?.focus(); }}>
                {EXAMPLES[0]}
              </button>
            </div>
          )}
          <button type="button" className={s.addButton} disabled={!ready} onClick={submit}>
            Add promise
            <kbd className={s.kbdOn}>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
});
