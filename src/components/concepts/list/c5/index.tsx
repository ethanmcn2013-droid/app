"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer, type ComposerHandle } from "./Composer";
import {
  agendaLabel,
  COMMITMENTS,
  diffDays,
  isLate,
  ME,
  PEOPLE,
  personById,
  plural,
  PROJECT,
  relDay,
  WEEK_START,
  TODAY,
  type Commitment,
  type Person,
  type PersonId,
} from "./data";
import { useIsPhone } from "./hooks";
import { Icon } from "./icons";
import type { Parsed } from "./parse";
import { Avatar } from "./Pickers";
import { Sentence, type TokenKind } from "./Sentence";
import { UpdatePreview } from "./UpdatePreview";
import s from "./c5.module.css";

type Filter = "all" | "late" | "waiting" | "week" | "nodate";
type GroupKey = PersonId | "nobody";
type Toast = { id: number; msg: string; undo?: () => void };

const GROUP_ORDER: GroupKey[] = ["orla", "dev", "aoife", "tom", "niamh", "sinead", "mara", "nobody"];

const FILTERS: { id: Filter; label: string; test: (x: Commitment) => boolean }[] = [
  { id: "all", label: "Every promise", test: () => true },
  { id: "late", label: "Running late", test: isLate },
  { id: "week", label: "Due in the next week", test: (x) => !!x.due && diffDays(x.due) >= 0 && diffDays(x.due) <= 7 },
  { id: "waiting", label: "Waiting on someone", test: (x) => !!x.waitingOn },
  { id: "nodate", label: "No date yet", test: (x) => !x.due },
];

