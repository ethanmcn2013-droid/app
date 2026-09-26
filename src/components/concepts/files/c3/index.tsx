"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CONFLICT,
  EVENTS,
  FILES,
  INITIAL_FINALS,
  INITIAL_FOLLOWING,
  LAST_VISIT,
  PEOPLE,
  PEOPLE_ORDER,
  PROJECTS,
  PROJECT_ORDER,
  dayDetail,
  dayKey,
  dayLabel,
  sentenceText,
  whenPhrase,
  type FeedEvent,
  type PersonId,
  type ProjectId,
} from "./data";
import { ConflictRow, Digest } from "./digest";
import { FeedItem, type ItemHandlers } from "./feed";
import { Avatar, ClientTag, FinalStamp, Icon, KindIcon, ProjectDot, kindLabel } from "./parts";
import { ModeSelect, Rail, type Mode } from "./rail";
import { FileSheet } from "./sheet";
import s from "./c3.module.css";

/**
 * Files concept 3, What changed: a newsroom of change. A digest of what
 * moved since your last visit, then a day-by-day feed where every entry
 * says what changed in human terms and shows the difference inline.
 */

type Toast = { id: number; text: string; undo?: () => void };

export default function WhatChanged() {
  const [mode, setMode] = useState<Mode>("since");
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [finals, setFinals] = useState<Record<string, string>>(INITIAL_FINALS);
  const [freshFinal, setFreshFinal] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>(INITIAL_FOLLOWING);
  const [projects, setProjects] = useState<Set<ProjectId>>(() => new Set());
  const [person, setPerson] = useState<PersonId | null>(null);
  const [spot, setSpot] = useState<{ id: PersonId; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pulse, setPulse] = useState<{ file: string; n: number } | null>(null);
  const [sheet, setSheet] = useState<{ file: string; version: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showBar, setShowBar] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [flashFollowing, setFlashFollowing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const digestRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const visibleRef = useRef<Set<string>>(new Set());
  const spotTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const toastSeq = useRef(0);

  /* ── derived ── */

  const events = useMemo(() => (mode === "quiet" ? EVENTS.filter((e) => e.at <= LAST_VISIT) : EVENTS), [mode]);
  const unseen = useMemo(() => (mode === "since" ? EVENTS.filter((e) => e.at > LAST_VISIT).map((e) => e.id) : []), [mode]);
  const left = unseen.filter((id) => !seen.has(id)).length;
  const conflictOpen = mode === "since" && !finals[CONFLICT.file];

  const q = query.trim().toLowerCase();
  const matches = (e: FeedEvent) => {
    const f = FILES[e.file];
    if (pinned && e.file !== pinned) return false;
    if (projects.size && !projects.has(f.project)) return false;
    if (person && e.actor !== person) return false;
    if (q && !`${sentenceText(e.sentence)} ${f.name} ${PROJECTS[f.project].name}`.toLowerCase().includes(q)) return false;
    return true;
  };
  const visible = events.filter(matches);
  const visibleIds = visible.map((e) => e.id);

  const countsByProject: Record<string, number> = {};
  const countsByPerson: Record<string, number> = {};
  for (const e of events) {
    countsByProject[FILES[e.file].project] = (countsByProject[FILES[e.file].project] ?? 0) + 1;
    countsByPerson[e.actor] = (countsByPerson[e.actor] ?? 0) + 1;
  }
  const unreadByFile: Record<string, number> = {};
  for (const id of unseen) {
    if (seen.has(id)) continue;
    const e = EVENTS.find((x) => x.id === id)!;
    unreadByFile[e.file] = (unreadByFile[e.file] ?? 0) + 1;
  }

  const groups = useMemo(() => {
    const out: { key: string; first: FeedEvent; list: FeedEvent[] }[] = [];
    for (const e of events) {
      const k = dayKey(e.at);
      const g = out[out.length - 1];
      if (g && g.key === k) g.list.push(e);
      else out.push({ key: k, first: e, list: [e] });
    }
    return out;
  }, [events]);
  const firstSeenId = mode === "first" ? null : events.find((e) => e.at <= LAST_VISIT)?.id;

  /* ── seen tracking: count down as items are read past ── */

  useEffect(() => {
    visibleRef.current = new Set(visibleIds);
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = () => {
      const rr = root.getBoundingClientRect();
      const dg = digestRef.current;
      setShowBar(dg ? dg.getBoundingClientRect().bottom < rr.top + 4 : root.scrollTop > 200);
      if (mode !== "since") return;
      const line = rr.top + rr.height * 0.6;
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 8;
      const fresh: string[] = [];
      for (const id of unseen) {
        const el = items.current.get(id);
        if (!el || !visibleRef.current.has(id)) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 8) continue;
        if (r.bottom < line || (atEnd && r.top < rr.bottom)) fresh.push(id);
      }
      if (fresh.length) {
        setSeen((prev) => {
          if (fresh.every((id) => prev.has(id))) return prev;
          const next = new Set(prev);
          fresh.forEach((id) => next.add(id));
          return next;
        });
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [mode, unseen]);

  /* ── actions ── */

  const say = (text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    toastSeq.current += 1;
    const t = { id: toastSeq.current, text, undo };
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), 6000);
  };

  const scrollToEvent = (id: string) => {
    const el = items.current.get(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setFocusId(id);
    el.focus({ preventScroll: true });
  };

  const markFinal = (file: string, version: string) => {
    const before = finals[file];
    const f = FILES[file];
    const idx = f.versions.findIndex((x) => x.id === version);
    const v = f.versions[idx];
    const older = idx;
    const newer = f.versions.slice(idx + 1);
    const resolves = file === CONFLICT.file && conflictOpen;
    setFinals((cur) => ({ ...cur, [file]: version }));
    setFreshFinal(version);
    setPulse((p) => ({ file, n: (p?.n ?? 0) + 1 }));
    const tasks = f.tasks.length === 1 ? "1 task" : `${f.tasks.length} tasks`;
    const gone: string[] = [];
    if (resolves && version !== "seating-2") gone.push("the upload");
    if (older > 0) gone.push(older === 1 ? "1 older version" : `${older} older versions`);
    const goneText = gone.join(" and ");
    const plural = gone.length > 1 || older > 1;
    let text = `${f.name} ${v.label} (${PEOPLE[v.by].name}, ${whenPhrase(v.at)}) is the one.`;
    text += gone.length
      ? ` ${goneText[0].toUpperCase()}${goneText.slice(1)} ${plural ? "are" : "is"} superseded on ${tasks}.`
      : ` It’s what ${f.tasks.length === 1 ? "its task" : f.tasks.length === 2 ? "both tasks" : `all ${tasks}`} will use.`;
    if (newer.length) text += ` ${newer.map((x) => x.label).join(" and ")} stays in the history as a newer draft.`;
    say(
      text,
      () =>
        setFinals((cur) => {
          const next = { ...cur };
          if (before) next[file] = before;
          else delete next[file];
          return next;
        }),
    );
  };

  const toggleFollow = (file: string) => {
    const on = following.includes(file);
    setFollowing((cur) => (on ? cur.filter((x) => x !== file) : [...cur, file]));
    say(on ? `Stopped following ${FILES[file].name}.` : `Following ${FILES[file].name}. Its changes will lead your digest.`);
  };

  const pin = (file: string) => {
    setPinned((cur) => (cur === file ? null : file));
    setSpot(null);
    rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choosePerson = (id: PersonId | null) => {
    setPerson((cur) => (cur === id ? null : id));
    setSpot(null);
    window.clearTimeout(spotTimer.current);
  };

  const h: ItemHandlers = {
    onPersonEnter: (id, el) => {
      window.clearTimeout(spotTimer.current);
      spotTimer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        setSpot({ id, x: r.left, y: r.bottom });
      }, 180);
    },
    onPersonLeave: () => {
      window.clearTimeout(spotTimer.current);
      setSpot(null);
    },
    onPerson: (id) => choosePerson(id),
    onPin: pin,
    onOpen: (file, version) => setSheet({ file, version: version ?? FILES[file].versions[FILES[file].versions.length - 1].id }),
    onMark: markFinal,
    onFollow: toggleFollow,
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSeen(new Set());
    setPinned(null);
    setPerson(null);
    setProjects(new Set());
    setQuery("");
    setFocusId(null);
    setFollowing(m === "first" ? [] : INITIAL_FOLLOWING);
    rootRef.current?.scrollTo({ top: 0 });
  };

  const nextUnread = () => {
    const id = unseen.find((x) => !seen.has(x) && visibleIds.includes(x));
    if (id) scrollToEvent(id);
  };

  /* ── keyboard ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, [contenteditable=true]") && (t as HTMLInputElement).type !== "range";
      if (e.key === "Escape") {
        if (sheet) return;
        if (typing) {
          (t as HTMLInputElement).blur();
          return;
        }
        if (pinned) setPinned(null);
        else if (person) setPerson(null);
        else if (projects.size) setProjects(new Set());
        return;
      }
      if (typing || sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const idx = focusId ? visibleIds.indexOf(focusId) : -1;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const n = e.key === "j" ? Math.min(visibleIds.length - 1, idx + 1) : Math.max(0, idx - 1);
        const id = visibleIds[n];
        if (!id) return;
        setFocusId(id);
        const el = items.current.get(id);
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      const cur = focusId ? EVENTS.find((x) => x.id === focusId) : null;
      if (!cur) return;
      if (e.key === "m" && cur.version) markFinal(cur.file, cur.version);
      else if (e.key === "t") pin(cur.file);
      else if (e.key === "o" || e.key === "Enter") h.onOpen(cur.file, cur.version);
      else if (e.key === "f") toggleFollow(cur.file);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const register = (id: string, el: HTMLElement | null) => {
    if (el) items.current.set(id, el);
    else items.current.delete(id);
  };

  const spotlight = spot?.id ?? null;
  const filtered = !!(pinned || person || projects.size || q);
  const pinnedFile = pinned ? FILES[pinned] : null;

  const filterChips = (
    <>
      {pinnedFile && (
        <span className={s.barChip}>
          <Icon name="thread" size={12} /> History of {pinnedFile.name}
          <button type="button" onClick={() => setPinned(null)} aria-label="Back to the feed">
            <Icon name="close" size={11} />
          </button>
        </span>
      )}
      {person && (
        <span className={s.barChip}>
          <Avatar id={person} size={16} /> Only {PEOPLE[person].name}
          <button type="button" onClick={() => setPerson(null)} aria-label="Show everyone">
            <Icon name="close" size={11} />
          </button>
        </span>
      )}
      {[...projects].map((p) => (
        <span key={p} className={s.barChip}>
          <ProjectDot id={p} size={7} /> {PROJECTS[p].name}
          <button
            type="button"
            onClick={() =>
              setProjects((cur) => {
                const n = new Set(cur);
                n.delete(p);
                return n;
              })
            }
            aria-label={`Remove ${PROJECTS[p].name}`}
          >
            <Icon name="close" size={11} />
          </button>
        </span>
      ))}
      {q && (
        <span className={s.barChip}>
          <Icon name="search" size={12} /> “{query.trim()}”
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <Icon name="close" size={11} />
          </button>
        </span>
      )}
    </>
  );

  return (
    <div className={s.page} ref={rootRef}>
      <div className={s.cq}>
      <div className={s.layout}>
          <header className={s.header}>
            <div className={s.titleBlock}>
              <div className={s.titleRow}>
                <h1 className={s.h1}>Files</h1>
                <ModeSelect mode={mode} onMode={switchMode} />
              </div>
              <p className={s.sub}>What moved across four projects, and exactly how.</p>
            </div>
            <div className={s.headerTools}>
              <label className={s.search}>
                <Icon name="search" size={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a file or a change"
                  aria-label="Find a file or a change"
                />
                {query ? (
                  <button type="button" className={s.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
                    <Icon name="close" size={12} />
                  </button>
                ) : (
                  <kbd className={s.searchKey}>/</kbd>
                )}
              </label>
              <button type="button" className={s.secondaryBtn} aria-label="Upload" onClick={() => say("Uploads land in the feed with what changed worked out. This concept doesn’t upload.")}>
                <Icon name="upload" size={14} />
                <span className={s.hideSm} aria-hidden>
                  Upload
                </span>
              </button>
            </div>
          </header>
        <main className={s.feedCol}>

          {/* phone filters: the rail's filters as a scrolling strip */}
          <div className={s.strip} role="group" aria-label="Filter the feed">
            {PROJECT_ORDER.map((id) => {
              const on = projects.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  className={`${s.stripChip} ${on ? s.stripOn : ""}`}
                  onClick={() =>
                    setProjects((cur) => {
                      const n = new Set(cur);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                >
                  <ProjectDot id={id} size={7} />
                  {PROJECTS[id].name}
                </button>
              );
            })}
            {PEOPLE_ORDER.map((id) => (
              <button key={id} type="button" aria-pressed={person === id} className={`${s.stripChip} ${person === id ? s.stripOn : ""}`} onClick={() => choosePerson(id)}>
                <Avatar id={id} size={18} />
                {PEOPLE[id].name}
              </button>
            ))}
          </div>

          {/* sticky catch-up bar: appears once the digest scrolls away */}
          <div className={`${s.bar} ${showBar ? s.barOn : ""}`} aria-hidden={!showBar}>
            <div className={s.barInner}>
              {mode === "since" && !pinned && (
                <span className={`${s.barCount} ${left === 0 ? s.barDone : ""}`}>
                  <span className={s.barSegs} aria-hidden>
                    {unseen.map((id) => (
                      <span key={id} className={`${s.barSeg} ${seen.has(id) ? s.barSegOn : ""}`} />
                    ))}
                  </span>
                  {left === 0 && <Icon name="check" size={14} />}
                  {left === 0 ? "You’re up to date" : `${left} left to catch up`}
                </span>
              )}
              {filterChips}
              <span className={s.barSpacer} />
              {mode === "since" && left > 0 && !pinned && (
                <button type="button" className={s.barNext} onClick={nextUnread}>
                  Next unread <Icon name="chevron" size={12} />
                </button>
              )}
              {showBar && (
                <button type="button" className={s.barTop} onClick={() => rootRef.current?.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to the top">
                  <Icon name="chevron" size={14} className={s.flip} />
                </button>
              )}
            </div>
          </div>

          {filtered && !pinned && (
            <div className={s.filterBar} role="status">
              <span className={s.filterBarLabel}>
                Showing {visible.length} of {events.length}
              </span>
              {filterChips}
              <button
                type="button"
                className={s.linkBtn}
                onClick={() => {
                  setQuery("");
                  setPerson(null);
                  setProjects(new Set());
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {pinnedFile ? (
            <ThreadHead
              file={pinned!}
              finals={finals}
              freshFinal={freshFinal}
              onClose={() => setPinned(null)}
              onOpen={(v) => setSheet({ file: pinned!, version: v })}
            />
          ) : (
            <>
              <Digest
                mode={mode}
                unseen={unseen}
                seen={seen}
                open={digestOpen}
                onToggle={() => setDigestOpen((o) => !o)}
                onJump={scrollToEvent}
                onMarkAll={() => setSeen(new Set(unseen))}
                onStart={() => visibleIds[0] && scrollToEvent(visibleIds[0])}
                onPin={pin}
                refEl={(el) => {
                  digestRef.current = el;
                }}
                conflict={
                  mode === "since" ? (
                    <ConflictRow
                      final={finals[CONFLICT.file]}
                      onKeep={(v) => markFinal(CONFLICT.file, v)}
                      onUndo={() =>
                        setFinals((cur) => {
                          const n = { ...cur };
                          delete n[CONFLICT.file];
                          return n;
                        })
                      }
                    />
                  ) : null
                }
              />
            </>
          )}

          <div className={`${s.feed} ${pinned ? s.feedThread : ""}`}>
            {groups.map((g) => {
              const anyVisible = g.list.some((e) => visibleIds.includes(e.id));
              const showDivider = !pinned && g.list.some((e) => e.id === firstSeenId);
              return (
                <Fragment key={g.key}>
                  {showDivider && (
                    <div className={`${s.lastVisit} ${filtered && !anyVisible ? s.itemGone : ""}`}>
                      <span className={s.lastVisitLine} aria-hidden />
                      <span className={s.lastVisitText}>
                        <Icon name="eye" size={13} /> You were last here Tuesday at 16:20. You’ve seen everything below.
                      </span>
                      <span className={s.lastVisitLine} aria-hidden />
                    </div>
                  )}
                  <section className={s.day} aria-label={dayLabel(g.first.at)}>
                    <div className={`${s.itemWrap} ${anyVisible ? "" : s.itemGone}`}>
                      <div className={s.itemClip}>
                        <h2 className={s.dayHead}>
                          <span className={s.dayName}>{dayLabel(g.first.at)}</span>
                          <span className={s.dayDate}>{dayDetail(g.first.at)}</span>
                          <span className={s.dayCount}>
                            {g.list.filter((e) => visibleIds.includes(e.id)).length} {g.list.filter((e) => visibleIds.includes(e.id)).length === 1 ? "change" : "changes"}
                          </span>
                        </h2>
                      </div>
                    </div>
                    {g.list.map((e) => (
                      <FeedItem
                        key={e.id}
                        ev={e}
                        unread={unseen.includes(e.id) && !seen.has(e.id)}
                        hidden={!visibleIds.includes(e.id)}
                        dim={!!spotlight && e.actor !== spotlight}
                        focused={focusId === e.id}
                        final={finals[e.file]}
                        freshFinal={freshFinal}
                        following={following.includes(e.file)}
                        thread={!!pinned}
                        h={h}
                        register={register}
                      />
                    ))}
                  </section>
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <div className={s.empty}>
                <p className={s.emptyTitle}>
                  {q ? `Nothing matches “${query.trim()}”` : person ? `Nothing from ${PEOPLE[person].name} here` : "Nothing here in the last three weeks"}
                </p>
                <p className={s.emptyText}>Try another project or person, or clear the filters to see every change.</p>
                <button
                  type="button"
                  className={s.secondaryBtn}
                  onClick={() => {
                    setQuery("");
                    setPerson(null);
                    setProjects(new Set());
                    setPinned(null);
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {visible.length > 0 && (
              <p className={s.end}>
                {pinnedFile ? `That’s the whole history of ${pinnedFile.name}.` : "That’s three weeks of changes. Older ones are in each file’s history."}
              </p>
            )}
          </div>

        </main>

        <Rail
          finals={finals}
          conflictOpen={conflictOpen}
          pulse={pulse}
          projects={projects}
          person={person}
          following={following}
          unreadByFile={unreadByFile}
          countsByProject={countsByProject}
          countsByPerson={countsByPerson}
          mode={mode}
          flashFollowing={flashFollowing}
          onToggleProject={(p) => {
            setProjects((cur) => {
              const n = new Set(cur);
              if (n.has(p)) n.delete(p);
              else n.add(p);
              return n;
            });
            rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onPerson={(id) => {
            choosePerson(id);
            rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onOpenFile={pin}
          onToggleFollow={(id) => {
            toggleFollow(id);
            setFlashFollowing(true);
            window.setTimeout(() => setFlashFollowing(false), 700);
          }}
        />
      </div>
      </div>

      {spot && <PersonCard id={spot.id} x={spot.x} y={spot.y} count={countsByPerson[spot.id] ?? 0} active={person === spot.id} />}

      {sheet && <FileSheet key={`${sheet.file}-${sheet.version}`} file={sheet.file} version={sheet.version} finals={finals} freshFinal={freshFinal} onMark={markFinal} onClose={() => setSheet(null)} />}

      <div className={s.toastZone} aria-live="polite">
        {toast && (
          <div key={toast.id} className={s.toast} role="status">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className={s.toastUndo}
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                <Icon name="undo" size={13} /> Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── small pieces ───────────────────────────────────────────────── */

function PersonCard({ id, x, y, count, active }: { id: PersonId; x: number; y: number; count: number; active: boolean }) {
  const p = PEOPLE[id];
  return (
    <div className={s.personCard} style={{ left: x, top: y + 8 }} role="tooltip">
      <div className={s.personCardTop}>
        <Avatar id={id} size={32} />
        <div>
          <strong className={s.personCardName}>
            {p.full} {p.client && <ClientTag />}
          </strong>
          <span className={s.personCardRole}>{p.role}</span>
        </div>
      </div>
      <p className={s.personCardText}>
        {count} {count === 1 ? "change" : "changes"} in three weeks. Only their changes are lit up.
      </p>
      <span className={s.personCardHint}>{active ? "Click to show everyone again" : `Click to see only ${p.name}`}</span>
    </div>
  );
}

function ThreadHead({
  file,
  finals,
  freshFinal,
  onClose,
  onOpen,
}: {
  file: string;
  finals: Record<string, string>;
  freshFinal: string | null;
  onClose: () => void;
  onOpen: (version: string) => void;
}) {
  const f = FILES[file];
  const latest = f.versions[f.versions.length - 1];
  return (
    <section className={s.threadHead} aria-labelledby="c3-thread-title">
      <div className={s.threadTop}>
        <KindIcon kind={f.kind} size={18} />
        <div className={s.threadTitleWrap}>
          <p className={s.digestKicker}>
            <Icon name="thread" size={12} /> Whole history
          </p>
          <h2 id="c3-thread-title" className={s.threadTitle}>
            {f.name}
          </h2>
          <span className={s.sheetSub}>
            <ProjectDot id={f.project} /> {PROJECTS[f.project].name} · {kindLabel(f.kind)} · {f.source} · on {f.tasks.length === 1 ? "1 task" : `${f.tasks.length} tasks`}
          </span>
        </div>
        <button type="button" className={s.secondaryBtn} onClick={onClose}>
          Back to the feed <kbd className={s.searchKey}>Esc</kbd>
        </button>
      </div>
      <ol className={s.steps}>
        {f.versions.map((v) => (
          <li key={v.id} className={s.step}>
            <button type="button" className={s.stepBtn} onClick={() => onOpen(v.id)}>
              <span className={`${s.stepDot} ${finals[file] === v.id ? s.stepDotFinal : v.id === latest.id ? s.stepDotLatest : ""}`} aria-hidden />
              <span className={s.stepLabel}>
                {v.label}
                {finals[file] === v.id ? <FinalStamp small fresh={freshFinal === v.id} /> : v.id === latest.id ? <span className={s.latestOk}>Latest</span> : null}
              </span>
              <span className={s.stepNote}>{v.note}</span>
              <span className={s.stepMeta}>
                {PEOPLE[v.by].name} · {v.at.slice(8, 10).replace(/^0/, "")} Sep
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
