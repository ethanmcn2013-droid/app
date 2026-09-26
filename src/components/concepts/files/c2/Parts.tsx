"use client";

import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "./focus";
import { AnimatePresence, motion } from "motion/react";
import type { Project } from "./data";
import * as I from "./icons";
import { askLabel, countdown, cx, plural, short, type FileView, type KitView } from "./model";
import { Preview } from "./Preview";
import { StateLine } from "./Kit";
import p from "./page.module.css";

/* ── Project switcher ────────────────────────────────────────────────── */

export type ProjectSummary = { id: string; name: string; kind: string; tone: number; initials: string; line: string };

export function Tile({ tone, initials, size = 20 }: { tone: number; initials: string; size?: number }) {
  return (
    <span className={p.tile} style={{ background: `var(--v3-project-${tone})`, width: size, height: size, fontSize: size * 0.42 }}>
      {initials}
    </span>
  );
}

export function Switcher({ current, all, onPick }: { current: Project; all: ProjectSummary[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className={p.switcher} ref={wrap}>
      <button type="button" className={p.switchBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Tile tone={current.tone} initials={current.initials} />
        <span>{current.name}</span>
        <I.Chevron size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={p.menu}
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <p className={p.menuHead}>Switch project</p>
            {all.map((pr) => (
              <button
                key={pr.id}
                type="button"
                role="menuitemradio"
                aria-checked={pr.id === current.id}
                className={cx(p.menuItem, pr.id === current.id && p.menuItemOn)}
                onClick={() => {
                  onPick(pr.id);
                  setOpen(false);
                }}
              >
                <Tile tone={pr.tone} initials={pr.initials} size={28} />
                <span className={p.menuText}>
                  <b>{pr.name}</b>
                  <span>
                    {pr.kind} · {pr.line}
                  </span>
                </span>
                {pr.id === current.id && <I.Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Anytime ─────────────────────────────────────────────────────────── */

export function Anytime({
  project,
  files,
  selected,
  onOpen,
  wide,
  setRef,
}: {
  project: Project;
  files: FileView[];
  selected: string | null;
  onOpen: (id: string) => void;
  wide?: boolean;
  setRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <aside ref={setRef} tabIndex={setRef ? -1 : undefined} className={cx(p.anytime, wide ? p.anytimeWide : p.anytimeCol)} aria-labelledby="anytime-title">
      <div className={p.anytimeHead}>
        <h2 id="anytime-title" className={p.anytimeTitle}>
          <I.Stack size={15} /> Anytime
        </h2>
        <p className={p.anytimeSub}>Reference you&rsquo;ll reach for at every stage</p>
      </div>
      <ul className={p.anyList}>
        {files.map((f) => (
          <li key={f.id}>
            <button type="button" className={cx(p.anyRow, selected === f.id && p.anyRowOn)} onClick={() => onOpen(f.id)} data-file={f.id}>
              <span className={p.anyThumb}>
                <Preview spec={f.preview} kind={f.kind} />
              </span>
              <span className={p.anyText}>
                <span className={p.anyName}>{f.name}</span>
                <span className={p.anySub}>
                  {f.from && f.from !== project.name.split(",")[0] ? (
                    <>
                      <span className={p.fromDot} aria-hidden="true" />
                      <span className={p.anySubText}>From {f.from}</span>
                    </>
                  ) : (
                    <span className={p.anySubText}>{f.note}</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {project.undated ? (
        <div className={p.undated}>
          <I.Calendar size={14} />
          <p>
            {plural(project.undated, "file")} on tasks without a date {project.undated === 1 ? "waits" : "wait"} here. Give the task a date and{" "}
            {project.undated === 1 ? "it moves" : "they move"} onto the timeline.
          </p>
        </div>
      ) : null}
    </aside>
  );
}

/* ── Peek ────────────────────────────────────────────────────────────── */

export function Peek({
  file,
  kit,
  index,
  count,
  onClose,
  onStep,
  onSetState,
  onAsk,
  onLand,
  onNudge,
}: {
  file: FileView;
  kit: KitView | null;
  index: number;
  count: number;
  onClose: () => void;
  onStep: (d: 1 | -1) => void;
  onSetState: (s: FileView["state"]) => void;
  onAsk: () => void;
  onLand: (name: string) => void;
  onNudge: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLElement>(null);
  useDialogFocus(box, { initial: "[data-peek-title]", trap: false });
  const ask = askLabel(file.who);
  const missing = file.state === "missing";
  return (
    <motion.aside
      ref={box}
      className={p.peek}
      role="dialog"
      aria-modal="false"
      aria-labelledby="peek-title"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={p.peekTop}>
        <span className={p.peekCrumb}>
          {kit ? (
            <>
              <I.Pack size={13} /> {kit.title}
            </>
          ) : (
            <>
              <I.Stack size={13} /> Anytime
            </>
          )}
          <span className={p.peekPos}>
            {index + 1} of {count}
          </span>
        </span>
        <span className={p.peekNav}>
          <button type="button" className={p.iconBtn} onClick={() => onStep(-1)} aria-label="Previous file">
            <I.ChevronLeft size={14} />
          </button>
          <button type="button" className={p.iconBtn} onClick={() => onStep(1)} aria-label="Next file">
            <I.ChevronRight size={14} />
          </button>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Close">
            <I.Close size={14} />
          </button>
        </span>
      </div>
      <div className={cx(p.peekStage, missing && p.peekStageMissing)}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={file.id}
            className={cx(p.peekPage, missing && p.peekPageMissing)}
            initial={{ opacity: 0, y: 10, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -10, rotate: 1.5 }}
            transition={{ duration: 0.2 }}
          >
            {missing ? (
              <span className={p.peekGhost}>
                <I.Upload size={20} />
                <span>Drop the file here or add it below</span>
              </span>
            ) : (
              <Preview spec={file.preview} kind={file.kind} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={p.peekBody}>
        <h2 id="peek-title" className={p.peekName} tabIndex={-1} data-peek-title="">
          {file.name}
        </h2>
        <div className={p.peekState}>
          <StateLine f={file} />
        </div>
        <dl className={p.peekMeta}>
          <dt>Needed for</dt>
          <dd>{kit ? `${kit.title}, ${short(kit.day)} (${countdown(kit.day)})` : "Every stage, kept on hand"}</dd>
          {file.task && (
            <>
              <dt>On task</dt>
              <dd className={p.peekTask}>
                <I.Task size={13} /> {file.task}
              </dd>
            </>
          )}
          {file.who && !missing && (
            <>
              <dt>{file.state === "waiting" ? "With" : "From"}</dt>
              <dd>
                {file.who === "you" ? "You" : file.who}
                {file.updated ? `, ${file.updated.toLowerCase() === "today" || file.updated.toLowerCase() === "yesterday" || file.updated === "Just now" ? file.updated.toLowerCase() : file.updated}` : ""}
              </dd>
            </>
          )}
          {missing && (
            <>
              <dt>Expected from</dt>
              <dd>{file.who === "you" ? "You" : file.who}</dd>
            </>
          )}
          {file.droppedAs && (
            <>
              <dt>Added as</dt>
              <dd>{file.droppedAs}</dd>
            </>
          )}
          {file.size && (
            <>
              <dt>Size</dt>
              <dd>{file.size}</dd>
            </>
          )}
        </dl>
      </div>
      <div className={p.peekActions}>
        {missing ? (
          <>
            {ask && !file.asked && (
              <button type="button" className={p.btnPrimary} onClick={onAsk}>
                <I.Send size={14} /> {ask}
              </button>
            )}
            <button type="button" className={ask && !file.asked ? p.btn : p.btnPrimary} onClick={() => input.current?.click()}>
              <I.Upload size={14} /> Add file
            </button>
            <input
              ref={input}
              type="file"
              className={p.hiddenInput}
              tabIndex={-1}
              aria-label={`Add ${file.name}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLand(f.name);
                e.target.value = "";
              }}
            />
          </>
        ) : (
          <>
            {file.state !== "ready" && (
              <button type="button" className={p.btnPrimary} onClick={() => onSetState("ready")}>
                <I.Check size={14} /> Mark ready
              </button>
            )}
            {file.state === "waiting" && (
              <button type="button" className={p.btn} onClick={onNudge}>
                <I.Bell size={14} /> Nudge {file.who}
              </button>
            )}
            <button type="button" className={p.btn}>
              <I.Open size={14} /> Open
            </button>
            {file.state === "ready" && kit && (
              <button type="button" className={p.btnQuiet} onClick={() => onSetState("draft")}>
                <I.Undo size={14} /> Back to draft
              </button>
            )}
          </>
        )}
      </div>
      <p className={p.peekKeys}>
        <kbd>↑</kbd> <kbd>↓</kbd> to move through the kit, <kbd>Esc</kbd> to close
      </p>
    </motion.aside>
  );
}

/* ── Ask for a missing file ──────────────────────────────────────────── */

export function AskDialog({
  file,
  kit,
  onClose,
  onSend,
}: {
  file: FileView;
  kit: KitView;
  onClose: () => void;
  onSend: () => void;
}) {
  const who = file.who ?? "them";
  const first = who.startsWith("the ") ? "there" : who;
  const [msg, setMsg] = useState(
    `Hi ${first}, could you send the ${file.name.toLowerCase()} before ${kit.title.toLowerCase()} on ${short(kit.day)}? You can drop it straight into the link below and it lands in the right place.`,
  );
  const [withLink, setWithLink] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, { initial: "textarea", trap: true });
  return (
    <div className={p.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={box}
        className={p.ask}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className={p.dialogHead}>
          <h2 id="ask-title" className={p.dialogTitle}>
            Ask {who} for the {file.name.toLowerCase()}
          </h2>
          <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Close">
            <I.Close size={14} />
          </button>
        </div>
        <div className={p.askTo}>
          <span className={p.askLabel}>To</span>
          <span className={p.personChip}>
            <I.Person size={13} /> {who}
          </span>
          <span className={p.askDue}>
            <I.Calendar size={13} /> Needed by {short(kit.day)}
          </span>
        </div>
        <label className={p.askField}>
          <span className={p.askLabel}>Message</span>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} />
        </label>
        <label className={p.check}>
          <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} />
          <span>
            <b>Include an upload link</b>
            <span>Whatever {who} sends fills this placeholder in {kit.title.toLowerCase()}. No account needed.</span>
          </span>
        </label>
        <div className={p.dialogFoot}>
          <button type="button" className={p.btnQuiet} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={p.btnPrimary} onClick={onSend}>
            <I.Send size={14} /> Send request
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Toast ───────────────────────────────────────────────────────────── */

export type ToastData = { id: number; text: string; action?: { label: string; run: () => void } };

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  return (
    <div className={p.toastWrap} aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={p.toast}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <span className={p.toastIcon}>
              <I.Check size={12} strokeWidth={2.4} />
            </span>
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className={p.toastAction}
                onClick={() => {
                  toast.action?.run();
                  onClose();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
