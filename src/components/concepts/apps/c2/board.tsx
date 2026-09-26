"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { CORE, KINDS, TODAY_LABEL, TOOLS, ZONES, type Board, type GlyphId, type KindId, type ZoneId } from "./data";
import { Glyph, Icon } from "./glyphs";
import { counts, kindOf, nameOf, reasonFor, statusFor, zoneTitles, type BoardState } from "./model";
import s from "./c2.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

type BoardProps = {
  board: Board;
  st: BoardState;
  onOpen: (id: GlyphId) => void;
  onHang: (id: GlyphId) => void;
  onBrowse: () => void;
  onKind: (k: KindId) => void;
};

export function BoardCanvas({ board, st, onOpen, onHang, onBrowse, onKind }: BoardProps) {
  const titles = zoneTitles(st.kind);
  const { on, gaps } = counts(st);
  const reduced = useReducedMotion();
  const zones = ZONES.filter((z) => st.order[z].length > 0);
  const onlyCore = on === CORE.length && ZONES.every((z) => z === "always" || st.order[z].every((id) => !st.hung[id]));

  return (
    <section className={s.board} aria-label={`Board for ${board.name}`}>
      <div className={s.boardInner}>
        <AnimatePresence initial={false} mode="popLayout">
          {st.kind === null ? (
            <motion.div key="unset" className={s.promptBlock} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className={s.promptLine}>
                <span className={s.promptDot} aria-hidden="true" />
                Choose what this Project is and the board lays itself out.
              </p>
              {board.canEdit ? (
                <div className={s.kindChips} role="group" aria-label="This Project is">
                  {KINDS.map((k) => (
                    <button key={k.id} type="button" className={s.kindChip} onClick={() => onKind(k.id)}>
                      {k.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </motion.div>
          ) : gaps === 0 && board.canEdit ? (
            <motion.div key="full" className={s.prompt} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className={s.promptDotDone} aria-hidden="true"><Icon name="check" size={12} /></span>
              <span>Nothing missing for {kindNoun(st.kind)}.</span>
              <button type="button" className={s.linkButton} onClick={onBrowse}>Add something else</button>
            </motion.div>
          ) : onlyCore && board.canEdit ? (
            <motion.p key="fresh" className={s.prompt} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className={s.promptDot} aria-hidden="true" />
              Only the basics are on. Each outline is something {kindNoun(st.kind)} usually needs. Hang the ones you want.
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="popLayout">
          {zones.map((z) => (
            <Zone
              key={z}
              zone={z}
              title={titles[z]}
              board={board}
              st={st}
              reduced={!!reduced}
              onOpen={onOpen}
              onHang={onHang}
            />
          ))}
        </AnimatePresence>
      </div>
      <BoardFooter on={on} gaps={gaps} reduced={!!reduced} onBrowse={onBrowse} canEdit={board.canEdit} />
    </section>
  );
}

function kindNoun(k: BoardState["kind"]) {
  return kindOf(k)?.noun ?? "this Project";
}

type ZoneProps = {
  zone: ZoneId;
  title: string;
  board: Board;
  st: BoardState;
  reduced: boolean;
  onOpen: (id: GlyphId) => void;
  onHang: (id: GlyphId) => void;
};

function Zone({ zone, title, board, st, reduced, onOpen, onHang }: ZoneProps) {
  const ids = st.order[zone];
  const on = ids.filter((id) => st.hung[id]).length;
  const headId = `zone-${board.id}-${zone}`;
  return (
    <motion.section
      layout="position"
      transition={{ layout: { duration: reduced ? 0 : 0.3, ease: EASE }, opacity: { duration: 0.2 } }}
      className={s.zone}
      data-zone={zone}
      aria-labelledby={headId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={s.zoneHead}>
        <AnimatePresence initial={false} mode="wait">
          <motion.h2
            key={title}
            id={headId}
            className={s.zoneTitle}
            initial={{ opacity: 0, y: reduced ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -3 }}
            transition={{ duration: 0.14 }}
          >
            {title}
          </motion.h2>
        </AnimatePresence>
        <span className={s.zoneRule} aria-hidden="true" />
        <span className={s.zoneCount}>
          {zone === "always" ? "In every Project" : on === ids.length ? "All on" : `${on} of ${ids.length} on`}
        </span>
      </div>
      <ul className={s.grid} role="list">
        <AnimatePresence initial={false} mode="popLayout">
          {ids.map((id) => (
            <Slot key={id} id={id} board={board} st={st} reduced={reduced} onOpen={onOpen} onHang={onHang} />
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

type SlotProps = {
  id: GlyphId;
  board: Board;
  st: BoardState;
  reduced: boolean;
  onOpen: (id: GlyphId) => void;
  onHang: (id: GlyphId) => void;
};

function tileVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      lifted: { opacity: 0 },
      hung: { opacity: 1, transition: { duration: 0.16 } },
      gone: { opacity: 0, transition: { duration: 0.16 } },
    };
  }
  return {
    lifted: { opacity: 0, y: -16, scale: 1.02 },
    hung: {
      opacity: [0, 1, 1],
      y: [-16, 2, 0],
      scale: [1.02, 1, 1],
      transition: { duration: 0.22, times: [0, 0.72, 1], ease: EASE },
    },
    gone: { opacity: 0, y: -12, scale: 1.015, transition: { duration: 0.18, ease: EASE } },
  };
}

function Slot({ id, board, st, reduced, onOpen, onHang }: SlotProps) {
  const t = TOOLS[id];
  const hung = st.hung[id];
  const down = st.takenDown[id];
  const name = nameOf(id, st.kind);
  const core = CORE.includes(id);
  const fresh = st.moved?.id === id && st.moved.how === "hang";
  const detail = board.detail[id];
  const meter = hung ? detail?.meter : undefined;
  const status = hung ? statusFor(board, st, id) : "";
  const byOther = hung?.by && hung.by !== "You" && !core ? hung.by : null;
  const last = !hung
    ? null
    : hung.by === "You" && hung.on === TODAY_LABEL
      ? "Hung today"
      : detail?.last ?? (!core && hung.on ? `On since ${hung.on}` : null);
  const reasonId = `reason-${board.id}-${id}`;

  return (
    <motion.li
      layout="position"
      className={s.slot}
      style={{ "--tool": t.hue } as React.CSSProperties}
      data-hung={hung ? "true" : "false"}
      initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduced ? 1 : 0.97, transition: { duration: reduced ? 0.12 : 0.14 } }}
      transition={{
        layout: { duration: reduced ? 0 : 0.26, ease: EASE },
        opacity: { duration: 0.18, delay: reduced ? 0 : 0.27 },
        scale: { duration: 0.22, delay: reduced ? 0 : 0.27, ease: EASE },
      }}
    >
      {/* The painted outline. Always there, visible when the tool is not. */}
      <div className={s.silhouette} aria-hidden={hung ? true : undefined}>
        <motion.div
          className={s.outline}
          initial={false}
          animate={{ opacity: hung ? 0 : 1 }}
          transition={{ duration: 0.16, delay: hung ? 0.08 : 0.1 }}
        >
          <div className={s.outlineTop}>
            <span className={s.ghost}><Glyph id={id} size={20} dashed /></span>
          </div>
          {board.canEdit && !hung ? (
            <button type="button" className={s.outlineName} onClick={() => onOpen(id)} aria-describedby={reasonId}>
              {name}
            </button>
          ) : (
            <span className={s.outlineNameText}>{name}</span>
          )}
          <p className={s.reason} id={reasonId} data-down={down ? "true" : "false"}>
            {down ? `Taken down on ${down}. Your ${t.kept} is kept for 30 days.` : reasonFor(board, id)}
          </p>
          {board.canEdit ? (
            !hung ? (
              <div className={s.outlineFoot}>
                <button type="button" className={s.hangButton} onClick={() => onHang(id)} aria-label={`${down ? "Put back" : "Hang"} ${name} on the board`}>
                  <Icon name="down" size={14} />
                  {down ? "Put back" : "Hang it"}
                </button>
              </div>
            ) : null
          ) : (
            <p className={s.askText}>Ask {board.owner} to add this</p>
          )}
        </motion.div>
      </div>

      <AnimatePresence initial={fresh}>
        {hung ? (
          <motion.button
            key="tile"
            type="button"
            className={s.tile}
            onClick={() => onOpen(id)}
            variants={tileVariants(reduced)}
            initial="lifted"
            animate="hung"
            exit="gone"
          >
            <span className={s.tileTop}>
              <span className={s.glyph}><Glyph id={id} size={20} /></span>
              {byOther ? <span className={s.byline}>Hung by {byOther}</span> : null}
            </span>
            <span className={s.tileName}>{name}</span>
            <span className={s.tileStatus}>{status}</span>
            {meter ? (
              <span className={s.meter} aria-hidden="true">
                <span className={s.meterFill} style={{ width: `${Math.round((meter.value / meter.total) * 100)}%` }} />
              </span>
            ) : last ? (
              <span className={s.tileLast}>{last}</span>
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

function BoardFooter({ on, gaps, reduced, onBrowse, canEdit }: { on: number; gaps: number; reduced: boolean; onBrowse: () => void; canEdit: boolean }) {
  return (
    <footer className={s.footer}>
      <p className={s.footerCount} aria-live="polite">
        <Tick value={on} reduced={reduced} /> on the board, <Tick value={gaps} reduced={reduced} /> {gaps === 1 ? "outline" : "outlines"}
      </p>
      <div className={s.legend} aria-hidden="true">
        <span className={s.legendItem}><span className={s.legendSolid} />On</span>
        <span className={s.legendItem}><span className={s.legendDashed} />Would help here</span>
      </div>
      {canEdit ? (
        <button type="button" className={s.footerBrowse} onClick={onBrowse}>
          Every tool
        </button>
      ) : null}
    </footer>
  );
}

function Tick({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <span className={s.tick}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className={s.tickNum}
          initial={{ y: reduced ? 0 : "-70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduced ? 0 : "70%", opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.22, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
