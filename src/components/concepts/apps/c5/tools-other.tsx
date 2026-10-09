"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { FILES, NOTES, PEOPLE, POSTS, PRESS, PROOFS, toolById, type Journalist, type Section, type ToolId } from "./data";
import { cx, useBench } from "./ctx";
import { Avatar } from "./tools-day";
import { AlertIcon, EyeIcon, PauseIcon, PlayIcon, ToolGlyph } from "./glyphs";
import t from "./tools.module.css";

const hue = (n: number) => `var(--v3-project-${n})`;

/* ── Shared doc outline ─────────────────────────────────────────── */

export function OutlineBody() {
  const b = useBench();
  const words = b.sections.reduce((a, s) => a + s.words, 0);
  const target = b.sections.reduce((a, s) => a + s.target, 0);
  const [open, setOpen] = useState<string | null>("x4");
  return (
    <div className={t.body}>
      <div className={t.docHead}>
        <span className={t.docTitle}>How Cork remembers its floods</span>
        <span className={t.docMeta}>
          Group essay · hand in Friday at 5pm · <span className={t.num}>{words.toLocaleString("en-IE")}</span> of <span className={t.num}>{target.toLocaleString("en-IE")}</span> words
        </span>
        <span className={t.meter} aria-hidden="true">
          <span style={{ width: `${Math.min(100, (words / target) * 100)}%` }} />
        </span>
      </div>
      <ol className={t.outline}>
        {b.sections.map((s, i) => {
          const pct = Math.min(1, s.words / s.target);
          const isOpen = open === s.id;
          return (
            <motion.li key={s.id} layout="position" className={cx(t.section, b.flash === s.id && t.flashRow)}>
              <button type="button" className={t.sectionHead} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                <span className={cx(t.sectionNum, t.num)}>{i + 1}</span>
                <span className={t.sectionTitle}>{s.title}</span>
                <Avatar who={s.who} size={22} />
              </button>
              <div className={t.sectionBar}>
                <span className={t.barTrack} aria-hidden="true">
                  <span className={cx(t.barFill, pct >= 1 && t.barDone)} style={{ width: `${pct * 100}%` }} />
                </span>
                <span className={cx(t.sectionWords, t.num)}>
                  {s.words} / {s.target}
                </span>
              </div>
              {isOpen && s.points.length > 0 && (
                <ul className={t.points}>
                  {s.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {isOpen && s.points.length === 0 && <p className={t.pointsEmpty}>Nothing written yet. {PEOPLE[s.who].name.split(" ")[0]} has this one.</p>}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Group split ─────────────────────────────────────────────────── */

const GROUP: Section["who"][] = ["Sam", "Priya", "Jonah", "Leah"];

export function SplitBody() {
  const b = useBench();
  const total = b.sections.reduce((a, s) => a + s.target, 0);
  const fair = Math.round(total / GROUP.length);
  const rows = GROUP.map((who) => {
    const mine = b.sections.filter((s) => s.who === who);
    const share = mine.reduce((a, s) => a + s.target, 0);
    const left = mine.reduce((a, s) => a + Math.max(0, s.target - s.words), 0);
    return { who, mine, share, left };
  });
  const max = Math.max(...rows.map((r) => r.share), fair);
  const heavy = [...rows].sort((p, q) => q.left - p.left)[0];
  const light = [...rows].sort((p, q) => p.left - q.left)[0];
  const movable = heavy.mine.find((s) => s.words < s.target / 2 && s.target <= 450);
  return (
    <div className={t.body}>
      <p className={t.splitIntro}>
        A fair share is about <strong className={t.num}>{fair}</strong> words each.
      </p>
      <ul className={t.splitList}>
        {rows.map((r) => (
          <li key={r.who} className={t.splitRow}>
            <div className={t.splitWho}>
              <Avatar who={r.who} size={28} />
              <span className={t.splitName}>{PEOPLE[r.who].name.split(" ")[0]}</span>
              <span className={cx(t.splitLeft, t.num)}>{r.left === 0 ? "All written" : `${r.left} words to go`}</span>
            </div>
            <div className={t.splitTrack} aria-hidden="true">
              <motion.span layout className={t.splitShare} style={{ width: `${(r.share / max) * 100}%` }} />
              <span className={t.splitFair} style={{ left: `${(fair / max) * 100}%` }} />
            </div>
            <span className={t.splitParts}>{r.mine.map((s) => s.title).join(", ") || "Nothing yet"}</span>
          </li>
        ))}
      </ul>
      <p className={t.legendRow}>
        <span className={t.fairKey} aria-hidden="true" /> Fair share line
      </p>
      {movable && light.who !== heavy.who && (
        <div className={t.suggest}>
          <p>
            {PEOPLE[heavy.who].name.split(" ")[0]} has the most left to write and {PEOPLE[light.who].name.split(" ")[0]} is done. Move “{movable.title}” to {PEOPLE[light.who].name.split(" ")[0]}?
          </p>
          <button type="button" className={t.primaryBtn} onClick={() => b.reassign(movable.id, light.who)}>
            Move it
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Study timer ─────────────────────────────────────────────────── */

export function StudyBody() {
  const [left, setLeft] = useState(18 * 60 + 40);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 25 * 60)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  const frac = 1 - left / (25 * 60);
  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <div className={cx(t.body, t.timer)}>
      <p className={t.timerLabel}>Focus, session 3 of 4</p>
      <div className={cx(t.ringWrap, t.ringSmall)}>
        <svg viewBox="0 0 170 170" className={t.ring} aria-hidden="true">
          <circle cx="85" cy="85" r={R} className={t.ringTrack} />
          <circle cx="85" cy="85" r={R} className={cx(t.ringFill, t.ringStudy)} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 85 85)" />
        </svg>
        <div className={t.ringCenter}>
          <span className={cx(t.midTime, t.num)} role="timer">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
          <span className={t.timerAt}>then a 5 minute break</span>
        </div>
      </div>
      <button type="button" className={t.primaryBtn} onClick={() => setRunning((r) => !r)}>
        {running ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
        {running ? "Pause" : "Keep going"}
      </button>
      <ul className={t.studyWho}>
        <li>
          <Avatar who="Priya" size={22} /> <span className={t.num}>{"Priya is studying, 12 minutes left"}</span>
        </li>
        <li>
          <Avatar who="Jonah" size={22} /> Jonah is on a break
        </li>
        <li>
          <Avatar who="Leah" size={22} /> Leah has not started today
        </li>
      </ul>
    </div>
  );
}

/* ── Social calendar ─────────────────────────────────────────────── */

const WEEK = ["Mon 28", "Tue 29", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4"];

export function SocialBody() {
  const ready = POSTS.filter((p) => p.state === "ready").length;
  const drafts = POSTS.filter((p) => p.state === "draft").length;
  return (
    <div className={t.body}>
      <p className={t.helper}>
        <span className={t.num}>{POSTS.length}</span> posts this week: <span className={t.num}>{ready}</span> ready, <span className={t.num}>{drafts}</span> still drafts. Launch is Saturday.
      </p>
      <ol className={t.week}>
        {WEEK.map((d, i) => {
          const posts = POSTS.filter((p) => p.day === i);
          return (
            <li key={d} className={cx(t.weekDay, i === 5 && t.weekLaunch)}>
              <span className={t.weekLabel}>
                {d}
                {i === 5 && <span className={t.launchTag}>Launch</span>}
              </span>
              <div className={t.weekPosts}>
                {posts.map((p) => (
                  <div key={p.id} className={cx(t.post, p.state === "draft" && t.postDraft)}>
                    <span className={t.postTop}>
                      <span className={t.num}>{p.time}</span> · {p.channel}
                    </span>
                    <span className={t.postTitle}>{p.title}</span>
                    <span className={cx(t.stateChip, p.state === "posted" ? t.chipGood : p.state === "ready" ? t.chipAccent : t.chipQuiet)}>{p.state === "posted" ? "Posted" : p.state === "ready" ? "Ready" : "Draft"}</span>
                  </div>
                ))}
                {posts.length === 0 && <span className={t.weekEmpty}>Nothing planned</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Press list ──────────────────────────────────────────────────── */

const PRESS_CHIP: Record<Journalist["state"], string> = { Covered: t.chipGood, Coming: t.chipAccent, "Kit sent": t.chipQuiet, "No reply": t.chipWarn };

export function PressBody() {
  const b = useBench();
  const [nudged, setNudged] = useState(false);
  const quiet = PRESS.filter((j) => j.state === "No reply");
  return (
    <div className={t.body}>
      <div className={t.pressCounts}>
        {(["Coming", "Covered", "Kit sent", "No reply"] as const).map((s) => (
          <span key={s} className={t.pressCount}>
            <strong className={t.num}>{PRESS.filter((j) => j.state === s).length}</strong>
            <span>{s === "Coming" ? "coming on the day" : s === "Covered" ? "covered it" : s === "Kit sent" ? "have the kit" : "no reply"}</span>
          </span>
        ))}
      </div>
      <ul className={t.pressList}>
        {PRESS.map((j) => (
          <li key={j.id} className={t.pressRow}>
            <span className={t.pressText}>
              <span className={t.pressName}>{j.name}</span>
              <span className={t.pressOutlet}>
                {j.outlet} · {j.beat}
              </span>
            </span>
            <span className={cx(t.stateChip, PRESS_CHIP[j.state])}>{j.state}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={t.softBtn}
        disabled={nudged}
        onClick={() => {
          setNudged(true);
          b.say(`A friendly follow-up went to ${quiet.map((j) => j.name.split(" ")[0]).join(" and ")}`);
        }}
      >
        {nudged ? "Follow-up sent" : `Follow up with the ${quiet.length} who have not replied`}
      </button>
    </div>
  );
}

/* ── Proof approvals: view only for you ──────────────────────────── */

export function ProofsBody() {
  const [asked, setAsked] = useState(false);
  return (
    <div className={t.body}>
      <div className={t.readOnly} role="note">
        <EyeIcon size={16} />
        <span>{asked ? "Asked. Aoife will see your request next to these proofs." : "You can view this. Ask Aoife to edit."}</span>
        {!asked && (
          <button type="button" className={t.softBtn} onClick={() => setAsked(true)}>
            Ask Aoife
          </button>
        )}
      </div>
      <ul className={t.proofs}>
        {PROOFS.map((p) => (
          <li key={p.id} className={t.proof}>
            <span className={t.proofArt} style={{ ["--p" as string]: hue(p.hue) }} aria-hidden="true">
              <span className={t.proofBlock} />
              <span className={t.proofLine} />
              <span className={cx(t.proofLine, t.proofShort)} />
            </span>
            <span className={t.proofText}>
              <span className={t.proofTitle}>{p.title}</span>
              <span className={t.proofMeta}>
                {p.kind} · version <span className={t.num}>{p.version}</span>
              </span>
              <span className={cx(t.stateChip, p.state === "Approved" ? t.chipGood : p.state === "Waiting" ? t.chipAccent : t.chipWarn)}>{p.state}</span>
              <span className={t.proofNote}>{p.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Notes and Files ─────────────────────────────────────────────── */

export function NotesBody() {
  const b = useBench();
  return (
    <ul className={cx(t.body, t.notes)}>
      {NOTES[b.project].map((n) => (
        <li key={n.id} className={t.note}>
          <span className={t.noteTop}>
            <span className={t.noteTitle}>{n.title}</span>
            <span className={t.noteWhen}>{n.when}</span>
          </span>
          <span className={t.noteBody}>{n.body}</span>
        </li>
      ))}
    </ul>
  );
}

const KIND: Record<(typeof FILES)[number]["kind"], string> = { doc: "var(--v3-kind-doc)", sheet: "var(--v3-kind-sheet)", image: "var(--v3-kind-image)", slides: "var(--v3-kind-slides)" };

export function FilesBody() {
  return (
    <ul className={cx(t.body, t.files)}>
      {FILES.map((f) => (
        <li key={f.id} className={t.file}>
          <span className={t.fileKind} style={{ borderColor: KIND[f.kind], color: KIND[f.kind] }} aria-hidden="true">
            {f.kind === "doc" ? "DOC" : f.kind === "sheet" ? "XLS" : f.kind === "image" ? "IMG" : "PPT"}
          </span>
          <span className={t.fileText}>
            <span className={t.fileName}>{f.name}</span>
            <span className={t.fileMeta}>
              <span className={t.num}>{f.size}</span> · {f.when}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Early: a tool with nothing in it yet ─────────────────────────── */

export function EarlyBody({ tool }: { tool: ToolId }) {
  const def = toolById(tool);
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setItems((xs) => [...xs, draft.trim()]);
    setDraft("");
  };
  return (
    <div className={cx(t.body, t.early)}>
      {items.length === 0 && (
        <>
          <span className={t.earlyTile} style={{ background: hue(def.hue) }} aria-hidden="true">
            <ToolGlyph tool={tool} size={24} />
          </span>
          <p className={t.earlyLine}>{def.first}</p>
        </>
      )}
      {items.length > 0 && (
        <ul className={t.earlyList}>
          <AnimatePresence initial={false}>
            {items.map((it, i) => (
              <motion.li key={`${it}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {it}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {adding ? (
        <form className={t.earlyForm} onSubmit={submit}>
          <label className={t.srOnly} htmlFor={`early-${tool}`}>
            {def.firstAction}
          </label>
          <input id={`early-${tool}`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={def.firstAction} />
          <button type="submit" className={t.primaryBtn}>
            Add
          </button>
        </form>
      ) : (
        <button type="button" className={t.primaryBtn} onClick={() => setAdding(true)}>
          {def.firstAction}
        </button>
      )}
    </div>
  );
}

/* ── A pane that could not open ──────────────────────────────────── */

export function FailedBody({ tool, onRetry, retrying }: { tool: ToolId; onRetry: () => void; retrying: boolean }) {
  const def = toolById(tool);
  if (retrying) {
    return (
      <div className={t.body} aria-busy="true" aria-label={`Opening ${def.name}`}>
        <div className={t.skeleton} />
        <div className={cx(t.skeleton, t.skeletonShort)} />
        <div className={t.skeletonBlock} />
      </div>
    );
  }
  return (
    <div className={cx(t.body, t.failed)} role="alert">
      <span className={t.failIcon} aria-hidden="true">
        <AlertIcon size={22} />
      </span>
      <p className={t.failTitle}>Could not open {def.name}.</p>
      <p className={t.failLine}>Your other tools are fine. Nothing you did was lost.</p>
      <button type="button" className={t.primaryBtn} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
