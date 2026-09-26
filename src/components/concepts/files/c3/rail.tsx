"use client";

import { useState } from "react";
import { FILES, LAST_VISIT, PEOPLE, PEOPLE_ORDER, PROJECTS, PROJECT_ORDER, shortWhen, type PersonId, type ProjectId } from "./data";
import { Avatar, FinalStamp, Icon, KindIcon, ProjectDot } from "./parts";
import s from "./c3.module.css";

export type Mode = "since" | "quiet" | "first";

type RailProps = {
  finals: Record<string, string>;
  conflictOpen: boolean;
  projects: Set<ProjectId>;
  person: PersonId | null;
  following: string[];
  unreadByFile: Record<string, number>;
  countsByProject: Record<string, number>;
  countsByPerson: Record<string, number>;
  mode: Mode;
  flashFollowing: boolean;
  pulse: { file: string; n: number } | null;
  onToggleProject: (p: ProjectId) => void;
  onPerson: (p: PersonId | null) => void;
  onOpenFile: (id: string) => void;
  onToggleFollow: (id: string) => void;
};

/** Files sorted by their newest version: the current state of everything. */
function latestOf(quiet: boolean) {
  return Object.values(FILES)
    .map((f) => {
      const vs = quiet ? f.versions.filter((v) => v.at <= LAST_VISIT) : f.versions;
      return { f, v: vs[vs.length - 1] };
    })
    .filter((x) => !!x.v)
    .sort((a, b) => (a.v.at < b.v.at ? 1 : -1));
}

export function Rail(p: RailProps) {
  const [all, setAll] = useState(false);
  const LATEST = latestOf(p.mode === "quiet");
  const list = all ? LATEST : LATEST.slice(0, 7);
  return (
    <aside className={s.rail} aria-label="Latest files, filters and following">
      <section className={s.railCard}>
        <header className={s.railHead}>
          <h2 className={s.railTitle}>Latest of everything</h2>
          <span className={s.railHint}>{LATEST.length} files</span>
        </header>
        <ul className={s.latest}>
          {list.map(({ f, v }) => {
            const finalRaw = p.finals[f.id];
            const final = finalRaw && (f.versions.find((x) => x.id === finalRaw)?.at ?? "") <= v.at ? finalRaw : undefined;
            const finalIsLatest = final === v.id;
            const finalOlder = final && !finalIsLatest ? f.versions.find((x) => x.id === final) : null;
            const twoCopies = f.id === "seating" && p.conflictOpen;
            const pulsing = p.pulse?.file === f.id;
            return (
              <li key={pulsing ? `${f.id}-${p.pulse!.n}` : f.id} className={pulsing ? s.pulse : undefined}>
                <button type="button" className={s.latestRow} onClick={() => p.onOpenFile(f.id)}>
                  <KindIcon kind={f.kind} size={14} />
                  <span className={s.latestText}>
                    <span className={s.latestName}>{f.name}</span>
                    <span className={s.latestMeta}>
                      {v.label} · {PEOPLE[v.by].name} · {shortWhen(v.at)}
                    </span>
                  </span>
                  {twoCopies ? (
                    <span className={s.latestWarn} title="Two copies disagree">
                      <Icon name="warn" size={12} />2 copies
                    </span>
                  ) : finalIsLatest ? (
                    <FinalStamp small />
                  ) : finalOlder ? (
                    <span className={s.latestWarn} title="A newer version exists than the one marked final">
                      Final is {finalOlder.label}
                    </span>
                  ) : (
                    <span className={s.latestOk}>
                      <Icon name="check" size={12} />
                      Latest
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={s.railMore} onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all ${LATEST.length}`}
        </button>
      </section>

      <section className={s.railCard}>
        <header className={s.railHead}>
          <h2 className={s.railTitle}>Projects</h2>
          {p.projects.size > 0 && (
            <button type="button" className={s.railClear} onClick={() => PROJECT_ORDER.forEach((id) => p.projects.has(id) && p.onToggleProject(id))}>
              Clear
            </button>
          )}
        </header>
        <ul className={s.filterList}>
          {PROJECT_ORDER.map((id) => {
            const on = p.projects.has(id);
            return (
              <li key={id}>
                <button type="button" className={`${s.filterRow} ${on ? s.filterOn : ""}`} aria-pressed={on} onClick={() => p.onToggleProject(id)}>
                  <ProjectDot id={id} />
                  <span className={s.filterName}>{PROJECTS[id].name}</span>
                  <span className={s.filterCount}>{p.countsByProject[id] ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <header className={`${s.railHead} ${s.railHeadGap}`}>
          <h2 className={s.railTitle}>People</h2>
          {p.person && (
            <button type="button" className={s.railClear} onClick={() => p.onPerson(null)}>
              Clear
            </button>
          )}
        </header>
        <div className={s.peopleRow}>
          {PEOPLE_ORDER.map((id) => {
            const on = p.person === id;
            return (
              <button
                key={id}
                type="button"
                className={`${s.personToggle} ${on ? s.personOn : ""} ${p.person && !on ? s.personOff : ""}`}
                aria-pressed={on}
                aria-label={`${PEOPLE[id].full}, ${PEOPLE[id].role}, ${p.countsByPerson[id] ?? 0} changes`}
                title={`${PEOPLE[id].full} · ${PEOPLE[id].role}`}
                onClick={() => p.onPerson(on ? null : id)}
              >
                <Avatar id={id} size={30} />
                <span className={s.personName}>{PEOPLE[id].name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${s.railCard} ${p.flashFollowing ? s.flash : ""}`} id="c3-following">
        <header className={s.railHead}>
          <h2 className={s.railTitle}>Following</h2>
          <span className={s.railHint}>{p.following.length}</span>
        </header>
        {p.following.length === 0 ? (
          <p className={s.railEmpty}>Follow a file and its changes stay at the top of your mind, even on busy days. Use the star on any change.</p>
        ) : (
          <ul className={s.latest}>
            {p.following.map((id) => {
              const f = FILES[id];
              const unread = p.unreadByFile[id] ?? 0;
              return (
                <li key={id} className={s.followRow}>
                  <button type="button" className={s.latestRow} onClick={() => p.onOpenFile(id)}>
                    <KindIcon kind={f.kind} size={14} />
                    <span className={s.latestText}>
                      <span className={s.latestName}>{f.name}</span>
                      <span className={s.latestMeta}>{PROJECTS[f.project].name}</span>
                    </span>
                    {unread > 0 && <span className={s.unreadBadge}>{unread} new</span>}
                  </button>
                  <button type="button" className={s.starBtn} aria-label={`Stop following ${f.name}`} title="Stop following" onClick={() => p.onToggleFollow(id)}>
                    <Icon name="star" size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className={s.keys}>
        <kbd>J</kbd> <kbd>K</kbd> move · <kbd>M</kbd> mark as the one · <kbd>T</kbd> history · <kbd>O</kbd> open · <kbd>/</kbd> search
      </p>
    </aside>
  );
}

/** Concept-only: preview the page as it looks on other visits. */
export function ModeSelect({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <label className={s.modeChip}>
      <span className={s.modeChipLabel}>Concept preview</span>
      <select className={s.modeSelect} value={mode} onChange={(e) => onMode(e.target.value as Mode)}>
        <option value="since">Back after 3 days</option>
        <option value="quiet">Nothing new</option>
        <option value="first">First visit</option>
      </select>
      <Icon name="chevron" size={12} className={s.modeChipIcon} />
    </label>
  );
}
