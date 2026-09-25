"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Art, hueVar } from "./art";
import { AnatomyFigure } from "./anatomy";
import { PROJECTS, projectById, toolById, type ProjectId, type Row, type Story, type ToolId } from "./data";
import { ArrowRight, CheckIcon, ChevronDown, CloseIcon, ToolTile, UndoIcon } from "./glyphs";
import styles from "./c3.module.css";

export type Enabled = Partial<Record<ToolId, ProjectId[]>>;
export type Bounds = { top: number; left: number; width: number; height: number } | null;

const onFor = (enabled: Enabled, tool: ToolId) => enabled[tool] ?? [];

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ── the Project picker ───────────────────────────────────────────── */

function ProjectPicker({ value, tool, enabled, onPick }: { value: ProjectId; tool: ToolId; enabled: Enabled; onPick: (p: ProjectId) => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const p = projectById(value);
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  return (
    <div className={styles.picker}>
      <button
        ref={btn}
        type="button"
        className={styles.pickerButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Project: ${p.name}`}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>("[aria-selected='true']")?.focus());
        }}
      >
        <span className={styles.swatch} style={{ background: hueVar(p.hue) }} aria-hidden />
        <span className={styles.pickerName}>{p.name}</span>
        <ChevronDown />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className={styles.menuScrim} onClick={() => setOpen(false)} aria-hidden />
            <motion.ul
              ref={list}
              className={styles.pickerList}
              role="listbox"
              aria-label="Choose a Project"
              onKeyDown={onKey}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.16 }}
            >
              {PROJECTS.map((option) => {
                const already = onFor(enabled, tool).includes(option.id);
                return (
                  <li key={option.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.id === value}
                      className={styles.pickerOption}
                      onClick={() => {
                        onPick(option.id);
                        close();
                      }}
                    >
                      <span className={styles.swatch} style={{ background: hueVar(option.hue) }} aria-hidden />
                      <span className={styles.pickerText}>
                        <span className={styles.pickerOptName}>{option.name}</span>
                        <span className={styles.pickerKind}>{already ? `${toolById(tool).name} is on here` : option.kind}</span>
                      </span>
                      {option.id === value && (
                        <span className={styles.pickerCheck}>
                          <CheckIcon size={14} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── the specimen: their example, or yours ────────────────────────── */

function Specimen({ story, project, isOn }: { story: Story; project: ProjectId | null; isOn: boolean }) {
  const yours = project ? story.specimen.yours[project] : null;
  const rows: Row[] = yours && yours.rows.length ? yours.rows : story.specimen.rows;
  const title = yours && yours.rows.length ? yours.title : story.specimen.title;
  const variant = yours && yours.rows.length ? project! : "theirs";
  const reduce = useReducedMotion();
  const tool = toolById(story.primary);
  const state = variant === "theirs" ? "theirs" : isOn ? "on" : "preview";
  return (
    <div className={`${styles.specimen} ${state === "preview" ? styles.specimenPreview : ""} ${state === "on" ? styles.specimenOn : ""}`}>
      <div className={styles.specimenHead}>
        <ToolTile id={story.primary} size="sm" />
        <div className={styles.specimenTitles}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={title}
              className={styles.specimenTitle}
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{ duration: 0.2 }}
            >
              {title}
            </motion.span>
          </AnimatePresence>
          <span className={styles.specimenSub}>
            {state === "theirs" ? `Their ${tool.name.toLowerCase()}, as it was on the day` : state === "preview" ? `Made from what is already in ${projectById(project!).name}. Nothing is saved.` : `${tool.name} is on for ${projectById(project!).name}`}
          </span>
        </div>
        {state === "preview" && <span className={styles.previewTag}>Preview</span>}
        {state === "on" && (
          <span className={styles.onTag}>
            <CheckIcon /> On
          </span>
        )}
      </div>
      <div className={styles.specimenCols} aria-hidden>
        {story.specimen.columns.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <ol className={styles.specimenRows} aria-live="polite">
        {rows.map((r, i) => (
          <li key={i} className={styles.specimenRowSlot}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${variant}-${i}`}
                className={`${styles.specimenRow} ${r.tone === "late" ? styles.rowLate : ""} ${variant !== "theirs" ? styles.rowFresh : ""}`}
                style={{ animationDelay: `${i * 70 + 120}ms` } as CSSProperties}
                initial={{ opacity: 0, filter: reduce ? "none" : "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)", transition: { duration: 0.28, delay: reduce ? 0 : i * 0.07 } }}
                exit={{ opacity: 0, filter: reduce ? "none" : "blur(3px)", transition: { duration: 0.16, delay: reduce ? 0 : i * 0.07 } }}
              >
                <span className={styles.cellA}>{r.a}</span>
                <span className={styles.cellB}>
                  {r.b}
                  {r.tone === "late" && <span className={styles.lateTag}>Running late</span>}
                </span>
                <span className={styles.cellC}>
                  {r.tone === "shared" && <span className={styles.sharedDot} title="Sees only their steps" aria-label="Supplier link" />}
                  {r.c}
                </span>
                {r.tone === "wait" && <span className={styles.waitMark} aria-label="Waiting" />}
                {r.tone === "done" && (
                  <span className={styles.doneMark} aria-label="Done">
                    <CheckIcon size={10} />
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── the reader ───────────────────────────────────────────────────── */

type Props = {
  story: Story;
  enabled: Enabled;
  bounds: Bounds;
  phone: boolean;
  onClose: () => void;
  onTurnOn: (tool: ToolId, project: ProjectId) => void;
  onUndo: (tool: ToolId, project: ProjectId) => void;
};

export function StoryReader({ story, enabled, bounds, phone, onClose, onTurnOn, onUndo }: Props) {
  const tool = toolById(story.primary);
  const used = onFor(enabled, story.primary);
  const firstFree = PROJECTS.find((p) => !used.includes(p.id))?.id ?? PROJECTS[0].id;
  const [picked, setPicked] = useState<ProjectId>(firstFree);
  const [trying, setTrying] = useState<ProjectId | null>(null);
  const [justOn, setJustOn] = useState<ProjectId | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const specimenRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const coreUsed = tool.status === "core" && used.length > 0;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tryOn = (p: ProjectId) => {
    setPicked(p);
    setTrying(p);
    setJustOn(null);
    requestAnimationFrame(() => {
      const el = specimenRef.current;
      const sc = scroller.current;
      if (!el || !sc) return;
      const r = el.getBoundingClientRect();
      const s = sc.getBoundingClientRect();
      const visible = r.top >= s.top + 40 && r.bottom <= s.bottom - 90;
      if (!visible) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  const startDrag = (e: ReactPointerEvent) => {
    if (phone && (scroller.current?.scrollTop ?? 0) <= 2) drag.start(e);
  };

  const style: CSSProperties = bounds && !phone ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height } : {};
  const tryingIsOn = trying ? used.includes(trying) : false;

  let footer: ReactNode;
  if (coreUsed) {
    footer = (
      <>
        <span className={styles.footNote}>
          <span className={styles.footTick}>
            <CheckIcon />
          </span>
          You use {tool.name} on {plural(used.length, "Project")}
        </span>
        <button type="button" className={styles.btnPrimary}>
          Open {tool.name}
          <ArrowRight />
        </button>
      </>
    );
  } else if (justOn) {
    footer = (
      <>
        <span className={styles.footNote} role="status">
          <span className={styles.footTick}>
            <CheckIcon />
          </span>
          {tool.name} is on for {projectById(justOn).name}. Nothing else changed.
        </span>
        <span className={styles.footActions}>
          <button
            type="button"
            className={styles.btnQuiet}
            onClick={() => {
              onUndo(story.primary, justOn);
              setJustOn(null);
            }}
          >
            <UndoIcon /> Undo
          </button>
          <button type="button" className={styles.btnPrimary}>
            Open {tool.name}
            <ArrowRight />
          </button>
        </span>
      </>
    );
  } else if (trying && !tryingIsOn) {
    footer = (
      <>
        <span className={styles.footNoteQuiet}>This is a preview. Nothing is saved until you turn it on.</span>
        <span className={styles.footActions}>
          <ProjectPicker value={picked} tool={story.primary} enabled={enabled} onPick={tryOn} />
          <button type="button" className={styles.btnQuiet} onClick={() => setTrying(null)}>
            Show theirs
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              onTurnOn(story.primary, trying);
              setJustOn(trying);
            }}
          >
            Turn on {tool.name} for {projectById(trying).short}
          </button>
        </span>
      </>
    );
  } else if (trying && tryingIsOn) {
    footer = (
      <>
        <span className={styles.footNote}>
          {tool.name} is already on for {projectById(trying).name}.
        </span>
        <span className={styles.footActions}>
          <ProjectPicker value={picked} tool={story.primary} enabled={enabled} onPick={tryOn} />
          <button type="button" className={styles.btnPrimary}>
            Open {tool.name}
            <ArrowRight />
          </button>
        </span>
      </>
    );
  } else {
    footer = (
      <>
        <span className={styles.footLabel}>
          Try this on
          {used.length > 0 && <span className={styles.footUsed}> · on for {plural(used.length, "Project")} already</span>}
        </span>
        <span className={styles.footActions}>
          <ProjectPicker value={picked} tool={story.primary} enabled={enabled} onPick={tryOn} />
          <button type="button" className={styles.btnPrimary} onClick={() => tryOn(picked)}>
            Try it
          </button>
        </span>
      </>
    );
  }

  const [s1, s2, s3] = story.sections;
  const hue = { "--hue": hueVar(story.hue) } as CSSProperties;

  return (
    <motion.div
      className={`${styles.readerLayer} ${phone ? styles.readerLayerPhone : ""}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`story-${story.id}-title`}
      initial={{ opacity: phone ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: phone ? 1 : 0, transition: { duration: 0.2, delay: 0.1 } }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={styles.reader}
        drag={phone ? "y" : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={onDragEnd}
        initial={phone ? { y: reduce ? 0 : "100%" } : false}
        animate={{ y: 0 }}
        exit={phone ? { y: reduce ? 0 : "100%" } : undefined}
        transition={{ type: "spring", damping: 34, stiffness: 320 }}
        style={hue}
      >
        <div className={styles.readerBar} onPointerDown={startDrag}>
          {phone && <span className={styles.grabber} aria-hidden />}
          <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose}>
            <CloseIcon />
            <span>{phone ? "Close" : "Back to Apps and tools"}</span>
          </button>
          <span className={styles.readerBarMeta}>{plural(story.minutes, "minute")} to read</span>
        </div>

        <div ref={scroller} className={styles.readerScroll}>
          <header className={styles.readerHead}>
            <motion.div layoutId={`art-${story.id}`} className={styles.readerArt} onPointerDown={startDrag} style={hue}>
              <Art id={story.id} hue={story.hue} />
            </motion.div>
            <motion.div
              className={styles.measure}
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12 }}
            >
              <p className={styles.readerTools}>
                {story.tools.map((t) => (
                  <span key={t} className={styles.toolChip}>
                    <ToolTile id={t} size="sm" />
                    {toolById(t).name}
                  </span>
                ))}
              </p>
              <h2 id={`story-${story.id}-title`} className={styles.readerTitle}>
                {story.headline}
              </h2>
              <p className={styles.readerDek}>{story.dek}</p>
              <p className={styles.byline}>
                <span className={styles.teamMark} style={{ background: hueVar(story.hue) }} aria-hidden>
                  {story.team}
                </span>
                <span>
                  <span className={styles.bylineName}>{story.byline}</span>
                  <span className={styles.bylineMeta}>Told to the Signal Studio team, September</span>
                </span>
              </p>
            </motion.div>
          </header>

          <div className={styles.measure}>
            <StorySection s={s1} />
          </div>
          <div className={styles.wide}>
            <AnatomyFigure story={story} />
          </div>
          <div className={styles.measure}>
            <StorySection s={s2} />
          </div>
          <div className={styles.wide} ref={specimenRef}>
            <div className={styles.specimenIntro}>
              <h3 className={styles.specimenHeading}>{coreUsed ? "From their notes" : "Their page, and yours"}</h3>
              {!coreUsed && <p className={styles.specimenLede}>Pick one of your Projects below and this page rewrites itself with your own names and times. Nothing is saved.</p>}
            </div>
            <Specimen story={story} project={coreUsed ? null : trying} isOn={!!trying && used.includes(trying)} />
          </div>
          <div className={styles.measure}>
            <StorySection s={s3} />
            <aside className={styles.inStory}>
              <h3 className={styles.inStoryTitle}>Tools in this story</h3>
              <ul className={styles.inStoryList}>
                {story.tools.map((t) => {
                  const tt = toolById(t);
                  const n = onFor(enabled, t).length;
                  return (
                    <li key={t} className={styles.inStoryRow}>
                      <ToolTile id={t} />
                      <span className={styles.inStoryText}>
                        <span className={styles.inStoryName}>{tt.name}</span>
                        <span className={styles.inStoryLine}>{tt.line}</span>
                      </span>
                      <span className={n ? styles.stateOn : styles.stateOff}>
                        {n ? (
                          <>
                            <CheckIcon /> On for {plural(n, "Project")}
                          </>
                        ) : (
                          "Not on yet"
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
          <div className={styles.readerEnd} aria-hidden />
        </div>

        <div className={styles.tryBar} style={hue}>
          <div className={styles.tryInner}>{footer}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StorySection({ s }: { s: Story["sections"][number] }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{s.heading}</h3>
      {s.body.map((p) => (
        <p key={p.slice(0, 24)} className={styles.para}>
          {p}
        </p>
      ))}
      {s.quote && (
        <blockquote className={styles.pull}>
          <p>{s.quote.text}</p>
          <footer>{s.quote.who}</footer>
        </blockquote>
      )}
    </section>
  );
}
