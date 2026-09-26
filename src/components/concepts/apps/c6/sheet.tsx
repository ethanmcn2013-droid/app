"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { APPS, DESTS, LEDGER, PROJECTS, SOURCES, flowFor, nodeById, projectById, wouldDo, type Choice, type Conn, type NodeDef, type ProjectId } from "./data";
import type { Action } from "./model";
import { Icon, NodeGlyph } from "./glyphs";
import { Swatch, Toggle, WeekBars, cx, pc } from "./parts";
import s from "./c6.module.css";

/* ── the frame: a side panel on desktop, a bottom sheet on phones ───── */

function Frame({ phone, label, onClose, children, footer }: { phone: boolean; label: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    el.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [el, onClose]);

  if (phone) {
    return (
      <>
        <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.div
          ref={setEl}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={cx(s.sheet, s.sheetPhone)}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 360 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 600) onClose();
          }}
        >
          <div className={s.grab} aria-hidden="true" />
          <div className={s.sheetScroll}>{children}</div>
          {footer && <div className={s.sheetFoot}>{footer}</div>}
        </motion.div>
      </>
    );
  }
  return (
    <motion.div
      ref={setEl}
      tabIndex={-1}
      role="dialog"
      aria-label={label}
      className={s.sheet}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={s.sheetScroll}>{children}</div>
      {footer && <div className={s.sheetFoot}>{footer}</div>}
    </motion.div>
  );
}

function Pair({ from, to, project, status }: { from: NodeDef; to: NodeDef; project: ProjectId | null; status?: Conn["status"] }) {
  return (
    <div className={cx(s.pair, pc(project))} aria-hidden="true">
      <span className={s.pairTile}>
        <NodeGlyph g={from.glyph} size={20} />
      </span>
      <svg className={cx(s.pairLine, status && s[`st_${status}`])} width="72" height="12" viewBox="0 0 72 12">
        <path d="M2 6 H70" strokeDasharray={status === "paused" ? "0.01 6" : status === "waiting" ? "6 5" : status === "broken" ? "26 12 40" : undefined} />
        {status === "live" && <circle className={s.pairDot} cx="0" cy="6" r="3" />}
      </svg>
      <span className={cx(s.pairTile, s.pairApp)}>
        <NodeGlyph g={to.glyph} size={20} />
      </span>
    </div>
  );
}

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className={s.iconBtn} aria-label="Close" onClick={onClose}>
      <Icon name="close" size={16} />
    </button>
  );
}

/* ── an existing line ────────────────────────────────────────────────── */

