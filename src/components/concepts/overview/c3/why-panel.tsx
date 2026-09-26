"use client";

import { CAPACITY, DIMENSIONS, LAST_WEEK, PEOPLE, type Fact, type Remedy, type Row, type Tone } from "./data";
import { FactIcon, Icon, RemedyIcon, ToneGlyph } from "./icons";
import { TONE_LABEL, describeMove, leadDiagnosis, level, remedyById, word, type Selection, type ViewCell } from "./model";
import s from "./atlas.module.css";

const toneAttr = (t: Tone | "good") => (t === "early" ? "early" : String(t));

const HREF: Partial<Record<Fact["kind"], string>> = {
  task: "/app/tasks",
  decision: "/app/tasks",
  file: "/app/files",
  message: "/app/messages",
};

const PERSON_REMEDIES: Record<string, string[]> = {
  aoife: ["rebalance-aoife", "push-aoife"],
  tomas: ["ask-tomas"],
  dara: ["decide-seating", "decide-lunch"],
  niamh: ["text-parents"],
  priya: [],
};

type PanelProps = {
  selection: Selection;
  rows: Row[];
  view: ViewCell[][];
  related: Set<string>;
  relatedVia: Map<string, string>;
  applied: string[];
  preview: string | null;
  compare: boolean;
  loads: Record<string, [number, number, number]>;
  onClose: () => void;
  onSelectKey: (key: string) => void;
  onSelectPerson: (id: string) => void;
  onPreview: (id: string | null) => void;
  onApply: (id: string) => void;
  onUndo: (id: string) => void;
};

export function WhyPanel(props: PanelProps) {
  const { selection } = props;
  const open = Boolean(selection);
  return (
    <>
      <div className={s.scrim} data-open={open || undefined} onClick={props.onClose} aria-hidden="true" />
      <aside className={s.panel} data-open={open || undefined} aria-label="Why">
        <span className={s.grabber} aria-hidden="true" />
        {selection?.kind === "cell" ? (
          <CellWhy key={selection.key} {...props} cellKey={selection.key} />
        ) : selection?.kind === "person" ? (
          <PersonWhy key={selection.id} {...props} personId={selection.id} />
        ) : props.compare ? (
          <Changes rows={props.rows} view={props.view} onSelectKey={props.onSelectKey} />
        ) : (
          <div className={s.panelInner}>
            <LeadDiagnosis {...props} />
          </div>
        )}
      </aside>
    </>
  );
}

function findCell(view: ViewCell[][], rows: Row[], key: string) {
  for (let r = 0; r < view.length; r++) {
    const cell = view[r].find((c) => c.key === key);
    if (cell) return { cell, row: rows[r] };
  }
  return null;
}

/**
 * The panel headline: the first sentence only, its lead clause in bold.
 * Anything after the first sentence becomes body text, so the headline stays at three lines or fewer.
 */
function Headline({ text }: { text: string }) {
  const end = text.search(/\.\s/);
  let first = end >= 0 ? text.slice(0, end + 1) : text;
  let rest = end >= 0 ? text.slice(end + 2) : "";
  // A long first sentence gives up its trailing ", and ..." clause to the body.
  const and = first.lastIndexOf(", and ");
  if (first.length > 90 && and > 40) {
    const tail = first.slice(and + 6);
    rest = `${tail.charAt(0).toUpperCase()}${tail.slice(1)}${rest ? ` ${rest}` : ""}`;
    first = `${first.slice(0, and)}.`;
  }
  const comma = first.indexOf(",");
  const lead = comma > 12 ? first.slice(0, comma) : first;
  const tail = comma > 12 ? first.slice(comma) : "";
  return (
    <>
      <h2 key={text} className={s.whyTitle}>
        <span className={s.whyLead}>{lead}</span>
        {tail}
      </h2>
      {rest ? <p className={s.whyMore}>{rest}</p> : null}
    </>
  );
}

