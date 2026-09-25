"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, relDay, dayMonth, diffDays, dueClause, isLate, PEOPLE, personById, PROJECT, TODAY, weekday, type Commitment } from "./data";
import { Icon } from "./icons";
import { useMounted } from "./hooks";
import s from "./c5.module.css";

type Section = "kept" | "late" | "soon" | "waiting" | "loose";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "kept", label: "Kept" },
  { id: "late", label: "Running late" },
  { id: "soon", label: "Coming up" },
  { id: "waiting", label: "Waiting" },
  { id: "loose", label: "Not picked up" },
];

type Line = { text: string; kind: "title" | "head" | "item" | "gap" | "plain" };

export function buildUpdate(items: Commitment[], on: Set<Section>): Line[] {
  const open = items.filter((x) => !x.keptOn);
  const kept = items.filter((x) => x.keptOn);
  const lines: Line[] = [{ kind: "title", text: `${PROJECT.name}: where we are, ${weekday(TODAY)} ${dayMonth(TODAY)}` }];

  if (on.has("kept")) {
    const byPerson = PEOPLE.map((p) => ({ p, n: kept.filter((x) => x.owner === p.id).length }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);
    lines.push({ kind: "gap", text: "" });
    if (byPerson.length === 0) {
      lines.push({ kind: "plain", text: "Nothing kept yet this week." });
    } else {
      const [first, ...rest] = byPerson;
      const tail = rest.map((r) => `${r.p.name} ${r.n}`);
      const joined = tail.length > 1 ? `${tail.slice(0, -1).join(", ")} and ${tail[tail.length - 1]}` : tail[0];
      lines.push({
        kind: "plain",
        text: `This week: ${first.p.name} kept ${first.n} ${first.n === 1 ? "promise" : "promises"}${joined ? `, ${joined}` : ""}. ${kept.length} in all.`,
      });
    }
  }

  const who = (x: Commitment) => personById(x.owner)?.name ?? "Nobody yet";
  const what = (x: Commitment) => `${x.action}${x.forWhom ? ` for ${x.forWhom}` : ""}`;

  if (on.has("late")) {
    const late = open.filter(isLate).sort((a, b) => (a.due! < b.due! ? -1 : 1));
    lines.push({ kind: "gap", text: "" });
    lines.push({ kind: "head", text: late.length ? "Running late" : "Nothing is running late." });
    late.forEach((x) => lines.push({ kind: "item", text: `${who(x)}, ${what(x)} (${dueClause(x).replace("was ", "")})` }));
  }

  if (on.has("soon")) {
    const soon = open
      .filter((x) => x.due && !isLate(x) && diffDays(x.due) <= 3)
      .sort((a, b) => (a.due! < b.due! ? -1 : 1));
    lines.push({ kind: "gap", text: "" });
    lines.push({ kind: "head", text: soon.length ? `Coming up by ${weekday(addDays(TODAY, 3))}` : `Nothing due before ${weekday(addDays(TODAY, 4))}.` });
    soon.forEach((x) => lines.push({ kind: "item", text: `${who(x)}, ${what(x)} (${relDay(x.due!)})` }));
  }

  if (on.has("waiting")) {
    const waiting = open.filter((x) => x.waitingOn);
    if (waiting.length) {
      lines.push({ kind: "gap", text: "" });
      lines.push({ kind: "head", text: "Waiting on someone" });
      waiting.forEach((x) =>
        lines.push({
          kind: "item",
          text: `${who(x)} needs ${x.waitingFor ?? "an answer"} from ${personById(x.waitingOn)?.name} to ${x.action}`,
        }),
      );
    }
  }

  if (on.has("loose")) {
    const loose = open.filter((x) => !x.owner);
    if (loose.length) {
      lines.push({ kind: "gap", text: "" });
      lines.push({ kind: "head", text: "Not picked up yet" });
      loose.forEach((x) => lines.push({ kind: "item", text: what(x) }));
    }
  }
  return lines;
}

const asText = (lines: Line[]) =>
  lines.map((l) => (l.kind === "item" ? `- ${l.text}` : l.kind === "head" ? `${l.text}:` : l.text)).join("\n").replace(/:\n?$/, "");

export function UpdatePreview({
  open,
  phone,
  items,
  onClose,
  onCopied,
}: {
  open: boolean;
  phone: boolean;
  items: Commitment[];
  onClose: () => void;
  onCopied: () => void;
}) {
  const [on, setOn] = useState<Set<Section>>(() => new Set<Section>(["kept", "late", "soon", "waiting", "loose"]));
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();
  const mounted = useMounted();
  const lines = useMemo(() => buildUpdate(items, on), [items, on]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(lines));
    } catch {
      // Clipboard can be blocked in previews; the preview is still selectable.
    }
    setCopied(true);
    onCopied();
    window.setTimeout(() => setCopied(false), 2400);
  };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={phone ? s.sheetLayer : s.modalLayer} key="update">
          <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={phone ? `${s.sheet} ${s.sheetTall}` : s.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="c5-update-title"
            initial={phone ? { y: "100%" } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={phone ? { y: "100%" } : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            {phone && <div className={s.sheetGrab} aria-hidden />}
            <div className={s.modalHead}>
              <div>
                <h2 id="c5-update-title" className={s.modalTitle}>
                  Copy as update
                </h2>
                <p className={s.modalSub}>A plain note of the week, ready to paste into an email or a group chat.</p>
              </div>
              <button ref={closeRef} type="button" className={s.iconButton} onClick={onClose} aria-label="Close">
                <Icon.close />
              </button>
            </div>

            <div className={s.sectionToggles} role="group" aria-label="What to include">
              {SECTIONS.map((sec) => {
                const active = on.has(sec.id);
                return (
                  <button
                    type="button"
                    key={sec.id}
                    className={active ? `${s.toggle} ${s.toggleOn}` : s.toggle}
                    aria-pressed={active}
                    onClick={() =>
                      setOn((prev) => {
                        const next = new Set(prev);
                        if (next.has(sec.id)) next.delete(sec.id);
                        else next.add(sec.id);
                        return next;
                      })
                    }
                  >
                    {active && <Icon.check size={12} strokeWidth={2} />}
                    {sec.label}
                  </button>
                );
              })}
            </div>

            <div className={s.paper} aria-label="Preview">
              {lines.map((l, i) => (
                <motion.p
                  key={`${i}-${l.text}`}
                  className={
                    l.kind === "title" ? s.paperTitle : l.kind === "head" ? s.paperHead : l.kind === "item" ? s.paperItem : l.kind === "gap" ? s.paperGap : s.paperLine
                  }
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : Math.min(i * 0.025, 0.5), duration: 0.24 }}
                >
                  {l.text}
                </motion.p>
              ))}
            </div>

            <div className={s.modalFoot}>
              <p className={s.modalHint}>{lines.filter((l) => l.kind === "item").length} lines. Nothing is sent until you paste it.</p>
              <button type="button" className={s.primaryButton} onClick={copy}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copied ? "done" : "copy"}
                    className={s.buttonInner}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {copied ? <Icon.check /> : <Icon.copy />}
                    {copied ? "Copied" : "Copy update"}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
