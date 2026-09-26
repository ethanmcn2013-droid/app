"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, useReducedMotion } from "motion/react";
import { PROJECTS, type FileState, type KitFile, type Project } from "./data";
import * as I from "./icons";
import { DoneSpine, KitColumn } from "./Kit";
import { countdown, cx, dayOf, kitTone, plural, readiness, short, TODAY_DAY, type FileView, type KitView, type PackResult } from "./model";
import { PackDialog } from "./Pack";
import { AskDialog, Anytime, Peek, Switcher, Toast, type ProjectSummary, type ToastData } from "./Parts";
import { Ribbon } from "./Ribbon";
import p from "./page.module.css";

/**
 * Files, concept 2: Kit for the day.
 * Files line up by when they are needed. Each dated moment carries a kit,
 * and every kit shows what is ready, what is waiting and what is missing.
 */

type Patch = Partial<Pick<FileView, "state" | "note" | "who" | "updated" | "size" | "asked" | "droppedAs">>;

function applyPatch(f: KitFile, patches: Record<string, Patch>): FileView {
  const patch = patches[f.id];
  return patch ? { ...f, ...patch } : f;
}

function buildKits(project: Project, patches: Record<string, Patch>): KitView[] {
  return project.milestones
    .map((m) => {
      const files = m.files.map((f) => applyPatch(f, patches));
      const kit = { ...m, files, day: dayOf(m.date) };
      return { ...kit, tone: kitTone(m, files), r: readiness(files) };
    })
    .sort((a, b) => a.day - b.day);
}

function summarize(pr: Project): string {
  if (!pr.milestones.length) return "No dates yet";
  const kits = buildKits(pr, {});
  const upcoming = kits.filter((k) => k.day >= TODAY_DAY);
  const missing = kits.reduce((n, k) => n + k.r.missing, 0);
  return `${plural(upcoming.length, "kit")} ahead${missing ? `, ${missing} missing` : ", all in hand"}`;
}

const SUMMARIES: ProjectSummary[] = PROJECTS.map((pr) => ({
  id: pr.id,
  name: pr.name,
  kind: pr.kind,
  tone: pr.tone,
  initials: pr.initials,
  line: summarize(pr),
}));

const isPhone = () => window.matchMedia("(max-width: 720px)").matches;

function matches(f: FileView, q: string) {
  if (!q) return true;
  const s = `${f.name} ${f.note} ${f.task ?? ""} ${f.who ?? ""}`.toLowerCase();
  return s.includes(q);
}

