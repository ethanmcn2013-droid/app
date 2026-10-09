"use client";

import { AnimatePresence, LayoutGroup, MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CORE,
  ENABLED_ESTABLISHED,
  ENABLED_NEW,
  FIT_LABEL,
  FIT_LEAD,
  FIT_TAGS,
  GRID_ORDER,
  LEAD,
  STORIES,
  TOOLS,
  storyById,
  toolById,
  type Fit,
  type ProjectId,
  type StoryId,
  type ToolId,
} from "./data";
import { GuideIndex, type GuideFilter } from "./guide";
import { CheckIcon, CloseIcon, SearchIcon } from "./glyphs";
import { KitStrip, LeadStory, StoryCard } from "./parts";
import { StoryReader, plural, type Bounds, type Enabled } from "./reader";
import styles from "./c3.module.css";

/* ── phone or not ─────────────────────────────────────────────────── */

const PHONE = "(max-width: 720px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);

const KIT_ORDER: ToolId[] = ["tasks", "timeline", "notes", "files", "guestlist", "dayplan"];

function matches(q: string, ...fields: string[]) {
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(needle));
}

export default function FieldGuide() {
  const phone = usePhone();
  const [early, setEarly] = useState(false);
  const [enabled, setEnabled] = useState<Enabled>(ENABLED_ESTABLISHED);
  const [added, setAdded] = useState<ToolId[]>([]);
  const [fresh, setFresh] = useState<ToolId | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GuideFilter>("all");
  const [openId, setOpenId] = useState<StoryId | null>(null);
  const [bounds, setBounds] = useState<Bounds>(null);
  const [suggest, setSuggest] = useState<"closed" | "open" | "sent">("closed");
  const [suggestText, setSuggestText] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  /* keep the reader over the content area if the window changes size */
  useEffect(() => {
    if (!openId) return;
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      if (r) setBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [openId]);

  const openStory = (id: StoryId) => {
    opener.current = document.activeElement as HTMLElement | null;
    const r = root.current?.getBoundingClientRect();
    if (r) setBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
    setOpenId(id);
  };
  const closeStory = useCallback(() => {
    setOpenId(null);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }, []);

  const setTool = (tool: ToolId, project: ProjectId, on: boolean) => {
    setEnabled((prev) => {
      const list = prev[tool] ?? [];
      const next = on ? [...new Set([...list, project])] : list.filter((p) => p !== project);
      return { ...prev, [tool]: next };
    });
    if (on && !(enabled[tool] ?? []).length) {
      setAdded((a) => (a.includes(tool) ? a : [...a, tool]));
      setFresh(tool);
    }
  };

  const switchMode = (toEarly: boolean) => {
    setEarly(toEarly);
    setEnabled(toEarly ? ENABLED_NEW : ENABLED_ESTABLISHED);
    setAdded([]);
    setFresh(null);
    setFit(null);
    setFilter("all");
    root.current?.scrollTo({ top: 0 });
  };

  const baseKit = early ? CORE : KIT_ORDER;
  const kit = [...baseKit, ...added.filter((t) => !baseKit.includes(t))].filter((t) => (enabled[t] ?? []).length > 0);

  /* ordering: a chosen fit leads with its best story */
  const leadId: StoryId = fit ? FIT_LEAD[fit] : LEAD;
  const rest = [LEAD, ...GRID_ORDER].filter((id) => id !== leadId);
  const ordered = fit ? [...rest.filter((id) => storyById(id).fits.includes(fit)), ...rest.filter((id) => !storyById(id).fits.includes(fit))] : rest;

  const q = query.trim();
  const storyHits = q
    ? STORIES.filter((s) => matches(q, s.headline, s.dek, s.byline, ...s.tools.map((t) => toolById(t).name)))
    : [];
  const toolHits = q ? TOOLS.filter((t) => matches(q, t.name, t.line, t.entry, ...t.goodFor)) : TOOLS;
  const nothing = q && storyHits.length === 0 && toolHits.length === 0;

  const manage = () => {
    setFilter("kit");
    requestAnimationFrame(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const pickFit = (f: Fit | null) => {
    setFit(f);
    if (f) setFilter("all");
  };

  const guideFilter: GuideFilter = fit && filter === "all" ? FIT_TAGS[fit][0] : filter;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div ref={root} className={styles.root}>
          <div className={styles.page}>
            <header className={styles.masthead}>
              <div className={styles.mastText}>
                <h1 className={styles.h1}>Apps and tools</h1>
                <p className={styles.subtitle}>What teams like yours keep next to their tasks</p>
              </div>
              <div className={styles.search}>
                <SearchIcon />
                <input
                  className={styles.searchInput}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSuggest("closed");
                  }}
                  placeholder="Search stories and tools"
                  aria-label="Search stories and tools"
                />
                {query && (
                  <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
                    <CloseIcon />
                  </button>
                )}
              </div>
            </header>

            {!q && (
              <KitStrip kit={kit} enabled={enabled} early={early} fit={fit} onFit={pickFit} onManage={manage} fresh={fresh} />
            )}

            {q ? (
              <section className={styles.results} aria-live="polite">
                {nothing ? (
                  <div className={styles.noResult}>
                    <p className={styles.noResultLine}>Nothing in the guide for &ldquo;{q}&rdquo; yet.</p>
                    <p className={styles.tryTerms}>
                      Try
                      {["guests", "deposits", "countdown", "class"].map((t) => (
                        <button key={t} type="button" className={styles.linkBtn} onClick={() => setQuery(t)}>
                          {t}
                        </button>
                      ))}
                      or tell us what you were looking for.
                    </p>
                    {suggest === "sent" ? (
                      <p className={styles.thanks} role="status">
                        <CheckIcon /> Thank you. We read every suggestion, and the good ones become stories.
                      </p>
                    ) : suggest === "open" ? (
                      <form
                        className={styles.suggestForm}
                        onSubmit={(e) => {
                          e.preventDefault();
                          setSuggest("sent");
                        }}
                      >
                        <label className={styles.ideaLabel} htmlFor="c3-suggest">
                          What would it do for you?
                        </label>
                        <div className={styles.ideaRow}>
                          <input id="c3-suggest" className={styles.ideaInput} value={suggestText} onChange={(e) => setSuggestText(e.target.value)} placeholder={`A ${q} tool that…`} autoFocus />
                          <button type="submit" className={styles.btnPrimary}>
                            Send
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className={styles.btnSecondary} onClick={() => setSuggest("open")}>
                        Suggest a tool
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <p className={styles.resultCount}>
                      {plural(storyHits.length, "story", "stories")} and {plural(toolHits.length, "tool")} for &ldquo;{q}&rdquo;
                    </p>
                    {storyHits.length > 0 && (
                      <div className={styles.grid}>
                        {storyHits.map((s) => (
                          <StoryCard key={s.id} story={s} enabled={enabled} hidden={openId === s.id} onOpen={() => openStory(s.id)} span="third" />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : (
              <>
                <section className={styles.issue} aria-labelledby="issue-title">
                  <div className={styles.sectionHead}>
                    <h2 id="issue-title" className={styles.h2}>
                      {fit ? `For people who say “${FIT_LABEL[fit].toLowerCase()}”` : "This week"}
                    </h2>
                    {fit ? (
                      <button type="button" className={styles.linkBtn} onClick={() => setFit(null)}>
                        Show every story
                      </button>
                    ) : (
                      <span className={styles.issueMeta}>Issue 38, Thursday 24 September</span>
                    )}
                  </div>
                  <LeadStory key={leadId} story={storyById(leadId)} onOpen={() => openStory(leadId)} hidden={openId === leadId} />
                  <div className={styles.grid}>
                    {ordered.map((id, i) => (
                      <StoryCard key={id} story={storyById(id)} enabled={enabled} hidden={openId === id} onOpen={() => openStory(id)} span={i < 3 ? "third" : "half"} />
                    ))}
                  </div>
                </section>
              </>
            )}

            {!nothing && (
              <section ref={guideRef} className={styles.guideSection} aria-labelledby="guide-title">
                <div className={styles.sectionHead}>
                  <h2 id="guide-title" className={styles.h2}>
                    {q ? "Tools" : "The guide"}
                  </h2>
                  {!q && <span className={styles.issueMeta}>Every tool from A to Z, in plain words</span>}
                </div>
                <GuideIndex tools={toolHits} enabled={enabled} filter={q ? "all" : guideFilter} onFilter={(f) => { setFilter(f); if (fit) setFit(null); }} onSet={setTool} onStory={openStory} searching={!!q} />
              </section>
            )}

            <footer className={styles.colophon}>
              <p>
                Stories in this guide are told to us by the teams in them, and every tool you read about can be tried on your own Project before you turn it on. A new story arrives each Thursday.
              </p>
              <button type="button" className={styles.linkBtn} onClick={() => switchMode(!early)}>
                {early ? "See it with your own kit" : "See it as a brand new account"}
              </button>
            </footer>
          </div>
        </div>

        <AnimatePresence>
          {openId && (
            <StoryReader
              key={openId}
              story={storyById(openId)}
              enabled={enabled}
              bounds={bounds}
              phone={phone}
              onClose={closeStory}
              onTurnOn={(t, p) => setTool(t, p, true)}
              onUndo={(t, p) => setTool(t, p, false)}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  );
}
