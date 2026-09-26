"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import {
  KINDS,
  ME,
  PLACES,
  ROLE_TEMPLATES,
  TEMPLATES,
  addDays,
  daysFrom,
  fmtDate,
  fmtShort,
  toIso,
  upcomingSaturdays,
  weekday,
  type Project,
} from "./data";
import { projectSentences } from "./summary";
import { LivingText } from "./LivingText";
import { Avatar, Glyph, hueStyle, hueVar } from "./bits";
import { Plus, ProjectKindIcon } from "./icons";
import cr from "./create.module.css";
import pg from "./page.module.css";

type Suggestion = { value: string; label: string; hint?: string; icon?: ReactNode; hue?: number };

const WHO: Record<string, string[]> = {
  Wedding: ["Nina & Theo", "Saoirse & Ben", "Hannah & Kofi"],
  Birthday: ["Gráinne Walsh", "Rory Byrne"],
  "Corporate day": ["Tidewell Labs", "Brightwater", "Nordlys Design"],
  "Supper club": ["The winter", "The spring"],
  Festival: ["Apple blossom", "Midsummer"],
  Class: ["Pruning", "Cider making"],
  Launch: ["Tidewell Labs", "Orchard gin"],
  Maintenance: ["The Press House", "The car park"],
};

const ROLE_ADD: Record<string, string> = {
  Couple: "Add the couple",
  Kitchen: "Add a chef",
  Flowers: "Add a florist",
  Photography: "Add a photographer",
  Music: "Add musicians",
  Host: "Add the host",
  Client: "Add the client",
  AV: "Add AV",
  Wine: "Add a wine supplier",
  "Front of house": "Add front of house",
  Stallholders: "Add stallholders",
  Safety: "Add first aid cover",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function parseTyped(text: string): string | undefined {
  const m = text.toLowerCase().match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s*)?([a-z]{3})/);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return undefined;
  let iso = toIso(new Date(Date.UTC(2026, month, Number(m[1]))));
  if (daysFrom(iso) < 0) iso = toIso(new Date(Date.UTC(2027, month, Number(m[1]))));
  return iso;
}

/* ── reading the sentence ──────────────────────────────────────────── */

type Field = "kind" | "who" | "where" | "date";
const ORDER: Field[] = ["kind", "who", "where", "date"];
const JOINS: Record<string, Field> = { for: "who", at: "where", on: "date" };

/**
 * People type or paste the whole sentence into the first blank. Split it at
 * the sentence's own joining words (for, at, on) and hand each part to its
 * blank. Only joins that point forward count, so "Pat at the Press House"
 * typed into the who blank moves the place along, but a join that points
 * back stays part of the words.
 */