export function ConnectionSheet({ conn, phone, dispatch, onClose, events }: { conn: Conn; phone: boolean; dispatch: (a: Action) => void; onClose: () => void; events: { id: string; time: string; text: string; detail: string; conn: string }[] }) {
  const [confirm, setConfirm] = useState(false);
  const from = nodeById(conn.from);
  const to = nodeById(conn.to);
  const today = [...events, ...LEDGER].filter((e) => e.conn === conn.id);
  const status = conn.status;
  const verb = from.side === "source" ? "What comes in" : "What goes out";

  const footer = confirm ? (
    <div className={s.confirm}>
      <p className={s.confirmText}>
        Disconnect {from.name} from {to.name}? {from.side === "source" ? `Anything it already brought into ${to.name} stays where it is.` : "Nothing already sent is taken back."}
      </p>
      <div className={s.footBtns}>
        <button type="button" className={cx(s.btn, s.btnQuiet)} onClick={() => setConfirm(false)}>
          Keep it
        </button>
        <button
          type="button"
          className={cx(s.btn, s.btnDanger)}
          onClick={() => {
            dispatch({ type: "disconnect", id: conn.id });
            onClose();
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  ) : (
    <div className={s.footBtns}>
      {status === "paused" ? (
        <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={() => dispatch({ type: "resume", id: conn.id })}>
          <Icon name="play" /> Resume
        </button>
      ) : status === "live" ? (
        <button type="button" className={cx(s.btn, s.btnQuiet)} onClick={() => dispatch({ type: "pause", id: conn.id })}>
          <Icon name="pause" /> Pause
        </button>
      ) : null}
      <button type="button" className={cx(s.btn, s.btnGhostDanger)} onClick={() => setConfirm(true)}>
        Disconnect
      </button>
    </div>
  );

  return (
    <Frame phone={phone} label={`${from.name} to ${to.name}`} onClose={onClose} footer={footer}>
      <div className={s.sheetTop}>
        <Pair from={from} to={to} project={conn.project} status={status} />
        <Close onClose={onClose} />
      </div>
      <p className={s.sheetKicker}>
        {from.name} to {to.name}
      </p>
      <h2 className={s.sheetTitle}>{conn.label}</h2>

      {status !== "live" && (
        <div className={cx(s.callout, s[`callout_${status}`])}>
          <Icon name={status === "broken" ? "warn" : status === "paused" ? "pause" : "wait"} size={16} />
          <div>
            <p className={s.calloutText}>
              {status === "broken"
                ? `${from.name} stopped sending on 23 September. Sign in again and it picks up where it left off, including the emails in between.`
                : status === "paused"
                  ? `${conn.note ?? "Paused"}. Nothing new comes in until it is resumed. Nothing is lost while it waits.`
                  : `${conn.note}. It only reads what the rules below allow.`}
            </p>
            {status !== "paused" && (
              <button type="button" className={cx(s.btn, s.btnSm, status === "broken" ? s.btnWarn : s.btnPrimary)} onClick={() => dispatch({ type: status === "broken" ? "signIn" : "allow", id: conn.id })}>
                {status === "broken" ? "Sign in again" : "Allow access"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className={s.field}>
        <label className={s.fieldLabel} htmlFor="c6-project">
          Which Project
        </label>
        <div className={s.selectWrap}>
          <Swatch project={conn.project} size="md" />
          {conn.project === null ? (
            <span className={s.selectStatic}>Every Project</span>
          ) : (
            <select id="c6-project" className={s.select} value={conn.project} onChange={(e) => dispatch({ type: "project", id: conn.id, project: e.target.value as ProjectId })}>
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className={s.field}>
        <p className={s.fieldLabel}>{verb}, in plain words</p>
        <div className={s.rules}>
          {conn.rules.map((r) => (
            <Toggle key={r.id} on={r.on} label={r.text} onChange={() => dispatch({ type: "rule", id: conn.id, rule: r.id })} />
          ))}
        </div>
      </div>

      <WeekBars conn={conn} />

      <div className={s.field}>
        <p className={s.fieldLabel}>Today</p>
        {today.length ? (
          <ul className={s.miniList}>
            {today.map((e) => (
              <li key={e.id} className={s.miniItem}>
                <span className={cx(s.num, s.miniTime)}>{e.time}</span>
                <span>
                  {e.text}
                  {e.detail && <span className={s.miniDetail}>{e.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>{conn.next ?? "Nothing along this line yet today."}</p>
        )}
      </div>
    </Frame>
  );
}

/* ── a line just drawn: one plain question ───────────────────────────── */

export function NewSheet({ from, to, phone, onDone, onClose }: { from: string; to: string; phone: boolean; onDone: (choice: Choice) => void; onClose: () => void }) {
  const flow = flowFor(from, to);
  const a = nodeById(from);
  const b = nodeById(to);
  const [pick, setPick] = useState<string | null>(null);
  const choice = flow.choices.find((c) => c.id === pick) ?? null;
  return (
    <Frame
      phone={phone}
      label={`Connect ${a.name} to ${b.name}`}
      onClose={onClose}
      footer={
        <div className={s.footBtns}>
          <button type="button" className={cx(s.btn, s.btnQuiet)} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={cx(s.btn, s.btnPrimary)} disabled={!choice} onClick={() => choice && onDone(choice)}>
            {flow.access ? "Connect and allow access" : "Connect"}
          </button>
        </div>
      }
    >
      <div className={s.sheetTop}>
        <Pair from={a} to={b} project={choice?.project ?? null} />
        <Close onClose={onClose} />
      </div>
      <p className={s.sheetKicker}>
        {a.name} to {b.name}
      </p>
      <h2 className={s.sheetTitle}>{flow.question}</h2>
      <div className={s.choices} role="radiogroup" aria-label={flow.question}>
        {flow.choices.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={pick === c.id} disabled={c.taken} className={cx(s.choice, pc(c.project))} onClick={() => setPick(c.id)}>
            <span className={s.radio} aria-hidden="true" />
            <span className={s.choiceBody}>
              <span className={s.choiceLabel}>{c.label}</span>
              <span className={s.choiceHint}>
                <Swatch project={c.project} />
                <span>
                  {projectById(c.project).name} · {c.hint}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {flow.rules.length > 0 && (
        <div className={s.field}>
          <p className={s.fieldLabel}>It will also</p>
          <ul className={s.willList}>
            {flow.rules.map((r) => (
              <li key={r}>
                <Icon name="check" size={13} /> {r}
              </li>
            ))}
          </ul>
          <p className={s.muted}>You can change these any time from the line.</p>
        </div>
      )}
      {flow.access && <p className={s.muted}>{a.name} will ask you to allow access. Signal only reads what you choose here.</p>}
    </Frame>
  );
}

/* ── Connect to: the keyboard and touch way to draw a line ───────────── */

export function PickSheet({ node, conns, phone, onPick, onClose }: { node: string; conns: Conn[]; phone: boolean; onPick: (from: string, to: string) => void; onClose: () => void }) {
  const n = nodeById(node);
  // Sources connect to apps, apps to places out, and a place out is picked from its app.
  const reversed = n.side === "dest";
  const targets = n.side === "source" ? APPS : n.side === "app" ? DESTS.filter((d) => !d.later) : APPS;
  return (
    <Frame phone={phone} label={reversed ? `Send to ${n.name} from…` : `Connect ${n.name} to…`} onClose={onClose}>
      <div className={s.sheetTop}>
        <span className={s.pairTile}>
          <NodeGlyph g={n.glyph} size={20} />
        </span>
        <Close onClose={onClose} />
      </div>
      <p className={s.sheetKicker}>{n.would ?? n.sub}</p>
      <h2 className={s.sheetTitle}>{reversed ? `What should go to ${n.name}?` : `Connect ${n.name} to…`}</h2>
      <ul className={s.pickList}>
        {targets.map((t) => {
          const from = reversed ? t.id : node;
          const to = reversed ? node : t.id;
          const existing = conns.filter((c) => c.from === from && c.to === to);
          return (
            <li key={t.id}>
              <button type="button" className={s.pick} onClick={() => onPick(from, to)}>
                <span className={s.pickTile}>
                  <NodeGlyph g={t.glyph} />
                </span>
                <span className={s.choiceBody}>
                  <span className={s.choiceLabel}>{t.name}</span>
                  <span className={s.choiceHint}>
                    {existing.length
                      ? `Already on for ${existing.map((c) => (c.project ? projectById(c.project).name : "every Project")).join(" and ")}`
                      : reversed
                        ? `From ${t.name}`
                        : wouldDo(from, to)}
                  </span>
                </span>
                <Icon name="arrow" />
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

/* ── Connect something: start from a place ───────────────────────────── */

export function StartSheet({ conns, phone, onPick, onClose }: { conns: Conn[]; phone: boolean; onPick: (node: string) => void; onClose: () => void }) {
  const list = SOURCES.filter((x) => !x.later);
  return (
    <Frame phone={phone} label="Connect something" onClose={onClose}>
      <div className={s.sheetTop}>
        <span />
        <Close onClose={onClose} />
      </div>
      <p className={s.sheetKicker}>Pick where things come from. You choose where they go next.</p>
      <h2 className={s.sheetTitle}>Connect something</h2>
      <ul className={s.pickList}>
        {list.map((t) => {
          const on = conns.filter((c) => c.from === t.id).length;
          return (
            <li key={t.id}>
              <button type="button" className={s.pick} onClick={() => onPick(t.id)}>
                <span className={s.pickTile}>
                  <NodeGlyph g={t.glyph} />
                </span>
                <span className={s.choiceBody}>
                  <span className={s.choiceLabel}>{t.name}</span>
                  <span className={s.choiceHint}>{on ? `${on} on already · add another` : t.would}</span>
                </span>
                <Icon name="arrow" />
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