export default function KitForTheDay() {
  const reduced = useReducedMotion() ?? false;
  const [projectId, setProjectId] = useState("wedding");
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const [packed, setPacked] = useState<Record<string, PackResult>>({});
  const [query, setQuery] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [openDone, setOpenDone] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<{ kitId: string | null; fileId: string } | null>(null);
  const [packFor, setPackFor] = useState<string | null>(null);
  const [askFor, setAskFor] = useState<{ kitId: string; fileId: string } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [landed, setLanded] = useState<Set<string>>(new Set());

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const kitEls = useRef(new Map<string, HTMLElement>());
  const toastTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);

  const project = PROJECTS.find((x) => x.id === projectId) ?? PROJECTS[0];
  const kits = useMemo(() => buildKits(project, patches), [project, patches]);
  const anytime = useMemo(() => project.anytime.map((f) => applyPatch(f, patches)), [project, patches]);
  const next = kits.find((k) => k.day >= TODAY_DAY) ?? null;
  const q = query.trim().toLowerCase();

  const view = useMemo(
    () =>
      kits.map((kit) => {
        const hit = kit.files.filter((f) => matches(f, q));
        const shown = notReady ? hit.filter((f) => f.state !== "ready") : hit;
        return { kit, shown, hidden: hit.length - shown.length, dim: !!q && hit.length === 0 };
      }),
    [kits, q, notReady],
  );
  const dimmed = useMemo(() => new Set(view.filter((v) => v.dim).map((v) => v.kit.id)), [view]);
  const hitCount = q ? view.reduce((n, v) => n + v.shown.length, 0) + anytime.filter((f) => matches(f, q)).length : 0;
  const notReadyCount = kits.reduce((n, k) => n + (k.r.total - k.r.ready), 0);

  /* ── Actions ────────────────────────────────────────────────────── */

  const say = useCallback((text: string, action?: ToastData["action"]) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, action });
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const jump = useCallback(
    (id: string) => {
      const el = kitEls.current.get(id);
      const sc = scrollerRef.current;
      if (!el) return;
      const behavior = reduced ? "auto" : "smooth";
      if (isPhone() || !sc) {
        el.scrollIntoView({ block: "start", behavior });
      } else {
        sc.scrollTo({ left: Math.max(0, el.offsetLeft - 4), behavior });
      }
      el.focus({ preventScroll: true });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      setFlash(id);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1300);
    },
    [reduced],
  );

  const goToday = useCallback(() => {
    if (next) jump(next.id);
  }, [jump, next]);

  const step = useCallback(
    (d: 1 | -1) => {
      const sc = scrollerRef.current;
      if (!sc || !kits.length) return;
      const left = sc.scrollLeft + 8;
      const offsets = kits.map((k) => ({ id: k.id, x: kitEls.current.get(k.id)?.offsetLeft ?? 0 }));
      const target = d === 1 ? offsets.find((o) => o.x > left) : [...offsets].reverse().find((o) => o.x < left - 12);
      if (target) jump(target.id);
      else if (d === -1) sc.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
    },
    [kits, jump, reduced],
  );

  const patch = (id: string, pt: Patch) => setPatches((cur) => ({ ...cur, [id]: { ...cur[id], ...pt } }));

  const land = (kitId: string, fileId: string, name: string) => {
    const kit = kits.find((k) => k.id === kitId);
    const file = kit?.files.find((f) => f.id === fileId);
    if (!kit || !file) return;
    patch(fileId, {
      state: "ready",
      note: "Added just now by you",
      who: "you",
      updated: "Just now",
      size: `${(name.length * 37) % 380 + 42} KB`,
      droppedAs: name !== file.name ? name : undefined,
    });
    setLanded((s) => new Set(s).add(fileId));
    window.setTimeout(() => {
      setLanded((s) => {
        const n = new Set(s);
        n.delete(fileId);
        return n;
      });
    }, 1700);
    const after = kit.r.ready + 1;
    say(after === kit.r.total ? `${file.name} landed. All set for ${kit.kitName}` : `${file.name} landed in ${kit.title.toLowerCase()}, ${after} of ${kit.r.total} ready`);
  };

  const setFileState = (fileId: string, state: FileState) => {
    const kit = kits.find((k) => k.files.some((f) => f.id === fileId));
    const file = kit?.files.find((f) => f.id === fileId);
    if (!file) return;
    const prev = { state: file.state, note: file.note };
    patch(fileId, { state, note: state === "ready" ? "Signed off by you just now" : "Moved back to draft" });
    if (state === "ready") {
      setLanded((s) => new Set(s).add(fileId));
      window.setTimeout(() => setLanded((s) => new Set([...s].filter((x) => x !== fileId))), 1700);
    }
    say(state === "ready" ? `${file.name} marked ready` : `${file.name} moved back to draft`, {
      label: "Undo",
      run: () => patch(fileId, prev),
    });
  };

  const pickProject = (id: string) => {
    setProjectId(id);
    setPeek(null);
    setQuery("");
    setOpenDone(new Set());
    scrollerRef.current?.scrollTo({ left: 0 });
    rootRef.current?.scrollTo({ top: 0 });
  };

  /* ── Peek helpers ───────────────────────────────────────────────── */

  const peekKit = peek?.kitId ? (kits.find((k) => k.id === peek.kitId) ?? null) : null;
  const peekList = useMemo<FileView[]>(() => (peek ? (peekKit ? peekKit.files : anytime) : []), [peek, peekKit, anytime]);
  const peekIdx = peek ? peekList.findIndex((f) => f.id === peek.fileId) : -1;
  const peekFile = peekIdx >= 0 ? peekList[peekIdx] : null;

  const stepPeek = useCallback(
    (d: 1 | -1) => {
      if (!peek || !peekList.length) return;
      const i = (peekIdx + d + peekList.length) % peekList.length;
      setPeek({ kitId: peek.kitId, fileId: peekList[i].id });
    },
    [peek, peekList, peekIdx],
  );

  /* ── Keyboard ───────────────────────────────────────────────────── */

  const modal = !!packFor || !!askFor;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        if (packFor) setPackFor(null);
        else if (askFor) setAskFor(null);
        else if (peek) setPeek(null);
        else if (typing && t === searchRef.current) {
          setQuery("");
          searchRef.current?.blur();
        }
        return;
      }
      if (typing || modal || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "t" || e.key === "T") {
        goToday();
      } else if (peek && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        stepPeek(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [packFor, askFor, peek, modal, goToday, step, stepPeek]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // Size the kit columns so the last one in view is whole or a clear peek, never a sliver,
  // and fade whichever edge has more to scroll to. Direct DOM writes: runs on resize and scroll.
  const hasKits = kits.length > 0;
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const size = () => {
      if (isPhone()) {
        sc.style.removeProperty("--kit-w");
        return;
      }
      const stub = sc.querySelector<HTMLElement>("[data-stub]");
      const avail = sc.clientWidth - 8 - (stub ? stub.offsetWidth + 12 : 0);
      // Whole columns plus a peek of about 40% of the next; at least 248px each.
      let w = 280;
      for (let n = 4; n >= 1; n--) {
        const fit = (avail - n * 12) / (n + 0.38);
        if (fit >= 248) {
          w = Math.min(fit, 360);
          break;
        }
      }
      sc.style.setProperty("--kit-w", `${Math.floor(w)}px`);
    };
    const edges = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      sc.dataset.fadeLeft = sc.scrollLeft > 4 ? "true" : "false";
      sc.dataset.fadeRight = sc.scrollLeft < max - 4 ? "true" : "false";
    };
    size();
    edges();
    const ro = new ResizeObserver(() => {
      size();
      edges();
    });
    ro.observe(sc);
    sc.addEventListener("scroll", edges, { passive: true });
    return () => {
      ro.disconnect();
      sc.removeEventListener("scroll", edges);
    };
  }, [hasKits, projectId, openDone]);

  // Phone: the Today pill shows when scrolling back up, and never while the next kit is in view.
  const [pillShown, setPillShown] = useState(false);
  const nextId = next?.id ?? null;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const el = nextId ? kitEls.current.get(nextId) : null;
    let inView = false;
    let lastY = root.scrollTop;
    const io = el
      ? new IntersectionObserver(
          ([e]) => {
            inView = e.isIntersecting;
            if (inView) setPillShown(false);
          },
          { root },
        )
      : null;
    if (el && io) io.observe(el);
    const onScroll = () => {
      const y = root.scrollTop;
      if (Math.abs(y - lastY) < 6) return;
      setPillShown(y < lastY && !inView && y > 120);
      lastY = y;
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io?.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [nextId]);

  /* ── Header sentence ────────────────────────────────────────────── */

  const lede = (() => {
    if (!kits.length) return <>No dates yet. Everything sits in Anytime until a task gets a date.</>;
    const overdue = kits.filter((k) => k.tone === "overdue");
    return (
      <>
        {overdue.length > 0 && (
          <span className={p.ledeWarn}>
            {overdue.length === 1 ? (
              <>
                <b>{overdue[0].title}</b> is {TODAY_DAY - overdue[0].day} days late.
              </>
            ) : (
              `${overdue.length} kits are late.`
            )}{" "}
          </span>
        )}
        {next ? (
          <>
            <b>{next.title}</b> is next, {countdown(next.day)}
            {next.r.complete ? ", and ready." : `, with ${plural(next.r.total - next.r.ready, "file")} to go.`}
          </>
        ) : (
          "Nothing else is dated yet."
        )}
      </>
    );
  })();

  const packKit = packFor ? kits.find((k) => k.id === packFor) : null;
  const askKit = askFor ? kits.find((k) => k.id === askFor.kitId) : null;
  const askFile = askKit?.files.find((f) => f.id === askFor?.fileId);

  return (
    <MotionConfig reducedMotion="user">
    <div className={p.root} ref={rootRef} style={{ ["--pj" as string]: `var(--v3-project-${project.tone})` }}>
      <div className={p.inner}>
        <header className={p.header}>
          <Switcher current={project} all={SUMMARIES} onPick={pickProject} />
          <div className={p.titleRow}>
            <h1 className={p.h1}>Files</h1>
            <div className={p.tools}>
              <label className={p.search}>
                <I.Search size={15} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a file, person or task"
                  aria-label="Find a file, person or task"
                />
                {q ? <span className={p.segCount}>{hitCount}</span> : <kbd className={p.kbd}>/</kbd>}
              </label>
              <div className={p.seg} role="group" aria-label="Show">
                <button type="button" className={cx(p.segBtn, !notReady && p.segOn)} aria-pressed={!notReady} onClick={() => setNotReady(false)}>
                  Everything
                </button>
                <button type="button" className={cx(p.segBtn, notReady && p.segOn)} aria-pressed={notReady} onClick={() => setNotReady(true)}>
                  Not ready <span className={p.segCount}>{notReadyCount}</span>
                </button>
              </div>
              {kits.length > 0 && (
                <button type="button" className={cx(p.btn, p.todayBtn)} onClick={goToday} title="Jump to the next kit (T)">
                  <I.Target size={14} /> Today <kbd className={p.kbd}>T</kbd>
                </button>
              )}
            </div>
          </div>
          <p className={p.lede}>{lede}</p>
        </header>

        {kits.length > 0 ? (
          <>
            <div className={p.ribbonWrap}>
              <Ribbon
                kits={kits}
                scrollerRef={scrollerRef}
                onJump={jump}
                hovered={hover}
                onHover={setHover}
                dimmed={dimmed}
                nextId={next?.id ?? null}
                tone={project.tone}
                reduced={reduced}
              />
            </div>

            <div className={p.bodyKits}>
              <section aria-labelledby="kits-title" style={{ minWidth: 0 }}>
                <div className={p.kitsHead}>
                  <h2 id="kits-title" className={p.kitsTitle}>
                    Kits <span>· {plural(kits.length, "date")} · {plural(kits.reduce((n, k) => n + k.files.length, 0), "file")}</span>
                  </h2>
                  <div className={p.kitsNav}>
                    <button type="button" className={p.chipBtn} onClick={() => jump("anytime")} title="Reference files with no date">
                      <I.Stack size={13} /> Anytime <span className={p.segCount}>{anytime.length}</span>
                    </button>
                    <span className={p.navSep} aria-hidden="true" />
                    <button type="button" className={p.iconBtn} onClick={() => step(-1)} aria-label="Earlier kits" title="Earlier kits (←)">
                      <I.ChevronLeft size={15} />
                    </button>
                    <button type="button" className={p.iconBtn} onClick={() => step(1)} aria-label="Later kits" title="Later kits (→)">
                      <I.ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className={p.scrollerWrap}>
                  <div className={p.scroller} ref={scrollerRef}>
                    <div className={p.track}>
                      {view.map(({ kit, shown, hidden, dim }, index) => {
                        const setRef = (el: HTMLElement | null) => {
                          if (el) kitEls.current.set(kit.id, el);
                          else kitEls.current.delete(kit.id);
                        };
                        if (kit.tone === "done" && !openDone.has(kit.id) && !q) {
                          return <DoneSpine key={kit.id} kit={kit} setRef={setRef} onOpen={() => setOpenDone((s) => new Set(s).add(kit.id))} />;
                        }
                        return (
                          <KitColumn
                            key={kit.id}
                            kit={kit}
                            shown={shown}
                            hidden={hidden}
                            isNext={kit.id === next?.id}
                            dim={dim}
                            flash={flash === kit.id}
                            hovered={hover === kit.id}
                            packed={packed[kit.id]}
                            selectedFileId={peek?.kitId === kit.id ? peek.fileId : null}
                            landed={landed}
                            index={index}
                            setRef={setRef}
                            onHover={setHover}
                            onPack={() => setPackFor(kit.id)}
                            onCollapse={
                              kit.tone === "done"
                                ? () =>
                                    setOpenDone((s) => {
                                      const n = new Set(s);
                                      n.delete(kit.id);
                                      return n;
                                    })
                                : undefined
                            }
                            onOpen={(fileId) => setPeek({ kitId: kit.id, fileId })}
                            onAsk={(fileId) => setAskFor({ kitId: kit.id, fileId })}
                            onLand={(fileId, name) => land(kit.id, fileId, name)}
                          />
                        );
                      })}
                      <Anytime
                        project={project}
                        files={q ? anytime.filter((f) => matches(f, q)) : anytime}
                        selected={peek?.kitId === null ? peek.fileId : null}
                        onOpen={(id) => setPeek({ kitId: null, fileId: id })}
                        setRef={(el) => {
                          if (el) kitEls.current.set("anytime", el);
                          else kitEls.current.delete("anytime");
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <button type="button" className={p.todayPill} data-shown={pillShown} onClick={goToday} tabIndex={pillShown ? 0 : -1} aria-hidden={!pillShown}>
              <I.Target size={16} /> Today <span>· {next ? `${next.title}, ${countdown(next.day)}` : short(TODAY_DAY)}</span>
            </button>
          </>
        ) : (
          <>
            <div className={p.ribbonWrap}>
              <div className={p.emptyRibbon}>
                <div className={p.emptyAxis} aria-hidden="true" />
                {[18, 44, 71].map((x) => (
                  <span key={x} className={p.emptyPin} style={{ left: `${x}%` }} aria-hidden="true" />
                ))}
                <h2 className={p.emptyTitle}>No dates yet</h2>
                <p className={p.emptyText}>Add a date to a task and its files line up here.</p>
              </div>
            </div>
            <div className={p.body}>
              <Anytime project={project} files={anytime} selected={peek?.kitId === null ? peek.fileId : null} onOpen={(id) => setPeek({ kitId: null, fileId: id })} wide />
              <div className={p.ghostKits}>
                <div className={cx(p.ghostKit, p.ghostKitLead)}>
                  <h3>Kits appear once there&rsquo;s a date</h3>
                  <p>Each dated task becomes a moment on the ribbon, with a kit of the files it needs. Missing ones show up as placeholders you can ask for.</p>
                  <ol className={p.ghostSteps}>
                    <li>
                      <span className={p.stepNum}>1</span> Give a task a date, like the tasting
                    </li>
                    <li>
                      <span className={p.stepNum}>2</span> Its files move out of Anytime into a kit
                    </li>
                    <li>
                      <span className={p.stepNum}>3</span> Pack the kit when the day comes
                    </li>
                  </ol>
                  <div>
                    <button type="button" className={p.btnPrimary}>
                      <I.Calendar size={14} /> Open tasks
                    </button>
                  </div>
                </div>
                {[0, 1].map((i) => (
                  <div key={i} className={p.ghostKit} aria-hidden="true">
                    <div className={p.ghostBar} style={{ width: "40%" }} />
                    <div className={p.ghostBar} style={{ width: "70%", height: 14 }} />
                    <div className={p.ghostBar} style={{ width: "100%", height: 6, marginTop: 8 }} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {peekFile && (
          <Peek
            key="peek"
            file={peekFile}
            kit={peekKit}
            index={peekIdx}
            count={peekList.length}
            onClose={() => setPeek(null)}
            onStep={stepPeek}
            onSetState={(s) => setFileState(peekFile.id, s)}
            onAsk={() => peekKit && setAskFor({ kitId: peekKit.id, fileId: peekFile.id })}
            onLand={(name) => peekKit && land(peekKit.id, peekFile.id, name)}
            onNudge={() => say(`Nudged ${peekFile.who} about the ${peekFile.name.toLowerCase()}`)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {packKit && (
          <PackDialog
            key={packKit.id}
            kit={packKit}
            tone={project.tone}
            reduced={reduced}
            existing={packed[packKit.id]}
            onClose={() => setPackFor(null)}
            onPacked={(r) => {
              setPacked((cur) => ({ ...cur, [packKit.id]: r }));
              say(`Kit for ${packKit.kitName} is ready to share`, r.mode === "link" ? { label: "Copy link", run: () => navigator.clipboard?.writeText(`https://${r.url}`).catch(() => {}) } : undefined);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {askKit && askFile && (
          <AskDialog
            key={askFile.id}
            file={askFile}
            kit={askKit}
            onClose={() => setAskFor(null)}
            onSend={() => {
              patch(askFile.id, { asked: true });
              setAskFor(null);
              say(`Request sent to ${askFile.who}. It lands here when they reply`);
            }}
          />
        )}
      </AnimatePresence>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
    </MotionConfig>
  );
}
