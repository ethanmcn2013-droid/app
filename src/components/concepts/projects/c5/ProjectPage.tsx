"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import {
  KINDS,
  ME,
  PEOPLE,
  PLACES,
  STATUS,
  daysFrom,
  fmtDate,
  fmtLong,
  fmtShort,
  person,
  spokenWhen,
  upcomingSaturdays,
  type Activity,
  type Milestone,
  type Project,
  type Section,
  type Status,
  type Task,
} from "./data";
import { factsOf, phraseOf, projectSentences, type Tok } from "./summary";
import { LivingText } from "./LivingText";
import { Avatar, Glyph, hueStyle, hueVar } from "./bits";
import { Floating, Menu, anchorOf, type Anchor } from "./Floating";
import {
  Arrow,
  Calendar,
  Check,
  ChevronDown,
  KindGlyph,
  Lock,
  Message,
  Paperclip,
  Plus,
  ProjectKindIcon,
  StatusIcon,
  TasksIcon,
  TimelineIcon,
  Undo,
  Users,
} from "./icons";
import pg from "./page.module.css";
import s from "./shell.module.css";

export type Change = (fn: (p: Project) => Project, note?: { text: string; section: Section }) => void;

type PropKey = "status" | "date" | "owner" | "kind" | "place" | "guests";

const STATUS_DOT: Record<Status, string> = {
  "on-track": "var(--v3-success)",
  "at-risk": "var(--v3-warning)",
  blocked: "var(--v3-danger)",
  "on-hold": "var(--v3-control-border)",
};

