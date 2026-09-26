"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CORE, FAMILY_LABEL, TOOLS, ZONES, type Board, type Family, type GlyphId, type Preview } from "./data";
import { Glyph, Icon } from "./glyphs";
import { nameOf, readsFor, reasonFor, statusFor, type BoardState } from "./model";
import s from "./c2.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

const PHONE_QUERY = "(max-width: 640px)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(PHONE_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function usePhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

function Shell({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const phone = usePhone();
  const off = reduced ? { opacity: 0 } : phone ? { opacity: 1, y: "100%" } : { opacity: 0, x: 24 };
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => prev?.focus?.({ preventScroll: true });
  }, []);
  return (
    <div className={s.sheetLayer}>
      <motion.div
        className={s.scrim}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={s.sheet}
        initial={off}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={off}
        transition={{ duration: phone ? 0.3 : 0.24, ease: EASE }}
      >
        <span className={s.grab} aria-hidden="true" />
        <button ref={closeRef} type="button" className={s.close} onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

type ToolSheetProps = {
  id: GlyphId;
  board: Board;
  st: BoardState;
  onClose: () => void;
  onHang: (id: GlyphId) => void;
  onTakeDown: (id: GlyphId) => void;
  onOpenTool: (id: GlyphId) => void;
};

export function ToolSheet({ id, board, st, onClose, onHang, onTakeDown, onOpenTool }: ToolSheetProps) {
  const t = TOOLS[id];
  const name = nameOf(id, st.kind);
  const hung = st.hung[id];
  const down = st.takenDown[id];
  const core = CORE.includes(id);
  const state = hung ? "On the board" : down ? "Taken down" : "Outline";
  const reads = readsFor(board, t);

  return (
    <Shell label={name} onClose={onClose}>
      <div className={s.sheetBody} style={{ "--tool": t.hue } as React.CSSProperties}>
        <header className={s.sheetHead}>
          <span className={hung ? s.sheetGlyph : s.sheetGhost}><Glyph id={id} size={24} dashed={!hung} /></span>
          <div>
            <h2 className={s.sheetTitle}>{name}</h2>
            <p className={s.sheetState} data-state={hung ? "on" : "off"}>
              {state}
              {hung && !core && hung.by ? <span className={s.sheetStateMeta}> · Hung by {hung.by === "You" ? "you" : hung.by} on {hung.on}</span> : null}
              {core ? <span className={s.sheetStateMeta}> · Always here</span> : null}
            </p>
          </div>
        </header>

        {hung ? (
          <p className={s.sheetStatus}>{statusFor(board, st, id)}</p>
        ) : (
          <div className={s.why}>
            <h3 className={s.whyTitle}>{down ? "Why the outline is still here" : `Why ${board.name} might want this`}</h3>
            <p className={s.whyText}>
              {down ? `You took it down on ${down}. Your ${t.kept} is kept for 30 days, so hanging it back picks up where you left off.` : reasonFor(board, id)}
            </p>
          </div>
        )}

        <PreviewCard preview={t.preview} name={name} dim={!hung} />

        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>What it does</dt>
            <dd>{t.does}</dd>
          </div>
          <div className={s.fact}>
            <dt>What it reads from this Project</dt>
            <dd>
              <ul className={s.factList}>
                {reads.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </dd>
          </div>
          <div className={s.fact}>
            <dt>What it adds</dt>
            <dd>
              <ul className={s.factList}>
                {t.adds.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </dd>
          </div>
        </dl>
      </div>

      <div className={s.sheetActions}>
        {!board.canEdit ? (
          <p className={s.sheetNote}>
            <Icon name="lock" size={14} /> You can view this board. {hung ? `${board.owner} looks after what is on it.` : `Ask ${board.owner} to add this.`}
          </p>
        ) : hung ? (
          <>
            <button type="button" className={s.primary} onClick={() => onOpenTool(id)}>
              Open {name}
            </button>
            {core ? (
              <p className={s.sheetNote}>Tasks, Timeline, Notes and Files are part of every Project, so they stay on.</p>
            ) : (
              <>
                <button type="button" className={s.secondary} onClick={() => onTakeDown(id)}>
                  Take it off the board
                </button>
                <p className={s.sheetNote}>Nothing is deleted. Its outline stays and your {t.kept} is kept for 30 days.</p>
              </>
            )}
          </>
        ) : (
          <>
            <button type="button" className={s.primary} onClick={() => onHang(id)}>
              <Icon name="down" size={16} /> {down ? "Hang it back" : "Hang it on the board"}
            </button>
            <p className={s.sheetNote}>Free, and you can take it down any time.</p>
          </>
        )}
      </div>
    </Shell>
  );
}

function PreviewCard({ preview, name, dim }: { preview: Preview; name: string; dim: boolean }) {
  return (
    <figure className={s.preview} data-dim={dim ? "true" : "false"}>
      <figcaption className={s.previewCap}>{dim ? `How ${name} looks once it is on` : "Right now"}</figcaption>
      <div className={s.previewBody}>
        <PreviewInner p={preview} />
      </div>
    </figure>
  );
}

function PreviewInner({ p }: { p: Preview }) {
  switch (p.type) {
    case "rows":
      return (
        <ul className={s.pvRows}>
          {p.rows.map((r) => (
            <li key={r.a} className={s.pvRow}>
              <span className={s.pvA}>{r.a}</span>
              <span className={s.pvB} data-tone={r.tone ?? "plain"}>{r.b}</span>
            </li>
          ))}
        </ul>
      );
    case "meter": {
      const pct = Math.round((p.value / p.total) * 100);
      const fmt = (n: number) => (p.money ? `€${n.toLocaleString("en-IE")}` : n.toLocaleString("en-IE"));
      return (
        <div>
          <p className={s.pvBig}>
            {fmt(p.value)} <span className={s.pvBigOf}>of {fmt(p.total)} {p.label.toLowerCase()}</span>
          </p>
          <span className={s.pvMeter} aria-hidden="true"><span className={s.pvMeterFill} style={{ width: `${pct}%` }} /></span>
          <ul className={s.pvRows}>
            {p.rows.map((r) => (
              <li key={r.a} className={s.pvRow}><span className={s.pvA}>{r.a}</span><span className={s.pvB}>{r.b}</span></li>
            ))}
          </ul>
        </div>
      );
    }
    case "seating":
      return (
        <div>
          <svg className={s.pvSeat} viewBox="0 0 280 92" role="img" aria-label={`${p.tables} round tables`}>
            {Array.from({ length: p.tables }, (_, i) => {
              const col = i % 7;
              const row = Math.floor(i / 7);
              const cx = 22 + col * 39;
              const cy = 24 + row * 44;
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={9} className={s.pvTable} />
                  {Array.from({ length: 8 }, (_, k) => {
                    const a = (k / 8) * Math.PI * 2;
                    return <circle key={k} cx={cx + Math.cos(a) * 15} cy={cy + Math.sin(a) * 15} r={2.6} className={s.pvChair} />;
                  })}
                </g>
              );
            })}
          </svg>
          <p className={s.pvNote}>{p.note}</p>
        </div>
      );
    case "timer":
      return (
        <div className={s.pvTimer}>
          <p className={s.pvTimerLabel}>{p.label}</p>
          <p className={s.pvTimerTime}>{p.time}</p>
          <p className={s.pvNote}>{p.next}</p>
        </div>
      );
    case "chat":
      return (
        <ul className={s.pvChat}>
          {p.lines.map((l) => (
            <li key={l.text} className={s.pvBubble} data-kept={l.kept ? "true" : "false"}>
              <span className={s.pvWho}>{l.who}</span>
              <span>{l.text}</span>
              {l.kept ? <span className={s.pvKept}><Icon name="check" size={12} /> Brought in</span> : null}
            </li>
          ))}
        </ul>
      );
    case "form":
      return (
        <div className={s.pvForm}>
          <p className={s.pvFormTitle}>{p.title}</p>
          {p.fields.map((f) => (
            <span key={f} className={s.pvField}>{f}</span>
          ))}
        </div>
      );
    case "count":
      return (
        <div className={s.pvTimer}>
          <p className={s.pvTimerTime}>{p.value}</p>
          <p className={s.pvTimerLabel}>{p.unit}</p>
          <p className={s.pvNote}>{p.note}</p>
        </div>
      );
    case "week":
      return (
        <ul className={s.pvWeek}>
          {p.days.map((d) => (
            <li key={d.d} className={s.pvDay}>
              <span className={s.pvDayLabel}>{d.d}</span>
              {d.items.map((i) => <span key={i} className={s.pvEvent}>{i}</span>)}
            </li>
          ))}
        </ul>
      );
  }
}

type BrowseProps = {
  board: Board;
  st: BoardState;
  onClose: () => void;
  onHang: (id: GlyphId) => void;
};

const FAMILIES: Exclude<Family, "core">[] = ["everyday", "events", "venues", "launches", "classes"];

export function BrowseSheet({ board, st, onClose, onHang }: BrowseProps) {
  const [q, setQ] = useState("");
  const placed = useMemo(() => new Set(ZONES.flatMap((z) => st.order[z])), [st.order]);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FAMILIES.map((f) => ({
      f,
      tools: Object.values(TOOLS).filter(
        (t) => t.family === f && (!needle || `${t.name} ${t.line}`.toLowerCase().includes(needle)),
      ),
    })).filter((g) => g.tools.length);
  }, [q]);

  return (
    <Shell label="Every tool" onClose={onClose}>
      <div className={s.sheetBody}>
        <header className={s.browseHead}>
          <h2 className={s.sheetTitle}>Every tool</h2>
          <p className={s.browseLead}>All free. Hang any of them on {board.name}. Nothing here is for sale.</p>
          <label className={s.search}>
            <Icon name="search" size={16} />
            <span className={s.srOnly}>Find a tool</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool" className={s.searchInput} />
          </label>
        </header>
        {groups.length === 0 ? (
          <p className={s.browseEmpty}>No tool called “{q}” yet. Tell us what you need at hello@signalstudio.ie.</p>
        ) : null}
        {groups.map((g) => (
          <section key={g.f} className={s.browseGroup} aria-label={FAMILY_LABEL[g.f]}>
            <h3 className={s.browseGroupTitle}>{FAMILY_LABEL[g.f]}</h3>
            <ul className={s.browseList}>
              {g.tools.map((t) => {
                const on = !!st.hung[t.id];
                const outline = !on && placed.has(t.id);
                return (
                  <li key={t.id} className={s.browseRow} style={{ "--tool": t.hue } as React.CSSProperties}>
                    <span className={on ? s.glyph : s.ghostSmall}><Glyph id={t.id} size={18} dashed={!on} /></span>
                    <span className={s.browseText}>
                      <span className={s.browseName}>{t.name}</span>
                      <span className={s.browseLine}>{t.line}</span>
                    </span>
                    {on ? (
                      <span className={s.browseOn}><Icon name="check" size={14} /> On</span>
                    ) : (
                      <button type="button" className={s.hangButton} onClick={() => onHang(t.id)} aria-label={`Hang ${t.name} on the board`}>
                        <Icon name="down" size={14} /> {outline ? "Hang it" : "Add"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}

export function Toast({ toast, onUndo }: { toast: { id: number; text: string; undo?: boolean } | null; onUndo: () => void }) {
  const reduced = useReducedMotion();
  return (
    <div className={s.toastLayer} aria-live="polite">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            className={s.toast}
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <span>{toast.text}</span>
            {toast.undo ? (
              <button type="button" className={s.toastUndo} onClick={onUndo}>
                <Icon name="undo" size={14} /> Undo
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
