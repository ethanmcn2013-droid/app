"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/primitives/dialog";
import { applyThemeChoice, readThemeChoice } from "@/lib/theme-mode";
import DirectionBrief from "./a/direction";
import DirectionWorkbench from "./b/direction";
import DirectionHorizon from "./c/direction";
import { directionArguments, directionNames, reviewFixture, type DirectionId, type ReviewState, type ReviewSurface } from "./data";
import styles from "./review.module.css";

const choices: DirectionId[] = ["a", "b", "c"];
const renderers = { a: DirectionBrief, b: DirectionWorkbench, c: DirectionHorizon };
const CHOICE_KEY = "signal:home-projects-review:2026-10-18";
const DRAFT_KEY = `${CHOICE_KEY}:draft`;

/** The real App shell wraps this read-only, explicitly synthetic exploration. */
export function ReviewExperience({ surface, initialDirection, initialState }: {
  surface: ReviewSurface; initialDirection: DirectionId; initialState: ReviewState;
}) {
  const state = initialState;
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<{ kind: "project" | "task"; id: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [preference, setPreference] = useState<DirectionId | null>(null);
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  const fixture = useMemo(() => reviewFixture(state), [state]);
  const filtered = useMemo(() => {
    if (surface !== "projects" || !query.trim()) return fixture;
    const match = query.toLocaleLowerCase();
    return { ...fixture, projects: fixture.projects.filter(p => `${p.name} ${p.purpose} ${p.lead}`.toLocaleLowerCase().includes(match)) };
  }, [fixture, query, surface]);
  const Renderer = renderers[initialDirection];
  const href = (direction: DirectionId, target: ReviewSurface = surface, targetState: ReviewState = state) => `/app/${target === "home" ? "home" : "project"}?design=${direction}&state=${targetState}`;
  // Full-document comparison navigation isolates the known shared theme-meta
  // ownership defect. No shared runtime or production navigation is changed.
  const setState = (next: ReviewState) => window.location.assign(href(initialDirection, surface, next));

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHOICE_KEY) ?? "null") as { preference?: DirectionId; feedback?: string } | null;
      if (saved?.preference && choices.includes(saved.preference)) setPreference(saved.preference);
      if (typeof saved?.feedback === "string") setFeedback(saved.feedback);
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft !== null) setFeedback(draft);
    } catch { /* Review remains usable without browser storage. */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { window.localStorage.setItem(DRAFT_KEY, feedback); } catch { /* Export remains available. */ }
  }, [feedback, restored]);

  function savePreference() {
    setPreference(initialDirection);
    try { window.localStorage.setItem(CHOICE_KEY, JSON.stringify({ preference: initialDirection, feedback })); }
    catch { setNotice("Your browser could not save this preference. Export it below to keep it."); return; }
    setNotice("Preference saved in this browser. Export it or tell me your choice in the chat.");
  }

  function exportChoice() {
    const text = ["# Signal Studio · Home and Projects", "", `Direction: ${directionNames[preference ?? initialDirection]}`, "Review date: 18 October 2026", "Status: founder preference for discussion, not production release approval", "", "## Feedback", feedback.trim() || "No additional feedback entered.", "", "## Boundaries", "Automations excluded. Ping remains with its existing owner. The preview uses fictional data and makes no product writes.", ""].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "signal-studio-home-projects-choice.md"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your Markdown preference was downloaded. Send it back here when ready.");
  }

  const task = detail?.kind === "task" ? fixture.tasks.find(t => t.id === detail.id) : null;
  const project = fixture.projects.find(p => p.id === (task?.projectId ?? (detail?.kind === "project" ? detail.id : null)));

  return <div className={`${styles.root} thin-scroll`} data-home-projects-review="" data-direction={initialDirection} data-review-ready={restored ? "true" : "false"}>
    <section className={styles.reviewBar} aria-label="Design comparison controls">
      <div className={styles.reviewLine}><span className={styles.reviewLabel}>Design review · fictional example account</span><a href={`/app/${surface === "home" ? "home" : "project"}`} className={styles.textLink}>Current app</a></div>
      <div className={styles.reviewRow}>
        <nav className={styles.directionNav} aria-label="Design direction">{choices.map(id => <a key={id} href={href(id)} aria-current={initialDirection === id ? "page" : undefined}>{directionNames[id]}</a>)}</nav>
        <button className={styles.reviewButton} onClick={() => setFeedbackOpen(true)} type="button">Review and choose</button>
      </div>
      <details className={styles.controls}><summary>Compare Home, Projects and states</summary><div className={styles.controlRow}>
        <nav className={styles.surfaceNav} aria-label="Preview surface"><a aria-current={surface === "home" ? "page" : undefined} href={href(initialDirection,"home")}>Home</a><a aria-current={surface === "projects" ? "page" : undefined} href={href(initialDirection,"projects")}>Projects</a></nav>
        <label>State <select value={state} onChange={e => {setState(e.target.value as ReviewState); setQuery(""); setDetail(null);}}><option value="busy">Everyday work</option><option value="empty">Empty account</option><option value="partial">Some figures unavailable</option><option value="loading">Loading</option><option value="error">Read error</option></select></label>
        <button type="button" onClick={() => applyThemeChoice(readThemeChoice() === "dark" ? "light" : "dark")}>Switch theme</button>
      </div></details>
    </section>

    {surface === "projects" ? <label className={styles.searchLabel}>Find a project<input aria-label="Find a review project" placeholder="Project, purpose or person" value={query} onChange={e=>setQuery(e.target.value)} type="search" /></label> : null}

    <div className={styles.presentation}>
      {state === "loading" ? <section className={styles.state} aria-busy="true"><h1>{surface === "home" ? "Getting your day ready" : "Reading your projects"}</h1><p>This example pauses in a loading state so you can inspect it.</p><div className={styles.skeleton}/><div className={styles.skeleton}/><button onClick={()=>setState("busy")} type="button">Show the loaded view</button></section>
      : state === "error" ? <section className={styles.state} role="alert"><h1>Your work could not be read</h1><p>Nothing has changed. This is an example of a recoverable read error.</p><button onClick={()=>setState("busy")} type="button">Try again</button></section>
      : surface === "projects" && fixture.projects.length > 0 && filtered.projects.length === 0 ? <section className={styles.state}><h1>No projects match your search</h1><p>Try a different project, purpose or person.</p><button type="button" onClick={()=>setQuery("")}>Clear search</button></section>
      : <Renderer surface={surface} data={filtered} onOpenTask={id=>setDetail({kind:"task",id})} onOpenProject={id=>setDetail({kind:"project",id})} onNavigate={target=>window.location.assign(href(initialDirection,target))} />}
    </div>

    <footer className={styles.argument}><p>{directionArguments[initialDirection].thesis}</p><p><strong>The tradeoff.</strong> {directionArguments[initialDirection].tradeoff}</p><small>Local design interactions only. No tasks, projects or messages are changed.</small></footer>

    <Dialog open={!!detail} onClose={closeDetail} ariaLabel={task?.title ?? project?.name ?? "Review detail"} width={640} motionMode="instant">
      <div className={styles.detail}><div className={styles.detailTop}><span>Example {task ? "task" : "project"}</span><button type="button" onClick={()=>setDetail(null)}>Close</button></div><h2>{task?.title ?? project?.name}</h2><p>{task?.context ?? project?.purpose}</p>
        {project ? <dl><div><dt>Project</dt><dd>{project.name}</dd></div><div><dt>Lead</dt><dd>{project.lead}</dd></div><div><dt>Next date</dt><dd>{project.next} · {project.nextDateLabel}</dd></div></dl> : null}
        {task ? <p>{task.due} · {task.owner}</p> : <ul>{fixture.tasks.filter(t=>t.projectId===project?.id).map(t=><li key={t.id}><button type="button" onClick={()=>setDetail({kind:"task",id:t.id})}>{t.title}</button></li>)}</ul>}
        <p className={styles.boundary}>This is a read-only design example. Use the current app to edit real work.</p>
      </div>
    </Dialog>

    <Dialog open={feedbackOpen} onClose={closeFeedback} ariaLabel="Choose a Home and Projects direction" width={640} motionMode="instant">
      <div className={styles.detail}><div className={styles.detailTop}><span>Your direction</span><button type="button" onClick={()=>setFeedbackOpen(false)}>Close</button></div><h2>{directionNames[initialDirection]}</h2><p>{directionArguments[initialDirection].thesis}</p><p>{directionArguments[initialDirection].tradeoff}</p><label className={styles.feedbackLabel}>What should we keep or change?<textarea rows={5} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Name the parts that help you work, and what gets in the way." /></label><div className={styles.choiceActions}><button className={styles.reviewButton} onClick={savePreference} type="button">Prefer {directionNames[initialDirection]}</button><button onClick={exportChoice} type="button">Export choice as Markdown</button></div>{preference ? <p>Current browser preference: {directionNames[preference]}</p> : null}<p role="status">{notice}</p><p className={styles.boundary}>Your choice is kept in this browser until you export it or tell me here. It does not deploy a design.</p></div>
    </Dialog>
  </div>;
}