const byDue = (a: Commitment, b: Commitment) => {
  if (!a.due && !b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
};

const groupKeyOf = (x: Commitment): GroupKey => x.owner ?? "nobody";

/* ── Group header ──────────────────────────────────────────────────── */

function summaryFor(person: Person | null, open: Commitment[], keptCount: number) {
  if (!person) {
    if (open.length === 0) return "Everything has an owner.";
    return `${plural(open.length, "promise")} ${open.length === 1 ? "needs" : "need"} someone to take ${open.length === 1 ? "it" : "them"} on.`;
  }
  if (open.length === 0) {
    return keptCount > 0 ? `${person.name} is all caught up. Kept ${keptCount} this week.` : `${person.name} is all caught up.`;
  }
  const late = open.filter(isLate).length;
  const waiting = open.filter((x) => x.waitingOn).length;
  const next = open.filter((x) => x.due && !isLate(x)).sort(byDue)[0];
  const who = person.org ? `${person.name} from ${person.org}` : person.name;
  const parts = [`${who} has ${open.length} open`];
  if (late) parts.push(`${late} running late`);
  if (waiting) parts.push(`${waiting} waiting on someone`);
  if (next) parts.push(`next due ${relDay(next.due!)}`);
  return `${parts.join(", ")}.`;
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function WhoOwesWhat() {
  const phone = useIsPhone();
  const [items, setItems] = useState<Commitment[]>(COMMITMENTS);
  const [sessionKept, setSessionKept] = useState<Set<string>>(() => new Set());
  const [openTok, setOpenTok] = useState<{ id: string; kind: TokenKind } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(() => new Set());
  const [showKept, setShowKept] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<GroupKey | null>(null);
  const [asked, setAsked] = useState<Set<string>>(() => new Set());
  const [updateOpen, setUpdateOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupKey | null>(null);
  const composer = useRef<ComposerHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, msg, undo });
    toastTimer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5200);
  }, []);

  const flash = useCallback((id: string) => {
    setFlashId(id);
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1600);
  }, []);

  const scrollToItem = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      rootRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  /* derived */
  const open = items.filter((x) => !x.keptOn);
  const keptWeek = items.filter((x) => x.keptOn && x.keptOn >= WEEK_START);
  const lateCount = open.filter(isLate).length;
  const test = FILTERS.find((f) => f.id === filter)!.test;

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((key) => {
        const person = key === "nobody" ? null : personById(key);
        const mine = items.filter((x) => groupKeyOf(x) === key);
        const openHere = mine.filter((x) => !x.keptOn);
        const visible = mine
          .filter((x) => (!x.keptOn && test(x)) || (sessionKept.has(x.id) && filter === "all"))
          .sort((a, b) => {
            const la = isLate(a) ? 0 : 1;
            const lb = isLate(b) ? 0 : 1;
            return la - lb || byDue(a, b);
          });
        const kept = mine.filter((x) => x.keptOn && x.keptOn >= WEEK_START).length;
        const holding = items.filter((x) => !x.keptOn && x.waitingOn === key);
        return { key, person, open: openHere, visible, kept, holding };
      }),
    [items, sessionKept, filter, test],
  );

  const flat = groups.filter((g) => !collapsed.has(g.key)).flatMap((g) => g.visible);

  /* mutations */
  const patch = useCallback(
    (id: string, p: Partial<Commitment>) => {
      const before = items.find((x) => x.id === id);
      setItems((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
      flash(id);
      if (before && "owner" in p && p.owner !== before.owner) {
        const to = personById(p.owner ?? null);
        say(to ? `Handed to ${to.name}.` : "Put back for anyone to take.", () =>
          setItems((all) => all.map((x) => (x.id === id ? { ...x, owner: before.owner } : x))),
        );
        scrollToItem(id);
      }
    },
    [items, flash, say, scrollToItem],
  );

  const toggle = useCallback(
    (id: string) => {
      const item = items.find((x) => x.id === id);
      if (!item) return;
      if (item.keptOn) {
        setItems((all) => all.map((x) => (x.id === id ? { ...x, keptOn: null } : x)));
        setSessionKept((set) => {
          const next = new Set(set);
          next.delete(id);
          return next;
        });
        return;
      }
      setItems((all) => all.map((x) => (x.id === id ? { ...x, keptOn: TODAY } : x)));
      setSessionKept((set) => new Set(set).add(id));
      const owner = personById(item.owner);
      const left = items.filter((x) => !x.keptOn && x.owner === item.owner && x.id !== id).length;
      say(
        owner
          ? left === 0
            ? `Kept. ${owner.name} is all caught up.`
            : `Kept. ${owner.name} has ${left} left.`
          : "Kept.",
        () => {
          setItems((all) => all.map((x) => (x.id === id ? { ...x, keptOn: null } : x)));
          setSessionKept((set) => {
            const next = new Set(set);
            next.delete(id);
            return next;
          });
        },
      );
    },
    [items, say],
  );

  const remove = useCallback(
    (id: string) => {
      const idx = items.findIndex((x) => x.id === id);
      const item = items[idx];
      setItems((all) => all.filter((x) => x.id !== id));
      say("Promise removed.", () =>
        setItems((all) => {
          const next = [...all];
          next.splice(idx, 0, item);
          return next;
        }),
      );
    },
    [items, say],
  );

  const nudge = useCallback(
    (item: Commitment) => {
      const who = personById(item.owner);
      if (!who) return;
      setAsked((set) => new Set(set).add(item.id));
      say(`Asked ${who.name} how "${item.action}" is going. They will see it on their Home.`);
    },
    [say],
  );

  const nudgePerson = useCallback(
    (person: Person, list: Commitment[]) => {
      setAsked((set) => {
        const next = new Set(set);
        list.forEach((x) => next.add(x.id));
        return next;
      });
      say(
        list.length === 1
          ? `Asked ${person.name} for an update on one promise.`
          : `Asked ${person.name} for an update on ${list.length} promises.`,
      );
    },
    [say],
  );

  const add = useCallback(
    (p: Parsed) => {
      const id = `n${Date.now()}`;
      const item: Commitment = {
        id,
        owner: p.owner,
        action: p.action,
        due: p.due,
        forWhom: p.forWhom,
        waitingOn: p.waitingOn,
        waitingFor: p.waitingFor,
        keptOn: null,
      };
      setItems((all) => [...all, item]);
      setFilter("all");
      setCollapsed((set) => {
        const next = new Set(set);
        next.delete(item.owner ?? "nobody");
        return next;
      });
      flash(id);
      const who = personById(p.owner);
      say(who ? `Added to ${who.name}'s promises.` : "Added for anyone to take.", () =>
        setItems((all) => all.filter((x) => x.id !== id)),
      );
      scrollToItem(id);
    },
    [flash, say, scrollToItem],
  );

  const toggleGroup = (key: GroupKey) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tidy = () => {
    setSessionKept(new Set());
    setShowKept(true);
  };

  const jumpTo = (key: GroupKey) => {
    setCollapsed((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
    rootRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const drop = (key: GroupKey) => {
    if (dragId) patch(dragId, { owner: key === "nobody" ? null : key });
    setDragId(null);
    setDropOn(null);
  };

  /* which person is in view: the strip follows along */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => seen.set((en.target as HTMLElement).dataset.group!, en.isIntersecting ? en.boundingClientRect.top : Infinity));
        let best: string | null = null;
        let bestTop = Infinity;
        seen.forEach((top, key) => {
          if (top < bestTop) {
            bestTop = top;
            best = key;
          }
        });
        setActiveGroup(best as GroupKey | null);
      },
      { root, rootMargin: "-80px 0px -55% 0px" },
    );
    root.querySelectorAll("[data-group]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [filter, items.length]);

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.key === "Escape") {
        setOpenTok(null);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || openTok || updateOpen) return;
      const idx = focusId ? flat.findIndex((x) => x.id === focusId) : -1;
      const move = (d: number) => {
        const next = flat[Math.max(0, Math.min(flat.length - 1, idx + d))];
        if (next) {
          setFocusId(next.id);
          rootRef.current?.querySelector(`[data-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
        }
      };
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        composer.current?.focus();
      } else if (k === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (k === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (focusId && k === "x") {
        e.preventDefault();
        toggle(focusId);
      } else if (focusId && (k === "d" || k === "p" || k === "e" || k === "w")) {
        e.preventDefault();
        const kind: TokenKind = k === "d" ? "due" : k === "p" ? "owner" : k === "w" ? "waiting" : "action";
        setOpenTok({ id: focusId, kind });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, focusId, openTok, updateOpen, toggle]);

  /* due soon agenda */
  const agenda = useMemo(() => {
    const upcoming = items.filter((x) => !x.keptOn && x.due && diffDays(x.due) >= 0).sort(byDue);
    const dates: string[] = [];
    upcoming.forEach((x) => {
      if (!dates.includes(x.due!)) dates.push(x.due!);
    });
    return dates.slice(0, 5).map((d) => ({ date: d, items: upcoming.filter((x) => x.due === d) }));
  }, [items]);

  const allKept = open.length === 0;
  const keptByPerson = PEOPLE.map((p) => ({ p, n: keptWeek.filter((x) => x.owner === p.id).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);

  const filterList = (
    <div className={s.filterList} role="radiogroup" aria-label="Show">
      {FILTERS.map((f) => {
        const n = open.filter(f.test).length;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            key={f.id}
            className={filter === f.id ? `${s.filter} ${s.filterOn}` : s.filter}
            onClick={() => setFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className={s.filterCount}>{n}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root} ref={rootRef}>
        <div className={s.page}>
          {/* ── Header ─────────────────────────────────────────── */}
          <header className={s.header}>
            <div className={s.project}>
              <span className={s.projectTile} aria-hidden>
                {PROJECT.initials}
              </span>
              <span>{PROJECT.name}</span>
              <span className={s.projectSep} aria-hidden>
                /
              </span>
              <span>Tasks</span>
            </div>
            <div className={s.titleRow}>
              <div>
                <h1 className={s.h1}>Who owes what</h1>
                <p className={s.lede}>
                  {PEOPLE.length} people, {plural(open.length, "open promise")},{" "}
                  {lateCount > 0 ? (
                    <button type="button" className={s.ledeLink} onClick={() => setFilter(filter === "late" ? "all" : "late")}>
                      {lateCount} running late
                    </button>
                  ) : (
                    "nothing running late"
                  )}
                  .
                </p>
              </div>
              <button type="button" className={`${s.secondaryButton} ${s.phoneOnly}`} onClick={() => setUpdateOpen(true)}>
                <Icon.copy /> Copy as update
              </button>
            </div>
          </header>

          {/* ── Person strip ───────────────────────────────────── */}
          <nav className={s.strip} aria-label="People">
            <div className={s.stripInner}>
              {groups.map((g) => {
                const late = g.open.filter(isLate).length;
                return (
                  <button
                    type="button"
                    key={g.key}
                    className={[s.stripChip, activeGroup === g.key ? s.stripChipOn : "", dropOn === g.key ? s.dropHere : ""].join(" ")}
                    aria-current={activeGroup === g.key ? "true" : undefined}
                    onClick={() => jumpTo(g.key)}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      setDropOn(g.key);
                    }}
                    onDragLeave={() => setDropOn((d) => (d === g.key ? null : d))}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(g.key);
                    }}
                    aria-label={`${g.person?.name ?? "Nobody yet"}: ${g.open.length} open${late ? `, ${late} running late` : ""}`}
                  >
                    <Avatar person={g.person} size={24} />
                    <span className={s.stripName}>{g.person?.name ?? "Nobody yet"}</span>
                    <span className={s.stripCount}>
                      {g.open.length === 0 ? <Icon.check size={13} strokeWidth={2} className={s.stripDone} /> : g.open.length}
                      {late > 0 && <span className={s.lateDot} aria-hidden />}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className={s.phoneOnly}>
            <div className={s.phoneFilters}>{filterList}</div>
          </div>

          <div className={s.layout}>
            <main className={s.column}>
              <Composer ref={composer} onAdd={add} />

              {allKept ? (
                <motion.section className={s.allKept} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <span className={s.allKeptMark} aria-hidden>
                    <Icon.check size={22} strokeWidth={2} />
                  </span>
                  <h2 className={s.allKeptTitle}>Every promise this week is kept.</h2>
                  <p className={s.allKeptSub}>
                    {keptWeek.length} kept since Monday. A good week to send the team a note.
                  </p>
                  <button type="button" className={s.primaryButton} onClick={() => setUpdateOpen(true)}>
                    <Icon.copy /> Copy as update
                  </button>
                </motion.section>
              ) : (
                <LayoutGroup>
                  {groups.map((g) => {
                    if (g.key === "nobody" && g.open.length === 0 && g.visible.length === 0) return null;
                    if (filter !== "all" && g.visible.length === 0) return null;
                    const isCollapsed = collapsed.has(g.key);
                    const late = g.open.filter(isLate);
                    const person = g.person;
                    return (
                      <section
                        key={g.key}
                        className={[s.group, dropOn === g.key ? s.groupDrop : "", g.key === "nobody" ? s.groupNobody : ""].join(" ")}
                        data-group={g.key}
                        aria-labelledby={`c5-g-${g.key}`}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          setDropOn(g.key);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOn((d) => (d === g.key ? null : d));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          drop(g.key);
                        }}
                      >
                        <header className={s.groupHead}>
                          <div
                            className={s.groupToggle}
                            onClick={() => {
                              if (phone) toggleGroup(g.key);
                            }}
                          >
                            <span className={s.groupAvatar}>
                              <Avatar person={person} size={phone ? 36 : 44} />
                              {person && g.open.length === 0 && (
                                <span className={s.caughtUp} aria-hidden>
                                  <Icon.check size={10} strokeWidth={2.4} />
                                </span>
                              )}
                            </span>
                            <span className={s.groupText}>
                              <h2 id={`c5-g-${g.key}`} className={s.groupName}>
                                {person ? person.name : "Nobody has picked these up yet"}
                                {person && (
                                  <span className={s.groupRole}>
                                    {person.id === ME ? "You, " : ""}
                                    {person.from ?? person.role}
                                  </span>
                                )}
                              </h2>
                              <span className={s.groupSummary}>
                                {summaryFor(person, g.open, g.kept)}
                                {person && person.id !== ME && g.open.length > 0 && (
                                  <>
                                    {" "}
                                    <button
                                      type="button"
                                      className={late.length ? `${s.askLink} ${s.askLinkLive}` : s.askLink}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        nudgePerson(person, late.length ? late : g.open);
                                      }}
                                    >
                                      Ask {person.name} for an update
                                    </button>
                                  </>
                                )}
                              </span>
                              {g.holding.length > 0 && (
                                <span className={s.holding}>
                                  <Icon.pause size={13} />
                                  <span>
                                    {g.holding
                                      .map((x) => `${personById(x.owner)?.name ?? "Someone"} needs ${x.waitingFor ?? "an answer"} from ${person?.name ?? "them"} to ${x.action}`)
                                      .join("; ")}
                                    .
                                  </span>
                                </span>
                              )}
                            </span>
                            {phone && g.visible.length > 0 && (
                              <button
                                type="button"
                                className={s.collapseButton}
                                aria-expanded={!isCollapsed}
                                aria-label={isCollapsed ? `Show ${person?.name ?? "unclaimed"} promises` : `Hide ${person?.name ?? "unclaimed"} promises`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroup(g.key);
                                }}
                              >
                                <Icon.chevron className={`${s.groupChevron} ${isCollapsed ? s.groupChevronShut : ""}`} />
                              </button>
                            )}
                          </div>
                        </header>

                        <AnimatePresence initial={false}>
                          {!isCollapsed && g.visible.length > 0 && (
                            <motion.ol
                              className={s.list}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                            >
                              {g.visible.map((x) => (
                                <Sentence
                                  key={x.id}
                                  item={x}
                                  kept={!!x.keptOn}
                                  focused={focusId === x.id}
                                  flash={flashId === x.id}
                                  phone={phone}
                                  asked={asked.has(x.id)}
                                  open={openTok?.id === x.id ? openTok.kind : null}
                                  onOpen={(kind) => setOpenTok(kind ? { id: x.id, kind } : null)}
                                  onPatch={(p) => patch(x.id, p)}
                                  onToggle={() => toggle(x.id)}
                                  onNudge={() => nudge(x)}
                                  onRemove={() => remove(x.id)}
                                  onFocus={() => setFocusId(x.id)}
                                  onTake={g.key === "nobody" ? () => patch(x.id, { owner: ME }) : undefined}
                                  draggable={!phone}
                                  onDragStart={() => setDragId(x.id)}
                                  onDragEnd={() => {
                                    setDragId(null);
                                    setDropOn(null);
                                  }}
                                />
                              ))}
                            </motion.ol>
                          )}
                        </AnimatePresence>
                        {dragId && dropOn === g.key && groupKeyOf(items.find((x) => x.id === dragId)!) !== g.key && (
                          <p className={s.dropHint}>Drop to hand it to {person?.name ?? "nobody yet"}</p>
                        )}
                      </section>
                    );
                  })}
                </LayoutGroup>
              )}

              {filter !== "all" && flat.length === 0 && (
                <p className={s.filterEmpty}>
                  Nothing here right now.{" "}
                  <button type="button" className={s.ledeLink} onClick={() => setFilter("all")}>
                    Show every promise
                  </button>
                </p>
              )}

              {/* ── Kept this week ─────────────────────────────── */}
              <section className={s.keptSection} aria-labelledby="c5-kept">
                <div className={s.keptHead}>
                  <span className={s.keptMark} aria-hidden>
                    <Icon.check size={14} strokeWidth={2} />
                  </span>
                  <span className={s.keptText}>
                    <h2 id="c5-kept" className={s.keptTitle}>
                      <button type="button" className={s.keptButton} onClick={() => setShowKept((v) => !v)} aria-expanded={showKept}>
                        Kept this week ({keptWeek.length})
                        <Icon.chevron className={`${s.groupChevron} ${showKept ? "" : s.groupChevronShut}`} />
                      </button>
                    </h2>
                    <span className={s.keptSummary}>
                      {keptByPerson.map((r) => `${r.p.name} ${r.n}`).join(", ") || "Nothing kept yet this week."}
                    </span>
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {showKept && (
                    <motion.ul
                      className={s.keptList}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      {[...keptWeek]
                        .sort((a, b) => (a.keptOn! > b.keptOn! ? -1 : 1))
                        .map((x) => {
                          const who = personById(x.owner);
                          return (
                            <li key={x.id} className={s.keptItem}>
                              <Avatar person={who} size={20} />
                              <p className={s.keptSentence}>
                                <strong>{who?.name ?? "Someone"}</strong> promised to {x.action}
                                {x.forWhom ? ` for ${x.forWhom}` : ""},{" "}
                                <span className={s.keptWhen}>kept {x.keptOn === TODAY ? "today" : relDay(x.keptOn!)}</span>.
                              </p>
                              <button type="button" className={s.reopen} onClick={() => toggle(x.id)}>
                                Reopen
                              </button>
                            </li>
                          );
                        })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>
            </main>

            {/* ── Right margin ─────────────────────────────────── */}
            <aside className={s.margin} aria-label="This week">
              <div className={s.marginCard}>
                <p className={s.marginEyebrow}>Friday check-in</p>
                <p className={s.marginBody}>Turn this page into a plain note for the team or a client.</p>
                <button type="button" className={s.primaryButton} onClick={() => setUpdateOpen(true)}>
                  <Icon.copy /> Copy as update
                </button>
                {sessionKept.size > 0 && (
                  <button type="button" className={s.linkButton} onClick={tidy}>
                    Tidy {plural(sessionKept.size, "kept promise")} away
                  </button>
                )}
              </div>

              <div className={s.marginBlock}>
                <h2 className={s.marginTitle}>Due soon</h2>
                <ol className={s.agenda}>
                  {agenda.map((a) => (
                    <li key={a.date} className={s.agendaDay}>
                      <span className={a.date === TODAY ? `${s.agendaDate} ${s.agendaToday}` : s.agendaDate}>{agendaLabel(a.date)}</span>
                      <ul className={s.agendaItems}>
                        {a.items.map((x) => (
                          <li key={x.id}>
                            <button
                              type="button"
                              className={s.agendaItem}
                              onClick={() => {
                                setFilter("all");
                                setFocusId(x.id);
                                flash(x.id);
                                scrollToItem(x.id);
                              }}
                            >
                              <Avatar person={personById(x.owner)} size={16} />
                              <span className={s.agendaText}>
                                <span className={s.agendaWho}>{personById(x.owner)?.name ?? "Nobody yet"}</span> {x.action}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={`${s.marginBlock} ${s.desktopOnly}`}>
                <h2 className={s.marginTitle}>Show</h2>
                {filterList}
              </div>

              <div className={`${s.marginBlock} ${s.desktopOnly}`}>
                <h2 className={s.marginTitle}>Keys</h2>
                <dl className={s.keys}>
                  <div><dt><kbd>N</kbd></dt><dd>New promise</dd></div>
                  <div><dt><kbd>J</kbd><kbd>K</kbd></dt><dd>Move down and up</dd></div>
                  <div><dt><kbd>X</kbd></dt><dd>Mark as kept</dd></div>
                  <div><dt><kbd>D</kbd><kbd>P</kbd><kbd>E</kbd></dt><dd>Change date, person, words</dd></div>
                </dl>
                <p className={s.marginFoot}>Drag a promise onto a name to hand it over.</p>
              </div>
            </aside>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={s.toast}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            >
              <span>{toast.msg}</span>
              {toast.undo && (
                <button
                  type="button"
                  className={s.toastUndo}
                  onClick={() => {
                    toast.undo?.();
                    setToast(null);
                  }}
                >
                  <Icon.undo size={14} /> Undo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <UpdatePreview
          open={updateOpen}
          phone={phone}
          items={items}
          onClose={() => setUpdateOpen(false)}
          onCopied={() => say("Update copied. Paste it wherever the team reads things.")}
        />
      </div>
    </MotionConfig>
  );
}