function splitSentence(field: Field, text: string): Partial<Record<Field, string>> | null {
  const from = ORDER.indexOf(field);
  const t = field === "kind" ? text.replace(/^\s*i[’']?m planning\s+/i, "") : text;
  const re = /\s+(for|at|on)(?:\s+|$)/gi;
  const parts: Partial<Record<Field, string>> = {};
  let current: Field = field;
  let last = 0;
  let split = false;
  for (const m of t.matchAll(re)) {
    const target = JOINS[m[1].toLowerCase()];
    if (ORDER.indexOf(target) <= ORDER.indexOf(current)) continue;
    // "wedding for" with nothing after yet only splits once the space is typed.
    if (m.index + m[0].length === t.length && !/\s$/.test(m[0])) continue;
    parts[current] = t.slice(last, m.index);
    current = target;
    last = m.index + m[0].length;
    split = true;
  }
  if (!split && t === text) return null;
  parts[current] = t.slice(last);
  if (ORDER.indexOf(current) < from) return null;
  return parts;
}

/** A kind from the list, however it was typed: "Wedding", "a wedding", "wedding". */
function listKind(text: string) {
  const t = text.trim().toLowerCase().replace(/^(a|an|some)\s+/, "");
  return KINDS.find((k) => k.kind.toLowerCase() === t);
}

/** Up to four words of the person's own, kept in their own case. */
function freeKind(text: string): { kind: string; tooLong: boolean } {
  const t = text.trim().replace(/^(a|an|some)(\s+|$)/i, "").trim();
  if (!t) return { kind: "", tooLong: false };
  const words = t.split(/\s+/).length;
  if (words > 4) return { kind: "", tooLong: true };
  return { kind: t, tooLong: false };
}

/** The name the page gets. The person's words keep their case. */
function titleFor(kind: string, who: string, fromList: boolean): string {
  const w = who.trim();
  const noun = fromList ? kind.toLowerCase() : kind;
  if (!w) return `New ${noun}`;
  if (kind === "Corporate day") return `${w} team day`;
  if (kind === "Supper club") return `${w} supper club`;
  if (kind === "Festival") return `${w} festival`;
  if (kind === "Maintenance") return `${w} maintenance`;
  return `${w}’s ${noun}`;
}

type Shape = {
  draft: Project;
  template: { title: string; before: number; day?: boolean }[];
  skipped: number;
};

/** What the page will look like, from whatever the sentence says so far. */
function shape(kindText: string, who: string, where: string, date: string | undefined): Shape {
  const kindMatch = listKind(kindText);
  const free = freeKind(kindText);
  const kind = kindMatch?.kind ?? free.kind;
  const template = TEMPLATES[kindMatch?.kind ?? ""] ?? [];
  const milestones = date
    ? template
        .map((m, i) => ({ id: `d${i}`, title: m.title, date: addDays(date, -m.before), done: false, day: m.day }))
        .filter((m) => daysFrom(m.date) >= 0)
    : [];
  const roles = ROLE_TEMPLATES[kindMatch?.kind ?? ""] ?? ["Team"];
  return {
    template,
    skipped: date ? template.length - milestones.length : 0,
    draft: {
      id: "draft",
      name: kind ? titleFor(kind, who, Boolean(kindMatch)) : "Untitled project",
      purpose: "",
      hue: kindMatch?.hue ?? 1,
      kind: kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Project",
      status: "on-track",
      date,
      owner: ME,
      place: where.trim() || undefined,
      tasks: [],
      milestones,
      roles: [
        { role: "Venue", people: [ME] },
        ...roles.map((r) => ({ role: r, people: [], add: ROLE_ADD[r] ?? `Add ${r.toLowerCase()}` })),
      ],
      links: [],
      notes: [],
      activity: [{ id: "created", who: ME, text: "created this project", when: "just now", section: "summary" }],
      fresh: true,
      edited: "just now",
    },
  };
}

export function Creator({ onCreate, onCancel }: { onCreate: (p: Project) => void; onCancel: () => void }) {
  const [kindText, setKindText] = useState("");
  const [who, setWho] = useState("");
  const [where, setWhere] = useState("");
  const [dateText, setDateText] = useState("");
  const [date, setDate] = useState<string | undefined>(undefined);
  const kindRef = useRef<HTMLInputElement>(null);
  const whoRef = useRef<HTMLInputElement>(null);
  const whereRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  const saturdays = upcomingSaturdays(4);
  const real = shape(kindText, who, where, date);
  const draft = real.draft;
  const kind = draft.name !== "Untitled project" ? draft.kind : "";
  const hue = draft.hue;
  const kindOn = Boolean(listKind(kindText));
  const tooLong = freeKind(kindText).tooLong && !kindOn;
  const values: Record<Field, string> = { kind: kindText, who, where, date: dateText };

  const setDateFrom = (v: string) => {
    setDateText(v);
    setDate(parseTyped(v));
  };
  const setters: Record<Field, (v: string) => void> = {
    kind: (v) => setKindText(v),
    who: setWho,
    where: setWhere,
    date: setDateFrom,
  };

  /** Every blank reads what was typed or pasted, and passes along what belongs further on. */
  const typeInto = (field: Field, text: string) => {
    const parts = splitSentence(field, text);
    if (!parts) {
      setters[field](text);
      return;
    }
    const merged = { ...values };
    let lastField: Field = field;
    for (const f of ORDER) {
      const v = parts[f];
      if (v === undefined) continue;
      const clean = f === "kind" ? (listKind(v)?.article ?? v.trim()) : f === field ? v : v.trim();
      merged[f] = clean;
      setters[f](clean);
      lastField = f;
    }
    // Carry on typing where the sentence left off, or at the first blank still empty.
    const after = ORDER.slice(ORDER.indexOf(field) + 1);
    const target = parts[lastField] === "" ? lastField : after.find((f) => !merged[f].trim());
    const el =
      target === "kind"
        ? kindRef.current
        : target === "who"
          ? whoRef.current
          : target === "where"
            ? whereRef.current
            : target === "date"
              ? dateRef.current
              : createRef.current;
    el?.focus();
  };
  // Before the first blank is filled, the preview shows a faint example page
  // worked back from a placeholder date, so the promise is visible at once.
  const ghost = !kind;
  const shown = ghost ? shape("a wedding", "Nina & Theo", "The Orchard, Long Barn", saturdays[3]) : real;
  const sd = shown.draft;
  const template = shown.template;

  const ready = Boolean(kind && who.trim() && !tooLong);
  const create = () => {
    if (!ready) {
      (kind ? whoRef : kindRef).current?.focus();
      return;
    }
    onCreate(draft);
  };

  return (
    <article
      className={cr.page}
      style={hueStyle({ hue })}
      data-kind={kindOn ? "" : undefined}
      aria-label="New project"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create();
        if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) onCancel();
      }}
    >
      <div className={cr.cover} data-on={kindOn ? "" : undefined} data-kind={draft.kind} />
      <div className={cr.inner}>
        <div className={cr.head}>
          <h1 className={cr.eyebrow}>New project</h1>
          <button type="button" className={cr.cancel} onClick={onCancel}>
            Cancel
          </button>
        </div>

        <p className={cr.sentence}>
          I’m planning{" "}
          <Blank
            autoFocus
            inputRef={kindRef}
            value={kindText}
            placeholder="a wedding"
            label="What you are planning"
            onChange={(v) => typeInto("kind", v)}
            suggestions={KINDS.map((k) => ({ value: k.article, label: k.article, icon: <ProjectKindIcon kind={k.kind} />, hue: k.hue }))}
            next={whoRef}
          />{" "}
          for{" "}
          <Blank
            inputRef={whoRef}
            value={who}
            placeholder="who"
            label="Who it is for"
            onChange={(v) => typeInto("who", v)}
            suggestions={(WHO[kindOn ? draft.kind : ""] ?? ["Nina & Theo", "Tidewell Labs"]).map((w) => ({ value: w, label: w }))}
            next={whereRef}
          />{" "}
          at{" "}
          <Blank
            inputRef={whereRef}
            value={where}
            placeholder="where"
            label="Where it happens"
            onChange={(v) => typeInto("where", v)}
            suggestions={PLACES.map((p) => ({ value: p, label: p }))}
            next={dateRef}
          />{" "}
          on{" "}
          <Blank
            inputRef={dateRef}
            value={dateText}
            placeholder="a date"
            label="The date"
            onChange={(v) => typeInto("date", v)}
            onPick={(v) => {
              if (v === "none") {
                setDateText("no date yet");
                setDate(undefined);
              } else {
                setDateText(`${weekday(v)} ${fmtShort(v)}`);
                setDate(v);
              }
            }}
            suggestions={[
              ...saturdays.map((d) => ({ value: d, label: `Saturday ${fmtShort(d)}`, hint: `in ${daysFrom(d)} days` })),
              { value: "none", label: "No date yet", hint: "add it later" },
            ]}
            onDone={create}
            next={createRef}
          />
          .
        </p>

        <div className={cr.previewLabel}>
          <span>{kind ? "The page it will make" : "An example of the page it makes. Fill the first blank to start yours."}</span>
        </div>

        <div className={cr.preview} data-ghost={ghost ? "" : undefined} style={hueStyle(sd)} aria-hidden={ghost ? true : undefined}>
          <div className={cr.previewCover} data-kind={sd.kind} />
          <div className={cr.previewInner}>
            <div className={cr.previewGlyph} key={`g-${sd.hue}-${ghost}`}>
              <Glyph p={sd} size={56} />
            </div>
            <div className={cr.previewTitle}>{sd.name}</div>

            <p className={`${pg.meta} ${cr.previewMeta}`}>
              <MetaBit value={sd.date ? fmtDate(sd.date) : undefined} empty="Add a date" />
              <MetaBit value={sd.place} empty="Add a place" />
              <MetaBit value={sd.kind} />
              <span className={pg.metaItem} data-static="">
                <Avatar id={ME} size={16} />
                Orla
              </span>
            </p>

            <div className={cr.block} key={`summary-${ghost}-${sd.date ? "d" : "n"}`}>
              <div className={pg.summaryHead}>
                <span className={pg.liveDot} aria-hidden="true" />
                <span>Written from the work</span>
              </div>
              <LivingText sentences={projectSentences(sd)} size="compact" interactive={false} />
            </div>

            {template.length ? (
              <div className={cr.block} key={`ms-${sd.kind}-${sd.date ?? ""}-${ghost}`}>
                <div className={cr.blockHead}>
                  Suggested milestones
                  <span className={cr.blockMeta}>
                    {sd.date ? (shown.skipped ? `${shown.skipped} already passed, left out` : "worked back from the date") : "time before the day, until it has a date"}
                  </span>
                </div>
                <ol className={cr.miniPath}>
                  {(sd.date ? sd.milestones : template.map((m, i) => ({ id: `t${i}`, title: m.title, date: "", day: m.day, before: m.before }))).map((m, i) => (
                    <li key={m.id} className={cr.miniStation} data-day={m.day ? "" : undefined} style={{ "--i": i } as CSSProperties}>
                      <span className={cr.miniDate} data-ghost={m.date ? undefined : ""}>
                        {m.date ? fmtShort(m.date) : "before" in m ? beforeLabel(m.before) : ""}
                      </span>
                      <span className={cr.miniDot} />
                      <span>{m.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className={cr.block} key={`roles-${sd.kind}-${ghost}`}>
              <div className={cr.blockHead}>People</div>
              <div className={`${pg.people} ${cr.people}`}>
                {sd.roles.map((r, i) => (
                  <div key={r.role} className={`${pg.role} ${cr.roleIn}`} style={{ "--i": i } as CSSProperties}>
                    <span className={pg.roleName}>{r.role}</span>
                    {r.people.length ? (
                      <span className={pg.person}>
                        <Avatar id={ME} size={22} />
                        <span className={pg.personName}>
                          Orla<span className={pg.you}>you</span>
                        </span>
                      </span>
                    ) : (
                      <span className={pg.roleAdd}>
                        <Plus size={14} /> {r.add}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={cr.bar}>
          <span className={cr.barNote}>
            {ready ? (
              <>
                Creates <b>{draft.name}</b>
                {date ? `, ${daysFrom(date)} days out` : ", with no date yet"}.
              </>
            ) : tooLong ? (
              "Keep the first blank to a few words, like “a wedding”."
            ) : kind ? (
              "Say who it is for to name it."
            ) : (
              "Start with what you are planning."
            )}
          </span>
          <span className={cr.barEnd}>
            <span className={cr.hint}>
              <kbd className={cr.kbd}>Tab</kbd> next blank <span aria-hidden="true">·</span> <kbd className={cr.kbd}>Ctrl</kbd> <kbd className={cr.kbd}>Enter</kbd> create
            </span>
            <button ref={createRef} type="button" className={cr.create} onClick={create} aria-disabled={!ready}>
              Create project
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

/** One fact in the preview's meta line: the words as they will read, or a quiet gap. */
function MetaBit({ value, empty }: { value?: string; empty?: string }) {
  if (!value && !empty) return null;
  return (
    <span key={value ?? "empty"} className={`${pg.metaItem} ${value ? cr.metaSet : ""}`} data-static="" data-empty={value ? undefined : ""}>
      {value ?? empty}
    </span>
  );
}

function Blank({
  value,
  placeholder,
  label,
  onChange,
  onPick,
  suggestions,
  inputRef,
  next,
  onDone,
  autoFocus,
}: {
  autoFocus?: boolean;
  value: string;
  placeholder: string;
  label: string;
  onChange: (v: string) => void;
  onPick?: (v: string) => void;
  suggestions: Suggestion[];
  inputRef: RefObject<HTMLInputElement | null>;
  next?: RefObject<HTMLElement | null>;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = useId();
  const q = value.trim().toLowerCase();
  const exact = suggestions.some((sg) => sg.label.toLowerCase() === q);
  const list = exact || !q ? suggestions : suggestions.filter((sg) => sg.label.toLowerCase().includes(q));

  const pick = (sg: Suggestion) => {
    if (onPick) onPick(sg.value);
    else onChange(sg.value);
    setOpen(false);
    if (next?.current) next.current.focus();
    else inputRef.current?.blur();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (open && list[hi] && !exact) pick(list[hi]);
      else if (onDone) {
        setOpen(false);
        onDone();
      } else if (next?.current) {
        setOpen(false);
        next.current.focus();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <span className={cr.blank} data-filled={value ? "" : undefined}>
      <span className={cr.mirror} aria-hidden="true">
        {value || placeholder}
      </span>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className={cr.blankInput}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        role="combobox"
        onFocus={() => {
          setOpen(true);
          setHi(0);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={onKey}
      />
      {open && list.length > 0 ? (
        <span id={listId} className={cr.suggest} role="listbox" aria-label={`${label} suggestions`}>
          {list.map((sg, i) => (
            <span
              key={sg.value}
              role="option"
              aria-selected={i === hi}
              className={cr.suggestItem}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(sg);
              }}
              onMouseEnter={() => setHi(i)}
            >
              {sg.icon ? (
                <span className={cr.suggestIcon} style={sg.hue ? ({ "--hue": hueVar(sg.hue) } as CSSProperties) : undefined}>
                  {sg.icon}
                </span>
              ) : null}
              <span>{sg.label}</span>
              {sg.hint ? <span className={cr.suggestHint}>{sg.hint}</span> : null}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** How far ahead of the day a suggested milestone sits, before there is a date to count from. */
function beforeLabel(days: number | undefined): string {
  if (!days) return "";
  if (days >= 56) return `${Math.round(days / 30)} mo`;
  if (days >= 14) return `${Math.round(days / 7)} wk`;
  return days === 1 ? "1 day" : `${days} days`;
}