function CellWhy(props: PanelProps & { cellKey: string }) {
  const found = findCell(props.view, props.rows, props.cellKey);
  if (!found) return null;
  const { cell, row } = found;
  const dim = DIMENSIONS.find((d) => d.id === cell.dim)!;
  const now = cell.now;
  const last = cell.base.last;
  // After a remedy, compare with the moment before the change, not with last week.
  const before = cell.changed ? { tone: cell.base.tone, label: cell.base.label } : last;
  const move = describeMove(before, now);
  const relatedCells = props.view.flat().filter((c) => props.related.has(c.key));
  const sentence = now.why ?? cell.base.why;

  return (
    <div className={s.panelInner}>
      <div className={s.panelTop}>
        <span className={s.crumb}>
          <span className={s.tileSm} style={{ background: row.color }} aria-hidden="true">
            {row.initials}
          </span>
          <span className={s.crumbText}>
            {row.name}
            <span className={s.crumbSep} aria-hidden="true">
              /
            </span>
            <strong>{dim.name}</strong>
          </span>
        </span>
        <button type="button" className={s.iconBtn} onClick={props.onClose} aria-label="Close why panel (Esc)">
          <Icon.close size={14} />
        </button>
      </div>

      <div className={s.pillRow}>
        <span className={s.pill} data-tone={toneAttr(now.tone)}>
          <span className={s.pillDot} aria-hidden="true" />
          {TONE_LABEL(now.tone)}
          <span className={s.pillSep} aria-hidden="true">
            ·
          </span>
          {now.label}
        </span>
        {cell.changed ? <span className={s.updated}>Updated just now</span> : null}
      </div>

      <Headline text={sentence} />

      {relatedCells.length ? (
        <section className={s.sameSection} aria-labelledby="c3-same">
          <h3 id="c3-same" className={s.sameTitle}>
            <Icon.link size={13} />
            Same cause elsewhere
          </h3>
          <RelatedList cells={relatedCells} rows={props.rows} via={props.relatedVia} onSelectKey={props.onSelectKey} />
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="c3-evidence">
        <h3 id="c3-evidence" className={s.sectionTitle}>
          Evidence
        </h3>
        <ul className={s.facts}>
          {cell.base.facts.map((fact, i) => {
            const o = now.facts?.[i];
            return (
              <li key={i}>
                <EvidenceRow
                  fact={o ? { ...fact, meta: o.meta ?? fact.meta, status: o.status ?? fact.status, tone: o.tone ?? fact.tone } : fact}
                  was={o?.status && o.status !== fact.status ? fact.status : undefined}
                  onPerson={props.onSelectPerson}
                />
              </li>
            );
          })}
        </ul>
        <details className={s.judged}>
          <summary className={s.judgedSummary}>How {dim.name.toLowerCase()} is judged</summary>
          <p className={s.judgedText}>{dim.judged}</p>
        </details>
      </section>

      {cell.trend ? (
        <section className={s.section} aria-labelledby="c3-trend">
          <h3 id="c3-trend" className={s.sectionTitle}>
            Last 14 days
          </h3>
          <div className={s.trendBox} data-tone={toneAttr(now.tone)}>
            <TrendChart values={cell.trend} />
            <div className={s.trendCompare}>
              <span className={s.trendSide}>
                <span className={s.trendWhen}>{cell.changed ? "Before this change" : "Last week"}</span>
                <span className={s.trendVal} data-tone={toneAttr(before.tone)}>
                  {before.label}
                </span>
              </span>
              <Icon.arrow size={14} className={s.trendArrow} />
              <span className={s.trendSide}>
                <span className={s.trendWhen}>{cell.changed ? "Now" : "Today"}</span>
                <span className={s.trendVal} data-tone={toneAttr(now.tone)}>
                  {now.label}
                </span>
              </span>
              <span className={s.trendMoved} data-moved={move.dir}>
                {move.dir === 0 ? move.text : `${move.text}, now ${TONE_LABEL(now.tone).toLowerCase()}`}
              </span>
            </div>
            {cell.changed ? (
              <p className={s.trendFoot}>
                Last week it was {last.label}, {TONE_LABEL(last.tone).toLowerCase()}.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="c3-help">
        <h3 id="c3-help" className={s.sectionTitle}>
          What would help
        </h3>
        {cell.base.remedies.length ? (
          <div className={s.remedies}>
            {cell.base.remedies.map((r) => (
              <RemedyButton key={r.id} remedy={r} {...props} />
            ))}
          </div>
        ) : (
          <p className={s.quietNote}>
            {level(now.tone) === 0 && now.tone !== "early"
              ? "Nothing to do here. This cell changes colour the moment something slips."
              : now.tone === "early"
                ? "Give it a week. The atlas starts judging once there is enough to go on."
                : "Nothing needs doing yet. Keep an eye on it."}
          </p>
        )}
      </section>
    </div>
  );
}

function RelatedList({ cells, rows, via, onSelectKey }: { cells: ViewCell[]; rows: Row[]; via?: Map<string, string>; onSelectKey: (key: string) => void }) {
  const mixed = new Set(cells.map((c) => via?.get(c.key)).filter(Boolean)).size > 1;
  return (
    <ul className={s.relatedList}>
      {cells.map((rc) => {
        const rrow = rows.find((x) => x.id === rc.rowId)!;
        const rdim = DIMENSIONS.find((d) => d.id === rc.dim)!;
        const cause = via?.get(rc.key);
        return (
          <li key={rc.key}>
            <button type="button" className={s.relatedItem} onClick={() => onSelectKey(rc.key)}>
              <span className={s.tileSm} style={{ background: rrow.color }} aria-hidden="true">
                {rrow.initials}
              </span>
              <span className={s.relatedText}>
                <span className={s.relatedName}>{rrow.name}</span>
                <span className={s.relatedMeta}>
                  <ToneGlyph tone={rc.now.tone} className={s.glyph} />
                  <span className={s.relatedDim}>{rdim.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className={s.relatedVal}>{rc.now.label}</span>
                  {cause && mixed ? <span className={s.relatedVia}> · {cause}</span> : null}
                </span>
              </span>
              <Icon.arrow size={14} className={s.relatedArrow} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PersonWhy(props: PanelProps & { personId: string }) {
  const person = PEOPLE.find((p) => p.id === props.personId)!;
  const load = props.loads[person.id];
  const total = load[0] + load[1] + load[2];
  const pct = Math.round((total / CAPACITY) * 100);
  const tone: Tone = pct > 120 ? 3 : pct > 100 ? 2 : pct > 85 ? 1 : 0;
  const relatedCells = props.view.flat().filter((c) => props.related.has(c.key));
  const name = person.isYou ? "You" : person.name;
  const sentence =
    pct > 100
      ? `${name} ${person.isYou ? "hold" : "holds"} ${total} open tasks, ${load[0]} due this week, against room for about ${CAPACITY}.`
      : `${name} ${person.isYou ? "have" : "has"} ${total} open tasks and room for ${CAPACITY - total} more.`;
  const remedies = (PERSON_REMEDIES[person.id] ?? []).map(remedyById).filter(Boolean) as Remedy[];

  return (
    <div className={s.panelInner}>
      <div className={s.panelTop}>
        <span className={s.crumb}>
          <span className={s.avatar} style={{ background: person.hue }} aria-hidden="true">
            {person.initials}
          </span>
          <span className={s.crumbText}>
            People
            <span className={s.crumbSep} aria-hidden="true">
              /
            </span>
            <strong>{person.isYou ? `${person.name} (you)` : person.name}</strong>
          </span>
        </span>
        <button type="button" className={s.iconBtn} onClick={props.onClose} aria-label="Close why panel (Esc)">
          <Icon.close size={14} />
        </button>
      </div>
      <div className={s.pillRow}>
        <span className={s.pill} data-tone={String(tone)}>
          <span className={s.pillDot} aria-hidden="true" />
          {pct}% of their room
        </span>
      </div>
      <Headline text={sentence} />

      {relatedCells.length ? (
        <section className={s.sameSection} aria-labelledby="c3-p-where">
          <h3 id="c3-p-where" className={s.sameTitle}>
            <Icon.link size={13} />
            Where it shows
          </h3>
          <RelatedList cells={relatedCells} rows={props.rows} onSelectKey={props.onSelectKey} />
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="c3-p-when">
        <h3 id="c3-p-when" className={s.sectionTitle}>
          When it is due
        </h3>
        <ul className={s.facts}>
          <li>
            <EvidenceRow fact={{ kind: "task", title: "This week", meta: person.overdue ? `${person.overdue} already late` : "None late", status: `${load[0]} tasks`, tone: person.overdue ? 2 : "good" }} />
          </li>
          <li>
            <EvidenceRow fact={{ kind: "task", title: "Next week", meta: "Starts Monday 20 July", status: `${load[1]} tasks`, tone: load[1] > 4 ? 1 : "good" }} />
          </li>
          <li>
            <EvidenceRow fact={{ kind: "task", title: "Later", meta: "After 26 July", status: `${load[2]} tasks`, tone: "good" }} />
          </li>
        </ul>
      </section>

      <section className={s.section} aria-labelledby="c3-p-help">
        <h3 id="c3-p-help" className={s.sectionTitle}>
          What would help
        </h3>
        {remedies.length ? (
          <div className={s.remedies}>
            {remedies.map((r) => (
              <RemedyButton key={r.id} remedy={r} {...props} />
            ))}
          </div>
        ) : (
          <p className={s.quietNote}>
            {person.name} has room. Hover a remedy elsewhere to see how moving work to {person.name} would look.
          </p>
        )}
      </section>
    </div>
  );
}

type ListProps = { rows: Row[]; view: ViewCell[][]; onSelectKey: (key: string) => void };

/** Compare mode: the cells whose colour moved since last week, grouped warmer then calmer. */
function ChangeList({ rows, view, onSelectKey }: ListProps) {
  const moved = view
    .flat()
    .filter((c) => c.moved !== 0)
    .sort((a, b) => b.moved - a.moved || level(b.now.tone) - level(a.now.tone));
  if (!moved.length) return <p className={s.lookLede}>Nothing has changed colour since last week.</p>;
  const groups = [
    { dir: 1, title: "Warmer", items: moved.filter((c) => c.moved === 1) },
    { dir: -1, title: "Calmer", items: moved.filter((c) => c.moved === -1) },
  ].filter((g) => g.items.length);
  return (
    <div className={s.changeGroups}>
      {groups.map((g) => (
        <section key={g.dir} className={s.changeGroup} aria-label={`${g.title}: ${g.items.length}`}>
          <h3 className={s.changeHead} data-moved={g.dir}>
            {g.dir === 1 ? <Icon.up size={12} /> : <Icon.down size={12} />}
            {g.title}
            <span className={s.changeCount}>{g.items.length}</span>
          </h3>
          <ul className={s.changeList}>
            {g.items.map((c) => {
              const row = rows.find((r) => r.id === c.rowId)!;
              const dim = DIMENSIONS.find((d) => d.id === c.dim)!;
              return (
                <li key={c.key}>
                  <button type="button" className={s.changeItem} onClick={() => onSelectKey(c.key)}>
                    <span className={s.tileSm} style={{ background: row.color }} aria-hidden="true">
                      {row.initials}
                    </span>
                    <span className={s.relatedText}>
                      <span className={s.relatedName}>{row.name}</span>
                      <span className={s.changeDim}>{dim.name}</span>
                      <span className={s.changeFromTo}>
                        <span data-tone={toneAttr(c.base.last.tone)} className={s.changeVal}>
                          {c.base.last.label}
                        </span>
                        <Icon.arrow size={12} />
                        <span data-tone={toneAttr(c.now.tone)} className={s.changeVal}>
                          {c.now.label}
                        </span>
                      </span>
                    </span>
                    <Icon.arrow size={13} className={s.changeGo} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Changes(props: ListProps) {
  return (
    <div className={s.panelInner}>
      <h2 className={s.lookTitle}>What changed since {LAST_WEEK.replace("Thursday ", "")}</h2>
      <p className={s.lookLede}>Cells whose colour moved since last Thursday. Choose one to see why.</p>
      <ChangeList {...props} />
    </div>
  );
}

type LeadProps = Pick<
  PanelProps,
  "rows" | "view" | "applied" | "preview" | "loads" | "onSelectKey" | "onSelectPerson" | "onPreview" | "onApply" | "onUndo"
>;

/**
 * The resting panel: one confident diagnosis instead of a second list.
 * The person behind the most pressure, three facts, the best next step, and at most two other things.
 */
function LeadDiagnosis(props: LeadProps) {
  const lead = leadDiagnosis(props.view);
  const noun = props.rows[0]?.id.startsWith("ws-") ? "workstream" : "project";
  if (!lead) {
    return (
      <div className={s.lead}>
        <p className={s.panelKicker}>Start here</p>
        <h2 className={s.lookTitle}>Nothing needs a look</h2>
        <p className={s.lookLede}>
          Every {noun} is calm. The atlas will say here the moment something starts to slip. Choose any cell to see what it is based on.
        </p>
        <div className={s.calmArt} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>
      </div>
    );
  }
  const person = PEOPLE.find((p) => p.id === lead.person)!;
  const load = props.loads[person.id];
  const total = load[0] + load[1] + load[2];
  const pct = Math.round((total / CAPACITY) * 100);
  const name = person.isYou ? "You" : person.name;
  const sentence =
    pct > 100
      ? `${name} ${person.isYou ? "hold" : "holds"} ${total} open tasks, ${word(load[0])} due this week, against room for about ${word(CAPACITY)}. That one load shows up as ${word(lead.cells.length)} warm ${lead.cells.length === 1 ? "cell" : "cells"} across ${word(lead.projects)} ${lead.projects === 1 ? noun : `${noun}s`}.`
      : `${name} ${person.isYou ? "are" : "is"} behind ${word(lead.cells.length)} warm ${lead.cells.length === 1 ? "cell" : "cells"} across ${word(lead.projects)} ${lead.projects === 1 ? noun : `${noun}s`}.`;
  const ids = PERSON_REMEDIES[person.id] ?? [];
  const firstOpen = ids.find((id) => !props.applied.includes(id));
  const shownRemedies = [...ids.filter((id) => props.applied.includes(id)), ...(firstOpen ? [firstOpen] : [])]
    .map(remedyById)
    .filter(Boolean) as Remedy[];
  const leadKeys = new Set(lead.cells.map((c) => c.key));
  const also = props.view
    .flat()
    .filter((c) => level(c.now.tone) >= 2 && !leadKeys.has(c.key))
    .sort((a, b) => level(b.now.tone) - level(a.now.tone) || b.moved - a.moved)
    .slice(0, 2);
  const tone: Tone = pct > 120 ? 3 : pct > 100 ? 2 : pct > 85 ? 1 : 0;

  return (
    <div className={s.lead}>
      <p className={s.panelKicker}>Start here</p>
      <h2 className={s.leadTitle}>
        <span className={s.avatar} style={{ background: person.hue }} aria-hidden="true">
          {person.initials}
        </span>
        {person.isYou ? "Your load" : `${person.name}'s load`}
      </h2>
      <dl className={s.leadStats}>
        <div data-tone={String(tone)}>
          <dt>Load</dt>
          <dd>{pct}%</dd>
        </div>
        <div>
          <dt>This week</dt>
          <dd>{load[0]}</dd>
        </div>
        <div>
          <dt>Warm cells</dt>
          <dd>{lead.cells.length}</dd>
        </div>
      </dl>
      <p className={s.leadWhy}>{sentence}</p>
      <button type="button" className={s.leadShow} onClick={() => props.onSelectPerson(person.id)}>
        <Icon.link size={14} />
        Show in atlas
        <Icon.arrow size={13} className={s.leadShowArrow} />
      </button>

      {shownRemedies.length ? (
        <section className={s.section} aria-labelledby="c3-lead-help">
          <h3 id="c3-lead-help" className={s.sectionTitle}>
            Best next step
          </h3>
          <div className={s.remedies}>
            {shownRemedies.map((r) => (
              <RemedyButton key={r.id} remedy={r} {...(props as PanelProps)} />
            ))}
          </div>
        </section>
      ) : null}

      {also.length ? (
        <section className={`${s.section} ${s.leadAlso}`} aria-labelledby="c3-lead-also">
          <h3 id="c3-lead-also" className={s.sectionTitle}>
            Also
          </h3>
          <ul className={s.relatedList}>
            {also.map((c) => {
              const row = props.rows.find((r) => r.id === c.rowId)!;
              const dim = DIMENSIONS.find((d) => d.id === c.dim)!;
              return (
                <li key={c.key}>
                  <button type="button" className={s.relatedItem} onClick={() => props.onSelectKey(c.key)}>
                    <span className={s.tileSm} style={{ background: row.color }} aria-hidden="true">
                      {row.initials}
                    </span>
                    <span className={s.relatedText}>
                      <span className={s.relatedName}>{row.name}</span>
                      <span className={s.relatedMeta}>
                        <ToneGlyph tone={c.now.tone} className={s.glyph} />
                        <span className={s.relatedDim}>{dim.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className={s.relatedVal}>{c.now.label}</span>
                      </span>
                    </span>
                    <Icon.arrow size={14} className={s.relatedArrow} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Between phone and wide desktop the panel docks as a drawer, so the resting diagnosis lives in the page. */
export function LookFirstInline(props: LeadProps & { compare: boolean }) {
  return (
    <section className={s.inlineLook} aria-label={props.compare ? `What changed since ${LAST_WEEK}` : "Start here"}>
      {props.compare ? (
        <>
          <h2 className={s.peopleTitle}>What changed since {LAST_WEEK.replace("Thursday ", "")}</h2>
          <ChangeList rows={props.rows} view={props.view} onSelectKey={props.onSelectKey} />
        </>
      ) : (
        <LeadDiagnosis {...props} />
      )}
    </section>
  );
}

function EvidenceRow({ fact, was, onPerson }: { fact: Fact; was?: string; onPerson?: (id: string) => void }) {
  const body = (
    <>
      <span className={s.factIcon} data-kind={fact.kind}>
        <FactIcon kind={fact.kind} size={15} />
      </span>
      <span className={s.factText}>
        <span className={s.factTitle}>{fact.title}</span>
        <span className={s.factMeta}>{fact.meta}</span>
      </span>
      <span className={s.factStatusCol}>
        <span className={s.factStatus} data-tone={toneAttr(fact.tone)}>
          {fact.status}
        </span>
        {was ? (
          <s className={s.factWas}>
            <span className={s.srOnly}>was </span>
            {was}
          </s>
        ) : null}
      </span>
    </>
  );
  const href = HREF[fact.kind];
  if (href) {
    return (
      <a className={s.fact} href={href} data-link>
        {body}
      </a>
    );
  }
  const personId = fact.kind === "person" ? PEOPLE.find((p) => fact.title === p.name || (p.isYou && fact.title === "You"))?.id : undefined;
  if (personId && onPerson) {
    return (
      <button type="button" className={s.fact} data-link onClick={() => onPerson(personId)}>
        {body}
      </button>
    );
  }
  return <div className={s.fact}>{body}</div>;
}

function RemedyButton({ remedy, applied, preview, onPreview, onApply, onUndo }: PanelProps & { remedy: Remedy }) {
  const isApplied = applied.includes(remedy.id);
  const isPreview = preview === remedy.id;
  if (isApplied) {
    return (
      <div className={s.remedy} data-applied>
        <span className={s.remedyIcon} data-done>
          <Icon.check size={15} />
        </span>
        <span className={s.remedyText}>
          <span className={s.remedyLabel}>{remedy.effect.toast}</span>
          <span className={s.remedyReason}>Done just now. The atlas has updated.</span>
        </span>
        <button type="button" className={s.undo} onClick={() => onUndo(remedy.id)}>
          <Icon.undo size={13} />
          Undo
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={s.remedy}
      data-preview={isPreview || undefined}
      onMouseEnter={() => onPreview(remedy.id)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(remedy.id)}
      onBlur={() => onPreview(null)}
      onClick={() => {
        onPreview(null);
        onApply(remedy.id);
      }}
    >
      <span className={s.remedyIcon}>
        <RemedyIcon icon={remedy.icon} size={15} />
      </span>
      <span className={s.remedyText}>
        <span className={s.remedyLabel}>{remedy.label}</span>
        <span className={s.remedyReason}>{remedy.reason}</span>
        <span className={s.remedyHint} aria-hidden="true">
          Showing the effect in the atlas
        </span>
      </span>
    </button>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const w = 300;
  const h = 56;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 6 - (v / 3) * (h - 14)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
  const wk = pts[7];
  return (
    <svg className={s.trendChart} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Pressure over the last 14 days">
      {[0, 1, 2, 3].map((lv) => (
        <line key={lv} x1="0" x2={w} y1={h - 6 - (lv / 3) * (h - 14)} y2={h - 6 - (lv / 3) * (h - 14)} className={s.trendGrid} vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={wk[0]} x2={wk[0]} y1="0" y2={h} className={s.trendWeek} vectorEffect="non-scaling-stroke" />
      <path d={area} className={s.trendArea} />
      <path d={line} className={s.trendLine} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
