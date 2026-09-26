"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { bare, kindLabel, TONES, type Asset, type Board, type Verdict } from "./data";
import { Avatar, Face, VerdictPill } from "./tiles";
import * as I from "./icons";
import s from "./share.module.css";

type Props = {
  asset: Asset;
  index: number;
  total: number;
  boards: Board[];
  verdict?: { by: string; verdict: Verdict };
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
  onToggleBoard: (boardId: string) => void;
};

const THREAD: Record<string, { by: string; text: string; when: string }[]> = {
  m1: [
    { by: "Cian", text: "We'd need about 60 tapers for this. Brass holders from Hireco?", when: "Monday" },
    { by: "Orla", text: "Yes, and a fire check for the barn. I'll add it to the lighting task.", when: "Monday" },
  ],
  m14: [{ by: "Dee", text: "The script is lovely but hard to read from the gate. v3 fixes it.", when: "Last week" }],
  m28: [{ by: "Cian", text: "Three runs of festoon from the ridge, like this. Needs two extra sockets.", when: "Tuesday" }],
};

export function Lightbox({ asset, index, total, boards, verdict, onClose, onNav, onToggleBoard }: Props) {
  const reduce = useReducedMotion();
  const thread = THREAD[asset.id] ?? [];
  const visual = asset.kind === "image" || asset.kind === "pdf" || asset.kind === "sheet";
  return (
    <div className={s.layer} role="presentation">
      <motion.div className={`${s.scrim} ${s.scrimDeep}`} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mw-lb-title"
        className={s.lightbox}
        // The second click of the double-click that opened it lands here; don't let it word-select the panel.
        onMouseDown={(e) => {
          if (e.detail > 1) e.preventDefault();
        }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className={s.lbStage}>
          <motion.div key={asset.id} className={`${s.lbFace} ${visual ? "" : s.lbFaceType}`} style={{ aspectRatio: `1 / ${asset.ratio}`, "--r": asset.ratio } as CSSProperties} initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }}>
            <Face asset={asset} />
          </motion.div>
          <button type="button" className={`${s.lbNav} ${s.lbPrev}`} onClick={() => onNav(-1)} aria-label="Previous">
            <I.Left size={18} />
          </button>
          <button type="button" className={`${s.lbNav} ${s.lbNext}`} onClick={() => onNav(1)} aria-label="Next">
            <I.Right size={18} />
          </button>
        </div>
        <aside className={s.lbSide}>
          <div className={s.sideHead}>
            <div>
              <span className={s.lbCount}>
                {index + 1} of {total}
              </span>
              <h2 id="mw-lb-title" className={s.lbTitle}>
                {bare(asset.name)}
              </h2>
              <p className={s.sideSub}>
                {asset.name !== bare(asset.name) ? asset.name : kindLabel(asset.kind)}
                {asset.size ? `, ${asset.size}` : ""}. Added by {asset.by}, {asset.added.toLowerCase()}
                {asset.source === "Google Drive" ? ", from Google Drive" : ""}.
              </p>
            </div>
            <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
              <I.Close size={16} />
            </button>
          </div>

          {verdict ? (
            <div className={s.lbVerdict}>
              <VerdictPill verdict={verdict.verdict} by={verdict.by} />
              <span>on the shared page</span>
            </div>
          ) : null}

          {asset.tones.length ? (
            <div className={s.field}>
              <span className={s.label}>Colours</span>
              <div className={s.lbTones}>
                {asset.tones.map((t) => (
                  <span key={t} className={s.lbTone}>
                    <i style={{ background: TONES[t].hex }} />
                    {TONES[t].name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {asset.task ? (
            <div className={s.field}>
              <span className={s.label}>Attached to</span>
              <span className={s.lbTask}>
                <I.Task size={14} /> {asset.task}
              </span>
            </div>
          ) : null}

          <div className={s.field}>
            <span className={s.label}>Boards</span>
            <div className={s.lbBoards}>
              {boards.map((b) => {
                const on = b.items.includes(asset.id);
                return (
                  <button key={b.id} type="button" aria-pressed={on} className={`${s.lbBoard} ${on ? s.lbBoardOn : ""}`} onClick={() => onToggleBoard(b.id)}>
                    {on ? <I.Check size={12} /> : <I.Plus size={12} />}
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={s.field}>
            <span className={s.label}>Conversation</span>
            {thread.length ? (
              <ul className={s.thread}>
                {thread.map((c, i) => (
                  <li key={i}>
                    <Avatar name={c.by} size={22} />
                    <div>
                      <b>{c.by}</b> <span className={s.threadWhen}>{c.when}</span>
                      <p>{c.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.sideSub}>Nothing yet. Comments here stay with your team and never reach a shared page.</p>
            )}
          </div>
          <div className={s.lbKeys} aria-hidden="true">
            <kbd>←</kbd>
            <kbd>→</kbd> to move, <kbd>Esc</kbd> to close
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
