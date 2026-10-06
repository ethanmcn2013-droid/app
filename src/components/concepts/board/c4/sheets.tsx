"use client";

import { motion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { STAGE_BY_KEY, dayLabel, type Card, type Person, type StageKey } from "./data";
import { ageLevel, daysText, moveOnLabel, nextStage, staysOf, type Placed } from "./model";
import { AgeRing, Avatar, BlockerLine, Journey } from "./parts";
import { Icon } from "./icons";
import styles from "./flow.module.css";

const SHEET = { type: "spring", stiffness: 380, damping: 36 } as const;

export function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className={styles.scrim}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

function historyLines(card: Card, day: number) {
  const stays = staysOf(card, day);
  return stays
    .map((s, i) => {
      const prev = i ? stays[i - 1].stage : null;
      const name = STAGE_BY_KEY[s.stage].name;
      let text = `Moved to ${name}`;
      if (!prev) text = `Added to ${name}`;
      else if (s.stage === "done") text = prev === "review" ? "Approved and done" : "Marked done";
      else if (prev === "review" && s.stage === "doing") text = "Sent back to In progress";
      else if (prev === "waiting") text = `Unblocked, back to ${name}`;
      return { key: `${i}-${s.from}`, text, when: dayLabel(s.from, { long: true }) };
    })
    .reverse();
}

export function CardDrawer({
  card,
  placed,
  people,
  usual,
  day,
  nudged,
  onClose,
  onRename,
  onMove,
  onNudge,
}: {
  card: Card;
  placed: Placed | null;
  people: Person[];
  usual: Record<StageKey, number>;
  day: number;
  nudged: boolean;
  onClose: () => void;
  onRename: (title: string) => void;
  onMove: (stage: StageKey) => void;
  onNudge: () => void;
}) {
  const owner = people.find((p) => p.id === card.owner);
  const approver = people.find((p) => p.id === card.approver);
  const stage = placed?.stage;
  const u = stage ? usual[stage] : 0;
  const next = stage ? nextStage(stage) : null;
  const live = day === 0;
  const [draft, setDraft] = useState(card.title);
  const nudgeWho = stage === "waiting" ? card.blocker?.who : approver?.first;

  return (
    <motion.aside
      className={styles.drawer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="c4-drawer-title"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={SHEET}
    >
      <header className={styles.drawerHead}>
        <span className={styles.stageChip} data-stage={stage}>
          {stage ? STAGE_BY_KEY[stage].name : "Not added yet"}
        </span>
        {!live ? <span className={styles.drawerPast}>As it was {dayLabel(day, { long: true })}</span> : null}
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close" autoFocus>
          <Icon.close size={16} />
        </button>
      </header>

      <div className={styles.drawerBody}>
        <h2 id="c4-drawer-title" className={styles.srOnly}>
          {card.title}
        </h2>
        <textarea
          className={styles.titleInput}
          value={draft}
          rows={2}
          readOnly={!live}
          aria-label="Task name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft.trim() && draft.trim() !== card.title && onRename(draft.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />

        {placed && stage !== "done" ? (
          <div className={styles.ageHero} data-level={ageLevel(placed.age, u)}>
            <AgeRing age={placed.age} usual={u} size={40} />
            <div>
              <p className={styles.ageHeroMain}>
                {placed.age === 0 ? `New in ${STAGE_BY_KEY[placed.stage].name} today` : `In ${STAGE_BY_KEY[placed.stage].name} for ${daysText(placed.age)}`}
              </p>
              <p className={styles.ageHeroSub}>
                Work usually spends {daysText(u)} here.{" "}
                {placed.age > u * 2 ? "This has been here more than twice as long." : placed.age > u ? "This has been here longer than usual." : "It is on pace."}
              </p>
            </div>
          </div>
        ) : null}

        <dl className={styles.facts}>
          <div>
            <dt>Owner</dt>
            <dd>
              <Avatar person={owner} size={22} /> {owner?.full}
              <span className={styles.factMuted}> · {owner?.role}</span>
            </dd>
          </div>
          {approver ? (
            <div>
              <dt>Signs it off</dt>
              <dd>
                <Avatar person={approver} size={22} /> {approver.full}
              </dd>
            </div>
          ) : null}
          {card.blocker && stage === "waiting" ? (
            <div>
              <dt>Waiting on</dt>
              <dd>
                <BlockerLine who={card.blocker.who} since={card.blocker.since} day={day} />
              </dd>
            </div>
          ) : null}
        </dl>

        {card.note ? <p className={styles.note}>{card.note}</p> : null}

        <section className={styles.drawerSection} aria-labelledby="c4-journey">
          <h3 id="c4-journey" className={styles.sectionTitle}>
            Journey
          </h3>
          <Journey card={card} day={day} />
        </section>

        <section className={styles.drawerSection} aria-labelledby="c4-history">
          <h3 id="c4-history" className={styles.sectionTitle}>
            History
          </h3>
          <ol className={styles.history}>
            {historyLines(card, day).map((l) => (
              <li key={l.key}>
                <span>{l.text}</span>
                <span className={styles.historyWhen}>{l.when}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {live && stage && stage !== "done" ? (
        <footer className={styles.drawerFoot}>
          {next ? (
            <button type="button" className={styles.primaryButton} onClick={() => onMove(next)}>
              <Icon.moveOn size={15} />
              {moveOnLabel(stage)}
            </button>
          ) : null}
          {stage === "review" ? (
            <button type="button" className={styles.secondaryButton} onClick={() => onMove("doing")}>
              <Icon.undo size={15} />
              Send back
            </button>
          ) : null}
          {nudgeWho ? (
            <button type="button" className={styles.secondaryButton} onClick={onNudge} disabled={nudged}>
              <Icon.bell size={15} />
              {nudged ? "Nudged today" : `Nudge ${nudgeWho}`}
            </button>
          ) : null}
        </footer>
      ) : null}
    </motion.aside>
  );
}

export function StuckTriage({
  items,
  people,
  usual,
  nudged,
  onClose,
  onNudge,
  onMoveOn,
  onSplit,
  onOpen,
}: {
  items: Placed[];
  people: Person[];
  usual: Record<StageKey, number>;
  nudged: Set<string>;
  onClose: () => void;
  onNudge: (p: Placed) => void;
  onMoveOn: (p: Placed) => void;
  onSplit: (p: Placed) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <motion.aside
      className={styles.triage}
      role="dialog"
      aria-modal="true"
      aria-labelledby="c4-triage-title"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={SHEET}
    >
      <span className={styles.grabber} aria-hidden="true" />
      <header className={styles.triageHead}>
        <div>
          <h2 id="c4-triage-title" className={styles.triageTitle}>
            {items.length ? `${items.length} things have sat too long` : "Nothing is stuck"}
          </h2>
          <p className={styles.triageSub}>{items.length ? "Oldest first. Clear what you can, split what is too big." : "Everything has moved within its usual time."}</p>
        </div>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close" autoFocus>
          <Icon.close size={16} />
        </button>
      </header>
      <ol className={styles.triageList}>
        {items.map((p) => {
          const u = usual[p.stage];
          const owner = people.find((x) => x.id === p.card.owner);
          const approver = people.find((x) => x.id === p.card.approver);
          const nudgeWho = p.stage === "waiting" ? p.card.blocker?.who : p.stage === "review" ? approver?.first : owner?.first;
          const isNudged = nudged.has(p.card.id);
          return (
            <motion.li key={p.card.id} layout className={styles.triageItem} exit={{ opacity: 0, x: 24 }}>
              <button type="button" className={styles.triageMain} onClick={() => onOpen(p.card.id)}>
                <AgeRing age={p.age} usual={u} size={26} />
                <span className={styles.triageText}>
                  <span className={styles.triageName}>{p.card.title}</span>
                  <span className={styles.triageMeta}>
                    {STAGE_BY_KEY[p.stage].name} for {daysText(p.age)} · usually {daysText(u)}
                    {p.card.blocker && p.stage === "waiting" ? ` · waiting on ${p.card.blocker.who}` : ""}
                  </span>
                </span>
              </button>
              <div className={styles.triageActions}>
                <button type="button" className={styles.chipButton} onClick={() => onNudge(p)} disabled={isNudged}>
                  <Icon.bell size={13} />
                  {isNudged ? "Nudged" : `Nudge ${nudgeWho ?? ""}`.trim()}
                </button>
                <button type="button" className={styles.chipButton} onClick={() => onMoveOn(p)}>
                  <Icon.moveOn size={13} />
                  {moveOnLabel(p.stage)}
                </button>
                <button type="button" className={styles.chipButton} onClick={() => onSplit(p)}>
                  <Icon.split size={13} />
                  Split
                </button>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </motion.aside>
  );
}

export function JourneyPopover({ placed, usual, day, rect }: { placed: Placed; usual: number; day: number; rect: { x: number; y: number; top: number; w: number } }) {
  const width = 348;
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const left = Math.max(12, Math.min(rect.x + rect.w - width, vw - width - 12));
  const above = rect.y + 130 > vh;
  return (
    <motion.div
      className={styles.popover}
      role="tooltip"
      style={(above ? { bottom: vh - rect.top + 8, left, width } : { top: rect.y + 8, left, width }) as CSSProperties}
      initial={{ opacity: 0, y: above ? 4 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
    >
      <p className={styles.popTitle}>
        {placed.age === 0 ? `New in ${STAGE_BY_KEY[placed.stage].name}` : `${daysText(placed.age)} in ${STAGE_BY_KEY[placed.stage].name}`}
        <span className={styles.popUsual}> · usually {daysText(usual)}</span>
      </p>
      <Journey card={placed.card} day={day} compact />
    </motion.div>
  );
}

export function Toast({ text, onUndo, onClose }: { text: string; onUndo?: () => void; onClose: () => void }) {
  return (
    <motion.div
      className={styles.toast}
      role="status"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={SHEET}
    >
      <span>{text}</span>
      {onUndo ? (
        <button type="button" className={styles.toastUndo} onClick={onUndo}>
          Undo
        </button>
      ) : null}
      <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
        <Icon.close size={14} />
      </button>
    </motion.div>
  );
}