export function ProjectPage({
  p,
  change,
  toast,
}: {
  p: Project;
  change: Change;
  toast: (msg: string) => void;
}) {
  const [peek, setPeek] = useState<{ tok: Tok; anchor: Anchor } | null>(null);
  const [menu, setMenu] = useState<{ key: PropKey; anchor: Anchor } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const readOnly = Boolean(p.wrapped);
  const sentences = projectSentences(p);
  const f = factsOf(p);
  const vars = hueStyle(p);

  const closePeek = () => setPeek(null);
  const closeMenu = () => setMenu(null);

  /* ── actions ─────────────────────────────────────────────────────── */

  const setStatus = (status: Status) =>
    change((x) => ({ ...x, status }), { text: `set the status to ${STATUS[status].phrase}`, section: "summary" });

  const setDate = (date: string | undefined) =>
    change((x) => ({ ...x, date }), {
      text: date ? `moved the date to ${fmtShort(date)}` : "cleared the date",
      section: "summary",
    });

  const toggleTask = (id: string) => {
    const task = p.tasks.find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    change(
      (x) => ({
        ...x,
        tasks: x.tasks.map((t) => (t.id === id ? { ...t, done } : t)),
        milestones: x.milestones.map((m) =>
          phraseOf(m) === phraseOf(task) ? { ...m, done, review: done ? false : m.review } : m,
        ),
      }),
      { text: `${done ? "finished" : "reopened"} ${phraseOf(task)}`, section: "summary" },
    );
  };

  const toggleMilestone = (m: Milestone) => {
    const done = !m.done;
    change(
      (x) => ({
        ...x,
        milestones: x.milestones.map((y) => (y.id === m.id ? { ...y, done, review: done ? false : y.review } : y)),
        tasks: x.tasks.map((t) => (phraseOf(t) === phraseOf(m) ? { ...t, done } : t)),
      }),
      { text: `${done ? "marked" : "unmarked"} ${phraseOf(m)} done`, section: "milestones" },
    );
  };

  const addTask = (title: string) =>
    change((x) => ({ ...x, tasks: [...x.tasks, { id: `t${Date.now()}`, title, who: ME, done: false }] }), {
      text: `added a task: ${title}`,
      section: "summary",
    });

  const addMilestone = (title: string, date: string) =>
    change(
      (x) => ({
        ...x,
        milestones: [...x.milestones, { id: `m${Date.now()}`, title, date, done: false }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      }),
      { text: `added the ${title.toLowerCase()} milestone`, section: "milestones" },
    );

  const showOnPage = (id: string) => {
    document.getElementById(`c5-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    window.setTimeout(() => setFlash(null), 1600);
  };

  const onToken = (tok: Tok, el: HTMLElement) => {
    if (readOnly && tok.kind !== "count" && tok.kind !== "person" && tok.kind !== "wrapped") return;
    setMenu(null);
    setPeek((cur) => (cur && cur.tok.key === tok.key ? null : { tok, anchor: anchorOf(el) }));
  };

  const openMenu = (key: PropKey, el: HTMLElement) => {
    if (readOnly) return;
    setPeek(null);
    setMenu((cur) => (cur?.key === key ? null : { key, anchor: anchorOf(el) }));
  };

  const margin = (section: Section) => p.activity.filter((a) => a.section === section).slice(0, 3);

  /* ── render ──────────────────────────────────────────────────────── */

  return (
    <article className={pg.doc} style={vars} data-readonly={readOnly ? "" : undefined} aria-label={p.name}>
      <header className={pg.cover} data-kind={p.kind}>
        <div className={pg.coverTools}>
          {readOnly ? null : (
            <button
              type="button"
              className={pg.coverBtn}
              onClick={() => change((x) => ({ ...x, hue: (x.hue % 8) + 1 }))}
            >
              Change colour
            </button>
          )}
        </div>
      </header>

      <div className={pg.sheet}>
        {/* Title block */}
        <Row>
          <div className={pg.iconWrap}>
            <Glyph p={p} size={64} />
          </div>
          {readOnly ? (
            <div className={pg.wrappedBar}>
              <Lock size={15} />
              <span>
                Wrapped on {fmtShort(p.wrapped!.on)}. This page is kept as a record and can’t be edited.
              </span>
              <button
                type="button"
                className={pg.ghostBtn}
                onClick={() =>
                  change((x) => ({ ...x, wrapped: undefined, status: "on-track" }), {
                    text: "reopened the project",
                    section: "summary",
                  })
                }
              >
                <Undo size={14} /> Reopen
              </button>
            </div>
          ) : null}
          <h1 className={pg.titleH}>
            {readOnly ? (
              <span className={pg.title}>{p.name}</span>
            ) : (
              <>
                <span className={s.srOnly}>{p.name}</span>
                <input
                  className={pg.title}
                  value={p.name}
                  aria-label="Rename project"
                  onChange={(e) => change((x) => ({ ...x, name: e.target.value }))}
                />
              </>
            )}
          </h1>
          {readOnly ? (
            <p className={pg.purpose}>{p.purpose}</p>
          ) : (
            <textarea
              className={pg.purpose}
              value={p.purpose}
              rows={1}
              placeholder="What is this project for? One line is plenty."
              aria-label="Purpose"
              onChange={(e) => change((x) => ({ ...x, purpose: e.target.value }))}
            />
          )}
          <p className={pg.meta}>
            <MetaItem label="Date" readOnly={readOnly} empty={!p.date} onOpen={(el) => openMenu("date", el)}>
              {p.date ? fmtDate(p.date) : "Add a date"}
            </MetaItem>
            <MetaItem label="Place" readOnly={readOnly} empty={!p.place} onOpen={(el) => openMenu("place", el)}>
              {p.place || "Add a place"}
            </MetaItem>
            {p.guests || (!readOnly && p.date) ? (
              <MetaItem label="Guests" readOnly={readOnly} empty={!p.guests} onOpen={(el) => openMenu("guests", el)}>
                {p.guests ? `${p.guests} guests` : "Add guests"}
              </MetaItem>
            ) : null}
            <MetaItem label="Kind" readOnly={readOnly} onOpen={(el) => openMenu("kind", el)}>
              {p.kind}
            </MetaItem>
            <MetaItem label="Owner" readOnly={readOnly} onOpen={(el) => openMenu("owner", el)}>
              <Avatar id={p.owner} size={16} />
              {person(p.owner).name}
            </MetaItem>
          </p>
        </Row>

        {/* The living summary */}
        <Row notes={margin("summary")} id="summary" lead>
          <Updates notes={margin("summary")}>
            <div className={pg.summaryHead}>
              <span className={pg.liveDot} aria-hidden="true" />
              <span>Written from the work</span>
              <span className={pg.summaryWhen}>· updated {p.edited ?? "40 min ago"}</span>
            </div>
          </Updates>
          <div aria-live="polite">
            <LivingText sentences={sentences} onToken={onToken} />
          </div>
          <nav className={pg.jumps} aria-label="Open this project in">
            <JumpLink icon={<TasksIcon size={15} />} label="Tasks" count={f.total - f.done} onClick={() => toast("Opens Tasks, filtered to this project.")} />
            <JumpLink icon={<TimelineIcon size={15} />} label="Timeline" onClick={() => toast("Opens this project on the Timeline.")} />
            <JumpLink icon={<Message size={15} />} label="Messages" count={p.id === "mara-finn" ? 2 : undefined} onClick={() => toast("Opens the project conversation.")} />
            <JumpLink icon={<Paperclip size={15} />} label="Files" count={p.links.length || undefined} onClick={() => toast("Opens Files for this project.")} />
          </nav>
        </Row>

        {/* Milestones */}
        <Row notes={margin("milestones")} id="milestones">
          <SectionHead notes={margin("milestones")} title="Milestones" meta={p.milestones.length ? `${p.milestones.filter((m) => m.done).length} of ${p.milestones.length} passed` : undefined} />
          <Milestones p={p} flash={flash} readOnly={readOnly} onToggle={toggleMilestone} onAdd={addMilestone} />
        </Row>

        {/* People */}
        <Row notes={margin("people")} id="people">
          <SectionHead notes={margin("people")} title="People" meta={`${new Set(p.roles.flatMap((r) => r.people)).size} people`} />
          <People p={p} readOnly={readOnly} change={change} />
        </Row>

        {/* Key links */}
        <Row notes={margin("links")} id="links">
          <SectionHead notes={margin("links")} title="Key links" meta={p.links.length ? `${p.links.length} pinned` : undefined} />
          <div className={pg.links}>
            {p.links.map((link) => (
              <button key={link.id} type="button" className={pg.linkTile} style={{ "--kind": `var(--v3-kind-${link.kind === "folder" ? "neutral" : link.kind})` } as CSSProperties} onClick={() => toast(`Opens ${link.title}.`)}>
                <span className={pg.kindTile}>
                  <KindGlyph kind={link.kind} size={16} />
                </span>
                <span className={pg.linkText}>
                  <span className={pg.linkTitle}>{link.title}</span>
                  <span className={pg.linkMeta}>{link.meta}</span>
                </span>
              </button>
            ))}
            {readOnly ? null : (
              <button type="button" className={pg.linkAdd} onClick={() => toast("Pick a file or paste a link to pin it here.")}>
                <Plus size={15} /> Pin a link
              </button>
            )}
          </div>
        </Row>

        {/* Notes */}
        <Row notes={margin("notes")} id="notes">
          <SectionHead notes={margin("notes")} title="Notes" />
          <div
            key={p.id}
            className={pg.notes}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            data-placeholder="Write anything the team should know: preferences, worries, the things nobody should forget."
            aria-label="Notes"
            role="textbox"
            aria-multiline="true"
          >
            {p.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </Row>

      </div>

      {peek ? (
        <Floating anchor={peek.anchor} onClose={closePeek} label={peek.tok.label} vars={vars}>
          <Peek
            tok={peek.tok}
            p={p}
            onClose={closePeek}
            actions={{ setStatus, setDate, toggleTask, addTask, addMilestone, showOnPage, toast, change }}
          />
        </Floating>
      ) : null}

      {menu ? (
        <Floating anchor={menu.anchor} onClose={closeMenu} label={MENU_LABEL[menu.key]} width={menu.key === "date" || menu.key === "place" ? 300 : 240} vars={vars}>
          {menu.key === "status" ? (
            <Menu
              value={p.status}
              items={(Object.keys(STATUS) as Status[]).map((k) => ({ value: k, label: STATUS[k].label, dot: STATUS_DOT[k] }))}
              onPick={(v) => {
                setStatus(v);
                closeMenu();
              }}
            />
          ) : menu.key === "owner" ? (
            <Menu
              value={p.owner}
              items={["orla", "tomas", "dev"].map((id) => ({ value: id, label: id === ME ? `${PEOPLE[id].name} (you)` : PEOPLE[id].name, hint: PEOPLE[id].org }))}
              onPick={(v) => {
                change((x) => ({ ...x, owner: v }), { text: `made ${person(v).name} the owner`, section: "summary" });
                closeMenu();
              }}
            />
          ) : menu.key === "kind" ? (
            <Menu
              value={p.kind}
              items={KINDS.map((k) => ({ value: k.kind, label: k.kind, icon: <ProjectKindIcon kind={k.kind} /> }))}
              onPick={(v) => {
                change((x) => ({ ...x, kind: v }));
                closeMenu();
              }}
            />
          ) : menu.key === "place" ? (
            <TextEditor
              label="Where it happens"
              value={p.place ?? ""}
              placeholder="The Orchard, Long Barn"
              quick={PLACES}
              onSave={(v) => {
                change((x) => ({ ...x, place: v || undefined }), { text: v ? `moved it to ${v}` : "cleared the place", section: "summary" });
                closeMenu();
              }}
            />
          ) : menu.key === "guests" ? (
            <TextEditor
              label="How many guests"
              value={p.guests ? String(p.guests) : ""}
              placeholder="120"
              numeric
              onSave={(v) => {
                const n = parseInt(v.replace(/\D/g, ""), 10);
                const ok = Number.isFinite(n) && n > 0;
                change((x) => ({ ...x, guests: ok ? n : undefined }), {
                  text: ok ? `set the head count to ${n}` : "cleared the head count",
                  section: "summary",
                });
                closeMenu();
              }}
            />
          ) : (
            <DatePicker
              value={p.date}
              onPick={(d) => {
                setDate(d);
                closeMenu();
              }}
            />
          )}
        </Floating>
      ) : null}
    </article>
  );
}

/* ── layout pieces ─────────────────────────────────────────────────── */

/** `lead`: the margin starts at the paragraph's first line, below the small eyebrow. */
function Row({ children, notes, id, lead }: { children: ReactNode; notes?: Activity[]; id?: string; lead?: boolean }) {
  return (
    <section className={pg.row} id={id ? `c5-sec-${id}` : undefined} data-lead={lead ? "" : undefined}>
      <div className={pg.main}>{children}</div>
      <aside className={pg.margin} aria-label="Recent activity">
        {notes && notes.length ? (
          <ul className={pg.marginList}>
            {notes.map((a) => (
              <ActivityItem key={a.id} a={a} />
            ))}
          </ul>
        ) : null}
      </aside>
    </section>
  );
}

function ActivityItem({ a }: { a: Activity }) {
  return (
    <li className={pg.activity} data-new={a.when === "just now" ? "" : undefined}>
      <Avatar id={a.who} size={20} />
      <span className={pg.activityText}>
        <b>{a.who === ME ? "You" : person(a.who).name}</b> {a.text}
        <span className={pg.activityWhen}>{a.when}</span>
      </span>
    </li>
  );
}

/**
 * Where the margin does not fit, a section's recent activity folds into a
 * quiet "2 updates" disclosure beside its heading.
 */
function Updates({ notes, children }: { notes: Activity[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <>
      <div className={pg.headLine}>
        {children}
        {notes.length ? (
          <button type="button" className={pg.updatesBtn} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
            <span className={pg.updatesFaces} aria-hidden="true">
              {[...new Set(notes.map((n) => n.who))].slice(0, 3).map((id) => (
                <span key={id} style={{ background: hueVar(person(id).hue) }} />
              ))}
            </span>
            {notes.length === 1 ? "1 update" : `${notes.length} updates`}
            <ChevronDown size={12} className={pg.updatesChevron} />
          </button>
        ) : null}
      </div>
      {open && notes.length ? (
        <ul id={listId} className={pg.updatesList}>
          {notes.map((a) => (
            <ActivityItem key={a.id} a={a} />
          ))}
        </ul>
      ) : null}
    </>
  );
}

function SectionHead({ title, meta, notes = [] }: { title: string; meta?: string; notes?: Activity[] }) {
  return (
    <div className={pg.sectionHeadWrap}>
      <Updates notes={notes}>
        <div className={pg.sectionHead}>
          <h2 className={pg.sectionTitle}>{title}</h2>
          {meta ? <span className={pg.sectionMeta}>{meta}</span> : null}
        </div>
      </Updates>
    </div>
  );
}

function JumpLink({ icon, label, count, onClick }: { icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" className={pg.jump} onClick={onClick} aria-label={count ? `${label}, ${count}` : label}>
      {icon}
      <span className={pg.jumpLabel}>{label}</span>
      {count ? <span className={pg.jumpCount}>{count}</span> : null}
    </button>
  );
}

const MENU_LABEL: Record<PropKey, string> = {
  status: "Status",
  date: "Date",
  owner: "Owner",
  kind: "Kind",
  place: "Place",
  guests: "Guests",
};

/** One fact in the quiet line under the title. Each opens its own editor. */
function MetaItem({
  label,
  children,
  onOpen,
  readOnly,
  empty,
}: {
  label: string;
  children: ReactNode;
  onOpen: (el: HTMLElement) => void;
  readOnly: boolean;
  empty?: boolean;
}) {
  if (readOnly) {
    return (
      <span className={pg.metaItem} data-static="">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={pg.metaItem}
      data-empty={empty ? "" : undefined}
      title={`Change the ${label.toLowerCase()}`}
      onClick={(e) => onOpen(e.currentTarget)}
    >
      <span className={s.srOnly}>{label}: </span>
      {children}
    </button>
  );
}

function TextEditor({
  label,
  value,
  placeholder,
  quick,
  numeric,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  quick?: string[];
  numeric?: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <form
      className={s.peekBody}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v.trim());
      }}
    >
      <div className={s.peekEyebrow}>{label}</div>
      <input
        className={s.peekInput}
        value={v}
        inputMode={numeric ? "numeric" : undefined}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {quick ? (
        <div className={s.quickRow}>
          {quick.map((q) => (
            <button key={q} type="button" className={s.quick} onClick={() => onSave(q)}>
              {q.replace("The Orchard, ", "")}
            </button>
          ))}
        </div>
      ) : null}
      <div className={s.peekActions}>
        <button type="submit" className={s.primary}>
          Save
        </button>
        <span className={s.muted}>or press Enter</span>
      </div>
    </form>
  );
}

/* ── milestones ────────────────────────────────────────────────────── */

function Milestones({
  p,
  flash,
  readOnly,
  onToggle,
  onAdd,
}: {
  p: Project;
  flash: string | null;
  readOnly: boolean;
  onToggle: (m: Milestone) => void;
  onAdd: (title: string, date: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(p.date ?? "2026-10-15");
  const ms = [...p.milestones].sort((a, b) => a.date.localeCompare(b.date) || Number(Boolean(a.day)) - Number(Boolean(b.day)));
  const next = ms.find((m) => !m.done && !m.review);
  const todayIndex = ms.findIndex((m) => daysFrom(m.date) > 0);

  if (ms.length === 0 && !adding) {
    return (
      <div className={pg.emptyBlock}>
        <p>No milestones yet. Milestones are the dates everything else hangs from.</p>
        {readOnly ? null : (
          <button type="button" className={pg.inlineAdd} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add a milestone
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <ol className={pg.path}>
        {ms.map((m, i) => {
          const state = m.done ? "done" : m.review ? "review" : m === next ? "next" : "later";
          const after = i + 1 < ms.length ? ms[i + 1] : null;
          return (
            <li key={m.id} id={`c5-${m.id}`}>
              {i === todayIndex && todayIndex > 0 && !p.wrapped ? (
                <div className={pg.today} aria-label="Today">
                  <span className={pg.todayDate}>Today</span>
                  <span className={pg.todayLine} />
                </div>
              ) : null}
              <div className={pg.station} data-state={state} data-day={m.day ? "" : undefined} data-flash={flash === m.id ? "" : undefined} data-line={after ? (after.done ? "done" : "open") : undefined}>
                <span className={pg.stationDate}>{fmtShort(m.date)}</span>
                <span className={pg.stationTrack}>
                  <button
                    type="button"
                    className={pg.stationDot}
                    aria-label={`${m.title}: ${m.done ? "done" : "not done"}. ${m.done ? "Mark not done" : "Mark done"}`}
                    aria-pressed={m.done}
                    disabled={readOnly}
                    onClick={() => onToggle(m)}
                  >
                    {m.done ? <Check size={11} strokeWidth={2.2} /> : null}
                  </button>
                </span>
                <span className={pg.stationBody}>
                  <span className={pg.stationTitle}>{m.title}</span>
                  {state === "review" ? <span className={pg.stateChip} data-tone="review">In review</span> : null}
                  {state === "next" ? (
                    <span className={pg.stateChip} data-tone="hue">Next · {spokenWhen(m.date)}</span>
                  ) : null}
                  {m.day && !m.done && p.date ? (
                    <span className={pg.stationSub}>{fmtLong(m.date)}</span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {readOnly ? null : adding ? (
        <form
          className={pg.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            onAdd(title.trim(), date);
            setTitle("");
            setAdding(false);
          }}
        >
          <input autoFocus className={pg.addInput} placeholder="Milestone name" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Milestone name" />
          <input type="date" className={pg.addDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Milestone date" />
          <button type="submit" className={pg.primaryBtn}>Add</button>
          <button type="button" className={pg.ghostBtn} onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className={pg.inlineAdd} onClick={() => setAdding(true)}>
          <Plus size={14} /> Add a milestone
        </button>
      )}
    </>
  );
}

/* ── people ────────────────────────────────────────────────────────── */

function People({ p, readOnly, change }: { p: Project; readOnly: boolean; change: Change }) {
  const [adding, setAdding] = useState<number | null>(null);
  const [name, setName] = useState("");
  const commit = (i: number) => {
    const v = name.trim();
    if (v) {
      change(
        (x) => ({ ...x, roles: x.roles.map((r, j) => (j === i ? { ...r, people: [...r.people, v] } : r)) }),
        { text: `added ${v} as ${p.roles[i].role}`, section: "people" },
      );
    }
    setName("");
    setAdding(null);
  };
  return (
    <div className={pg.people}>
      {p.roles.map((r, i) => (
        <div key={r.role} className={pg.role}>
          <span className={pg.roleName}>{r.role}</span>
          {r.people.length === 0 ? (
            adding === i ? (
              <input
                autoFocus
                className={pg.roleInput}
                placeholder="Name, then Enter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => commit(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(i);
                  if (e.key === "Escape") {
                    setName("");
                    setAdding(null);
                  }
                }}
                aria-label={r.add ?? `Add to ${r.role}`}
              />
            ) : readOnly ? (
              <span className={pg.roleNone}>Nobody</span>
            ) : (
              <button type="button" className={pg.roleAdd} onClick={() => setAdding(i)}>
                <Plus size={14} /> {r.add ?? `Add ${r.role.toLowerCase()}`}
              </button>
            )
          ) : r.people.length > 2 ? (
            <span className={pg.person}>
              <span className={pg.roleFaces}>
                {r.people.map((id) => (
                  <Avatar key={id} id={id} size={22} ring />
                ))}
              </span>
              <span className={pg.personName}>{r.people.map((id) => (id === ME ? "You" : person(id).name)).join(", ")}</span>
            </span>
          ) : (
            r.people.map((id) => (
              <span key={id} className={pg.person}>
                <Avatar id={id} size={22} />
                <span className={pg.personName}>
                  {id === ME ? "Orla" : person(id).name}
                  {id === ME ? <span className={pg.you}>you</span> : null}
                </span>
                {person(id).org && person(id).org !== "The Orchard" ? <span className={pg.personOrg}>{person(id).org}</span> : null}
              </span>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

/* ── date picker ───────────────────────────────────────────────────── */

function DatePicker({ value, onPick }: { value?: string; onPick: (d: string | undefined) => void }) {
  const sats = upcomingSaturdays(3);
  return (
    <div className={s.peekBody}>
      <div className={s.peekEyebrow}>
        <Calendar size={14} /> {value ? "Date" : "Pick a date"}
      </div>
      <div className={s.peekTitle}>{value ? fmtLong(value) : "No date yet"}</div>
      <p className={s.peekText}>
        {value
          ? daysFrom(value) >= 0
            ? `${daysFrom(value)} days from today.`
            : `${-daysFrom(value)} days ago.`
          : "Once it has a date, the page counts down to it and it moves into Coming up."}
      </p>
      <div className={s.quickRow}>
        {sats.map((d) => (
          <button key={d} type="button" className={s.quick} onClick={() => onPick(d)}>
            Sat {fmtShort(d)}
          </button>
        ))}
      </div>
      <label className={s.dateField}>
        <span>Or choose</span>
        <input type="date" defaultValue={value} onChange={(e) => e.target.value && onPick(e.target.value)} />
      </label>
      {value ? (
        <button type="button" className={s.peekLink} onClick={() => onPick(undefined)}>
          Clear the date
        </button>
      ) : null}
    </div>
  );
}

/* ── token peeks: each token opens the thing it names ──────────────── */

type Actions = {
  setStatus: (s: Status) => void;
  setDate: (d: string | undefined) => void;
  toggleTask: (id: string) => void;
  addTask: (title: string) => void;
  addMilestone: (title: string, date: string) => void;
  showOnPage: (id: string) => void;
  toast: (msg: string) => void;
  change: Change;
};

function Peek({ tok, p, onClose, actions }: { tok: Tok; p: Project; onClose: () => void; actions: Actions }) {
  switch (tok.kind) {
    case "when":
    case "nodate":
      return <DatePicker value={p.date} onPick={(d) => { actions.setDate(d); onClose(); }} />;
    case "status":
      return (
        <div className={s.peekBody}>
          <div className={s.peekEyebrow}>
            <StatusIcon size={14} /> Status
          </div>
          <p className={s.peekText}>Say how it is going. The summary rewrites itself.</p>
          <Menu
            value={p.status}
            items={(Object.keys(STATUS) as Status[]).map((k) => ({ value: k, label: STATUS[k].label, dot: STATUS_DOT[k] }))}
            onPick={(v) => {
              actions.setStatus(v);
              onClose();
            }}
          />
        </div>
      );
    case "count":
      return <TasksPeek p={p} onlyLate={tok.ref === "late"} actions={actions} />;
    case "task": {
      const task = p.tasks.find((t) => t.id === tok.ref);
      return task ? <TaskPeek task={task} actions={actions} onClose={onClose} /> : null;
    }
    case "person":
      return tok.ref === "people" ? <PeoplePeek p={p} /> : <PersonPeek id={tok.ref as string} p={p} actions={actions} />;
    case "milestone": {
      const m = p.milestones.find((x) => x.id === tok.ref);
      if (!m) return null;
      return (
        <div className={s.peekBody}>
          <div className={s.peekEyebrow}>
            <TimelineIcon size={14} /> Milestone
          </div>
          <div className={s.peekTitle}>{m.title}</div>
          <p className={s.peekText}>
            {fmtLong(m.date)}, {spokenWhen(m.date).replace(/^on /, "")}.
          </p>
          <div className={s.peekActions}>
            <button type="button" className={s.primary} onClick={() => { actions.showOnPage(m.id); onClose(); }}>
              Show on the page <Arrow size={14} />
            </button>
          </div>
        </div>
      );
    }
    case "add-task":
      return <AddPeek label="What needs doing first?" placeholder="Book a tasting, send the contract…" onAdd={(v) => { actions.addTask(v); onClose(); }} />;
    case "add-milestone":
      return (
        <AddPeek
          label="Name the first milestone"
          placeholder="Menu signed off"
          withDate
          onAdd={(v, d) => {
            actions.addMilestone(v, d ?? "2026-10-30");
            onClose();
          }}
        />
      );
    case "wrapped":
      return (
        <div className={s.peekBody}>
          <div className={s.peekEyebrow}>
            <Check size={14} /> Wrapped
          </div>
          <div className={s.peekTitle}>Finished {fmtLong(p.wrapped!.on)}</div>
          <p className={s.peekText}>
            {p.wrapped!.early > 0
              ? `The last task closed ${p.wrapped!.early} days before the date. Nothing was left open.`
              : "The last task closed on the day. Nothing was left open."}
          </p>
        </div>
      );
    default:
      return null;
  }
}

function TasksPeek({ p, onlyLate, actions }: { p: Project; onlyLate: boolean; actions: Actions }) {
  const f = factsOf(p);
  const list = onlyLate
    ? p.tasks.filter((t) => f.late.some((l) => l.id === t.id))
    : [...p.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  return (
    <div className={s.peekBody}>
      <div className={s.peekEyebrow}>
        <TasksIcon size={14} /> {onlyLate ? "Late tasks" : `${f.done} of ${f.total} done`}
      </div>
      {!onlyLate && f.total > 0 ? (
        <div className={s.peekBar}>
          <span style={{ width: `${f.progress * 100}%` }} />
        </div>
      ) : null}
      <ul className={s.taskList}>
        {list.map((t) => (
          <li key={t.id}>
            <label className={s.taskRow} data-done={t.done ? "" : undefined}>
              <input type="checkbox" checked={t.done} onChange={() => actions.toggleTask(t.id)} disabled={Boolean(p.wrapped)} />
              <span className={s.taskTitle}>{t.title}</span>
              {t.due ? (
                <span className={s.taskDue} data-late={!t.done && daysFrom(t.due) < 0 ? "" : undefined}>
                  {fmtShort(t.due)}
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
      {p.doneExtra ? <p className={s.peekFoot}>And {p.doneExtra} earlier tasks, all done.</p> : null}
    </div>
  );
}

function TaskPeek({ task, actions, onClose }: { task: Task; actions: Actions; onClose: () => void }) {
  const late = task.due && !task.done && daysFrom(task.due) < 0 ? -daysFrom(task.due) : 0;
  const waitingOnMe = task.waitingOn === ME;
  return (
    <div className={s.peekBody}>
      <div className={s.peekEyebrow}>
        <TasksIcon size={14} /> Task
        {late ? <span className={s.peekChip} data-tone="danger">{late} days late</span> : null}
        {waitingOnMe ? <span className={s.peekChip} data-tone="review">Waiting on you</span> : null}
      </div>
      <div className={s.peekTitle}>{task.title}</div>
      <dl className={s.peekFacts}>
        <dt>With</dt>
        <dd>
          <Avatar id={task.who} size={18} /> {task.who === ME ? "You" : person(task.who).name}
          {person(task.who).org ? <span className={s.muted}> · {person(task.who).org}</span> : null}
        </dd>
        {task.due ? (
          <>
            <dt>Due</dt>
            <dd>{fmtLong(task.due)}</dd>
          </>
        ) : null}
        {task.waitingOn && !waitingOnMe ? (
          <>
            <dt>Waiting on</dt>
            <dd>{person(task.waitingOn).name}</dd>
          </>
        ) : null}
      </dl>
      <div className={s.peekActions}>
        <button
          type="button"
          className={s.primary}
          onClick={() => {
            actions.toggleTask(task.id);
            onClose();
          }}
        >
          <Check size={14} /> {task.done ? "Reopen" : waitingOnMe ? "Approve" : "Mark done"}
        </button>
        {late && task.who !== ME ? (
          <button
            type="button"
            className={s.secondary}
            onClick={() => {
              actions.toast(`Nudged ${person(task.who).name} in Messages.`);
              actions.change((x) => x, { text: `nudged ${person(task.who).name} about ${phraseOf(task)}`, section: "summary" });
              onClose();
            }}
          >
            Nudge {person(task.who).name}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PersonPeek({ id, p, actions }: { id: string; p: Project; actions: Actions }) {
  const who = person(id);
  const roles = p.roles.filter((r) => r.people.includes(id)).map((r) => r.role);
  const open = p.tasks.filter((t) => !t.done && (t.who === id || t.waitingOn === id));
  return (
    <div className={s.peekBody}>
      <div className={s.personHead}>
        <Avatar id={id} size={40} />
        <div>
          <div className={s.peekTitle}>{id === ME ? "You" : who.name}</div>
          <div className={s.muted}>
            {[roles.join(", "), who.org].filter(Boolean).join(" · ") || "On this project"}
          </div>
        </div>
      </div>
      {open.length ? (
        <>
          <div className={s.peekLabel}>{id === ME ? "Waiting on you here" : `Open with ${who.name}`}</div>
          <ul className={s.miniTasks}>
            {open.map((t) => (
              <li key={t.id}>
                <span className={s.miniDot} data-late={t.due && daysFrom(t.due) < 0 ? "" : undefined} />
                {t.title}
                {t.due ? <span className={s.muted}> · {fmtShort(t.due)}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {id === ME ? null : (
        <div className={s.peekActions}>
          <button type="button" className={s.secondary} onClick={() => actions.toast(`Opens a message to ${who.name}.`)}>
            <Message size={14} /> Message {who.name}
          </button>
        </div>
      )}
    </div>
  );
}

function PeoplePeek({ p }: { p: Project }) {
  const ids = [...new Set(p.roles.flatMap((r) => r.people))];
  return (
    <div className={s.peekBody}>
      <div className={s.peekEyebrow}>
        <Users size={14} /> Who did the work
      </div>
      <ul className={s.miniTasks}>
        {ids.map((id) => (
          <li key={id}>
            <Avatar id={id} size={18} /> {person(id).name}
            <span className={s.muted}> · {p.roles.find((r) => r.people.includes(id))?.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddPeek({
  label,
  placeholder,
  onAdd,
  withDate,
}: {
  label: string;
  placeholder: string;
  onAdd: (v: string, d?: string) => void;
  withDate?: boolean;
}) {
  const [v, setV] = useState("");
  const [d, setD] = useState("2026-10-30");
  return (
    <form
      className={s.peekBody}
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim(), d);
      }}
    >
      <div className={s.peekEyebrow}>
        <Plus size={14} /> {label}
      </div>
      <input className={s.peekInput} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={label} />
      {withDate ? (
        <label className={s.dateField}>
          <span>Date</span>
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
        </label>
      ) : null}
      <div className={s.peekActions}>
        <button type="submit" className={s.primary} disabled={!v.trim()}>
          Add
        </button>
        <span className={s.muted}>or press Enter</span>
      </div>
    </form>
  );
}
