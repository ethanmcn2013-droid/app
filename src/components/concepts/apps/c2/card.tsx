"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BOARDS, KINDS, ZONES, type Board, type BoardKind, type KindId } from "./data";
import { Icon } from "./glyphs";
import { counts, kindOf, type BoardState } from "./model";
import s from "./c2.module.css";

type CardProps = {
  board: Board;
  st: BoardState;
  onKind: (k: KindId) => void;
};

export function ProjectCard({ board, st, onKind }: CardProps) {
  const kind = kindOf(st.kind);
  const who = board.people.filter((p) => p.name !== "You");
  return (
    <aside className={s.card} aria-label="About this Project" style={{ "--proj": board.colour } as React.CSSProperties}>
      <div className={s.cardId}>
        <span className={s.chip} aria-hidden="true" />
        <div className={s.cardIdText}>
          <p className={s.cardName}>{board.name}</p>
          <p className={s.cardMeta}>
            {kind ? kind.label : "Kind not chosen"}
            {board.createdNote ? ` · ${board.createdNote}` : ""}
          </p>
        </div>
      </div>

      <div className={s.countdown}>
        <p className={s.countNum}>{board.daysToGo}</p>
        <p className={s.countText}>
          <span className={s.countLabel}>{board.daysLabel}</span>
          <span className={s.countDate}>{board.date}</span>
        </p>
      </div>

      <div className={s.people} aria-label={`${board.people.length} people in this Project`}>
        <span className={s.faces} aria-hidden="true">
          {board.people.slice(0, 5).map((p) => (
            <span key={p.name} className={s.face}>{p.initial}</span>
          ))}
        </span>
        <span className={s.peopleText}>
          {board.canEdit ? `You and ${who.map((p) => p.name).join(", ")}` : `${board.owner} looks after this board`}
        </span>
      </div>

      <KindSelector board={board} value={st.kind} onChange={onKind} />

      <div className={s.honest}>
        <p className={s.honestTitle}>Where outlines come from</p>
        <p className={s.honestText}>
          From what this Project is and what is already in it: its tasks, dates, notes and people. Every tool is free and nothing is sold here.
        </p>
      </div>
    </aside>
  );
}

function KindSelector({ board, value, onChange }: { board: Board; value: BoardKind; onChange: (k: KindId) => void }) {
  const disabled = !board.canEdit;
  const name = `kind-${board.id}`;
  return (
    <fieldset className={s.kinds} disabled={disabled}>
      <legend className={s.kindsLegend}>This board is set up for</legend>
      <div className={s.kindList}>
        {KINDS.map((k) => (
          <label key={k.id} className={s.kind} data-on={value === k.id ? "true" : "false"}>
            <input
              type="radio"
              name={name}
              value={k.id}
              checked={value === k.id}
              onChange={() => onChange(k.id)}
              className={s.kindInput}
            />
            <span className={s.kindDot} aria-hidden="true" />
            <span className={s.kindText}>
              <span className={s.kindLabel}>{k.label}</span>
              <span className={s.kindHint}>{k.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <label className={s.kindSelectWrap}>
        <span className={s.kindSelectLabel}>Set up for</span>
        <select
          className={s.kindSelect}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as KindId)}
          disabled={disabled}
        >
          {value === null ? <option value="" disabled>Choose one</option> : null}
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <Icon name="chev" size={14} />
      </label>
      <p className={s.kindPromise}>
        {disabled
          ? `Only ${board.owner} can change this board.`
          : "Changing this only moves the outlines. Anything on the board stays where it is."}
      </p>
    </fieldset>
  );
}

type SwitcherProps = {
  current: string;
  states: Record<string, BoardState>;
  onPick: (id: string) => void;
};

export function BoardSwitcher({ current, states, onPick }: SwitcherProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={s.switcher} ref={wrap}>
      <button type="button" className={s.switchButton} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Other boards <Icon name="chev" size={14} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={s.switchMenu}
            initial={{ opacity: 0, y: reduced ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -4 }}
            transition={{ duration: 0.16 }}
          >
            <p className={s.switchHead}>Each Project has its own board</p>
            <ul className={s.switchList}>
              {BOARDS.map((b) => {
                const st = states[b.id];
                const c = counts(st);
                const k = kindOf(st.kind);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={s.switchItem}
                      aria-current={b.id === current ? "true" : undefined}
                      onClick={() => {
                        onPick(b.id);
                        setOpen(false);
                      }}
                      style={{ "--proj": b.colour } as React.CSSProperties}
                    >
                      <span className={s.chipSmall} aria-hidden="true" />
                      <span className={s.switchText}>
                        <span className={s.switchName}>{b.name}</span>
                        <span className={s.switchMeta}>
                          {k ? `${k.label} board` : "Kind not chosen"} · {c.on} on, {c.gaps} {c.gaps === 1 ? "outline" : "outlines"}
                          {b.canEdit ? "" : " · view only"}
                        </span>
                      </span>
                      <MiniBoard st={st} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MiniBoard({ st }: { st: BoardState }) {
  const cells = ZONES.flatMap((z) => st.order[z].map((id) => !!st.hung[id]));
  return (
    <span className={s.mini} aria-hidden="true">
      {cells.map((on, i) => (
        <span key={i} className={on ? s.miniOn : s.miniOff} />
      ))}
    </span>
  );
}
