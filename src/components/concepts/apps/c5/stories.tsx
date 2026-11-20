"use client";

/* Browse ideas: the calm way in when you do not know what to ask for. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { projectById, toolById, type ProjectId, type ToolId } from "./data";
import { STORIES, storyById, yoursFor, type Row, type Story, type StoryId } from "./story-data";
import type { Live } from "./sources";
import { cx } from "./ctx";
import { useFocusTrap } from "./trap";
import { ToolTile } from "./chrome";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloseIcon } from "./glyphs";
import a from "./ask.module.css";

const hue = (n: number) => `var(--v3-project-${n})`;

type Props = {
  project: ProjectId;
  live: Live;
  on: ToolId[];
  isOpen: (tool: ToolId) => boolean;
  phone: boolean;
  onClose: () => void;
  onAdd: (tool: ToolId) => void;
  onShow: (tool: ToolId) => void;
};

export function IdeasDrawer({ project, live, on, isOpen, phone, onClose, onAdd, onShow }: Props) {
  const reduced = useReducedMotion();
  const [storyId, setStoryId] = useState<StoryId | null>(null);
  const [trying, setTrying] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const story = storyId ? storyById(storyId) : null;

  /* A real modal: Tab stays inside, and focus goes back to Browse ideas when it closes. */
  useFocusTrap(dialogRef, {
    initial: () => closeRef.current,
    restore: (opener) => (opener?.getAttribute("role") === "combobox" ? document.querySelector<HTMLElement>("[data-browse]") : opener),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (storyId) backRef.current?.focus({ preventScroll: true });
  }, [storyId]);

  const back = () => {
    const was = storyId;
    setStoryId(null);
    setTrying(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-story="${was}"]`)?.focus({ preventScroll: true }));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onClose();
  };

  const p = projectById(project);

  return (
    <motion.div className={cx(a.scrim, phone && a.phone)} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onKeyDown={onKey}>
      <motion.aside
        ref={dialogRef}
        className={a.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Ideas from teams like yours"
        onClick={(e) => e.stopPropagation()}
        initial={phone ? { y: reduced ? 0 : "100%" } : { x: reduced ? 0 : 40, opacity: 0 }}
        animate={phone ? { y: 0 } : { x: 0, opacity: 1 }}
        exit={phone ? { y: reduced ? 0 : "100%" } : { x: reduced ? 0 : 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
      >
        <div className={a.drawerBar}>
          {story ? (
            <button ref={backRef} type="button" className={a.backBtn} onClick={back}>
              <ArrowLeftIcon size={16} /> All ideas
            </button>
          ) : (
            <h2 id="c5-ideas-title" className={a.drawerTitle}>
              Ideas from teams like yours
            </h2>
          )}
          <button ref={closeRef} type="button" className={a.iconBtn} onClick={onClose} aria-label="Close ideas">
            <CloseIcon size={17} />
          </button>
        </div>

        <div ref={scrollRef} className={a.drawerScroll}>
          <AnimatePresence mode="wait" initial={false}>
            {story ? (
              <motion.div key={story.id} initial={{ opacity: 0, x: reduced ? 0 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -10 }} transition={{ duration: 0.22 }}>
                <Reader story={story} project={project} live={live} trying={trying} onTry={setTrying} />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0, x: reduced ? 0 : -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <p className={a.drawerLead}>Short stories of how other teams work. Try any of their pages on {p.name} before you add it.</p>
                <ul className={a.storyList}>
                  {STORIES.map((s, i) => (
                    <li key={s.id}>
                      <StoryCard story={s} lead={i === 0} onOpen={() => setStoryId(s.id)} />
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {story && (
          <TryBar
            story={story}
            project={project}
            trying={trying}
            open={isOpen(story.primary)}
            isOn={on.includes(story.primary)}
            onTry={(v) => {
              setTrying(v);
              requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>("[data-specimen]")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }));
            }}
            onAdd={() => {
              onClose();
              onAdd(story.primary);
            }}
            onShow={() => {
              onClose();
              onShow(story.primary);
            }}
          />
        )}
      </motion.aside>
    </motion.div>
  );
}

/* ── the list ───────────────────────────────────────────────────── */

function StoryCard({ story, lead, onOpen }: { story: Story; lead: boolean; onOpen: () => void }) {
  const style = { "--story": hue(story.hue) } as CSSProperties;
  return (
    <button type="button" data-story={story.id} className={cx(a.card, lead && a.cardLead)} style={style} onClick={onOpen}>
      {lead && (
        <span className={a.cardSheet} aria-hidden="true">
          {story.theirs.rows.slice(2, 6).map((r) => (
            <span key={r.a} className={cx(a.cardSheetRow, r.tone === "late" && a.cardSheetLate)}>
              <span className={a.num}>{r.a}</span>
              <span>
                {r.b}
                {r.tone === "late" && ", running late"}
              </span>
            </span>
          ))}
        </span>
      )}
      <span className={a.cardBody}>
        <span className={a.cardTools}>
          {story.tools.map((t) => (
            <span key={t} className={a.cardTool}>
              <ToolTile tool={t} size={18} />
              {toolById(t).name}
            </span>
          ))}
        </span>
        <span className={a.cardTitle}>{story.headline}</span>
        {lead && <span className={a.cardDek}>{story.dek}</span>}
        <span className={a.cardFoot}>
          <span className={a.cardMark} aria-hidden="true">
            {story.mark}
          </span>
          <span className={a.cardBy}>{story.byline}</span>
          <span className={a.cardRead}>
            {story.minutes} minutes to read <ArrowRightIcon size={14} />
          </span>
        </span>
      </span>
    </button>
  );
}

/* ── the story ──────────────────────────────────────────────────── */

function Reader({ story, project, live, trying, onTry }: { story: Story; project: ProjectId; live: Live; trying: boolean; onTry: (v: boolean) => void }) {
  const [s1, s2, s3] = story.sections;
  const style = { "--story": hue(story.hue) } as CSSProperties;
  return (
    <article className={a.reader} style={style} aria-labelledby={`c5-story-${story.id}`}>
      <p className={a.cardTools}>
        {story.tools.map((t) => (
          <span key={t} className={a.cardTool}>
            <ToolTile tool={t} size={18} />
            {toolById(t).name}
          </span>
        ))}
      </p>
      <h2 id={`c5-story-${story.id}`} className={a.readerTitle}>
        {story.headline}
      </h2>
      <p className={a.readerDek}>{story.dek}</p>
      <p className={a.byline}>
        <span className={a.cardMark} aria-hidden="true">
          {story.mark}
        </span>
        {story.byline}
      </p>

      <StorySection s={s1} />
      <StorySection s={s2} />
      <Specimen story={story} project={project} live={live} trying={trying} onTry={onTry} />
      <StorySection s={s3} />
    </article>
  );
}

function StorySection({ s }: { s: Story["sections"][number] }) {
  return (
    <section className={a.section}>
      <h3 className={a.sectionHead}>{s.heading}</h3>
      {s.body.map((x) => (
        <p key={x.slice(0, 20)} className={a.para}>
          {x}
        </p>
      ))}
      {s.quote && (
        <blockquote className={a.quote}>
          <p>{s.quote.text}</p>
          <footer>{s.quote.who}</footer>
        </blockquote>
      )}
    </section>
  );
}

/* ── their page, and yours ──────────────────────────────────────── */

function Specimen({ story, project, live, trying, onTry }: { story: Story; project: ProjectId; live: Live; trying: boolean; onTry: (v: boolean) => void }) {
  const reduced = useReducedMotion();
  const p = projectById(project);
  const yours = yoursFor(story, project, live);
  const view = trying ? ("rows" in yours ? yours : null) : story.theirs;
  const choices = [
    { v: false, label: "Theirs" },
    { v: true, label: `Yours, from ${p.name}` },
  ];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? false : e.key === "End" ? true : !trying;
    onTry(next);
    requestAnimationFrame(() => e.currentTarget?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <section className={a.specimen} aria-labelledby={`c5-spec-${story.id}`} data-specimen="">
      <div className={a.specHead}>
        <h3 id={`c5-spec-${story.id}`} className={a.specTitle}>
          Their page, and yours
        </h3>
        <div className={a.seg} role="radiogroup" aria-label="Whose page to show" onKeyDown={onKey}>
          {choices.map((c) => (
            <button key={c.label} type="button" role="radio" aria-checked={trying === c.v} tabIndex={trying === c.v ? 0 : -1} className={cx(a.segBtn, trying === c.v && a.segOn)} onClick={() => onTry(c.v)}>
              {trying === c.v && <motion.span layoutId={`c5-seg-${story.id}`} className={a.segBg} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className={a.segLabel}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cx(a.sheet, trying && a.sheetYours)}>
        <div className={a.sheetTop}>
          <ToolTile tool={story.primary} size={22} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={view?.title ?? "empty"} className={a.sheetTitle} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
              {view?.title ?? `${toolById(story.primary).name} for ${p.name}`}
            </motion.span>
          </AnimatePresence>
          {trying && <span className={a.frameTag}>Preview</span>}
        </div>
        {view ? (
          <>
            <div className={a.sheetCols} aria-hidden="true">
              {story.columns.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <ol className={a.sheetRows} aria-live="polite">
              {view.rows.map((r: Row, i: number) => (
                <motion.li
                  key={`${trying ? "y" : "t"}-${i}-${r.b}`}
                  className={cx(a.sheetRow, r.tone === "late" && a.rowLate)}
                  initial={{ opacity: 0, filter: reduced ? "none" : "blur(3px)", y: reduced ? 0 : 3 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  transition={{ duration: 0.26, delay: reduced ? 0 : i * 0.05 }}
                >
                  <span className={a.num}>{r.a}</span>
                  <span className={a.rowWhat}>
                    {r.b}
                    {r.tone === "late" && <span className={a.lateTag}>Running 15 minutes late</span>}
                  </span>
                  <span className={a.rowWho}>
                    {r.c}
                    {r.tone === "done" && (
                      <span className={a.doneMark} aria-label="Done">
                        <CheckIcon size={11} />
                      </span>
                    )}
                  </span>
                </motion.li>
              ))}
            </ol>
          </>
        ) : (
          <p className={a.sheetEmpty}>{"empty" in yours ? yours.empty : ""}</p>
        )}
      </div>
      {trying && "rows" in yours && <p className={a.specNote}>Filled in from what is already in {p.name}. Nothing is saved until you add it.</p>}
    </section>
  );
}

/* ── the bar at the foot of a story ─────────────────────────────── */

function TryBar({ story, project, trying, open, isOn, onTry, onAdd, onShow }: { story: Story; project: ProjectId; trying: boolean; open: boolean; isOn: boolean; onTry: (v: boolean) => void; onAdd: () => void; onShow: () => void }) {
  const t = toolById(story.primary);
  const p = projectById(project);
  return (
    <div className={a.tryBar}>
      {!trying ? (
        <>
          <span className={a.tryNote}>See this page with your own names and times.</span>
          <button type="button" className={a.primary} onClick={() => onTry(true)}>
            Try it on {p.name}
          </button>
        </>
      ) : open ? (
        <>
          <span className={a.tryNote}>{t.name} is already open in this layout.</span>
          <button type="button" className={a.primary} onClick={onShow}>
            Show {t.name}
          </button>
        </>
      ) : (
        <>
          <span className={a.tryNote}>{isOn ? `${t.name} is on for ${p.name}. It opens beside the others.` : `Adding it turns ${t.name} on for everyone in ${p.name}.`}</span>
          <button type="button" className={a.primary} onClick={onAdd}>
            Add {t.name} as a pane
          </button>
        </>
      )}
    </div>
  );
}
