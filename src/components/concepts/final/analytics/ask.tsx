"use client";

/**
 * Ask: pick or type a question, get one plain sentence and the one chart that
 * proves it, then follow up, pin it, or see it another way.
 */

import { LayoutGroup, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useWorld } from "./live";
import { AnswerBlock, AskField, Back, FilesBlock, MissBlock, Pins, Starters, resolveTyped, type How } from "./ask-parts";
import { askAbout, replayOf, useGoLens } from "./nav";
import { nextKey, setScope, update, useAnalytics, type AskEntry } from "./store";
import type { See } from "./ask-answers";
import s from "./ask.module.css";

export function AskLens() {
  const reduce = useReducedMotion();
  const { scope: scopeId, thread, pins, pendingAsk, pendingTyped } = useAnalytics();
  const [compact, setCompact] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const projects = useWorld().ask;
  const scope = projects.byId(scopeId);
  const goLens = useGoLens();

  const setThread = (f: (t: AskEntry[]) => AskEntry[]) => update((st) => ({ thread: f(st.thread) }));

  // A question asked from another lens is answered on arrival.
  useEffect(() => {
    if (!pendingAsk) return;
    // Read it from the store itself, so a second run finds nothing to add.
    update((st) =>
      st.pendingAsk
        ? {
            pendingAsk: null,
            thread: [...st.thread, { key: nextKey(), kind: "answer", qid: st.pendingAsk.qid, scope: st.pendingAsk.scope, how: "link", from: st.pendingAsk.from }],
          }
        : {},
    );
  }, [pendingAsk]);

  // A question typed elsewhere (Ctrl K, Files, a shared link) is answered the same way as one typed here.
  useEffect(() => {
    if (!pendingTyped) return;
    update((st) => {
      if (!st.pendingTyped) return {};
      const entry = resolveTyped(st.pendingTyped.typed, st.pendingTyped.scope, "link", projects);
      return { pendingTyped: null, scope: entry.scope, thread: [...st.thread, entry] };
    });
  }, [pendingTyped, projects]);

  // "/" puts you in the question field from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 700));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Bring each new answer into view, below the sticky field.
  const count = thread.length;
  const seen = useRef(count);
  useEffect(() => {
    if (count === seen.current) return;
    const grew = count > seen.current;
    seen.current = count;
    if (!grew) return;
    lastRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [count, reduce]);

  function ask(qid: string, how: How, typed?: string, fuzzy?: boolean, lift?: string, scopeFor = scopeId) {
    setThread((t) => [...t, { key: nextKey(), kind: "answer", qid, scope: scopeFor, how, typed, fuzzy, lift }]);
  }

  /** A typed question: a project it names becomes the scope everywhere, the header included. */
  function add(entry: AskEntry) {
    update((st) => ({ scope: entry.scope, thread: [...st.thread, entry] }));
  }

  function togglePin(qid: string, sc: string) {
    update((st) => {
      const found = st.pins.find((p) => p.qid === qid && p.scope === sc);
      if (found) return { pins: st.pins.filter((p) => p !== found) };
      return { pins: [{ key: nextKey(), qid, scope: sc, on: "Pinned today" }, ...st.pins] };
    });
  }

  function see(target: See, from: string) {
    if (target.lens === "replay" && target.project) replayOf(target.project);
    else setScope(target.project ?? from);
    goLens(target.lens);
  }

  const answered = thread.filter((e) => e.kind === "answer").length;

  return (
    <div className={s.page} ref={rootRef}>
      <LayoutGroup>
        <div className={s.inner}>
          <div className={s.fieldBar}>
            <h2 className={s.srOnly}>Ask a question</h2>
            <AskField compact={compact} scope={scope} onEntry={add} inputRef={inputRef} />
            {thread.length === 0 ? <p className={s.fieldNote}>Plain answers from your tasks, dates and history. Pick a question, or type your own.</p> : null}
          </div>

          {thread.length === 0 ? (
            <Starters scope={scope} onAsk={(qid, how, typed, fuzzy, lift) => ask(qid, how, typed, fuzzy, lift)} lift={!reduce} />
          ) : (
            <div className={s.thread}>
              <div className={s.threadBar}>
                <Back onClick={() => setThread(() => [])}>All questions</Back>
                <span className={s.threadCount}>
                  {answered < 2 ? "Ask a follow-up below, or type a new question" : `${answered} answers so far · earlier ones are above`}
                </span>
              </div>
              {thread.map((e, i) => {
                const newest = i === thread.length - 1;
                const asked = new Set(thread.filter((x) => x.kind === "answer" && x.scope === e.scope).map((x) => (x.kind === "answer" ? x.qid : "")));
                return (
                  <div key={e.key} ref={newest ? lastRef : undefined} className={s.threadItem}>
                    {i > 0 && <div className={s.threadJoin} aria-hidden />}
                    {e.kind === "answer" ? (
                      <AnswerBlock
                        entry={e}
                        newest={newest}
                        compact={compact}
                        asked={asked}
                        pinned={pins.some((p) => p.qid === e.qid && p.scope === e.scope)}
                        onPin={() => togglePin(e.qid, e.scope)}
                        onFollow={(qid, lift) => ask(qid, "chip", undefined, false, lift, e.scope)}
                        onSee={(target) => see(target, e.scope)}
                      />
                    ) : e.kind === "files" ? (
                      <FilesBlock entry={e} />
                    ) : (
                      <MissBlock entry={e} onAsk={(qid) => ask(qid, "chip", undefined, false, undefined, e.scope)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Pins
            pins={pins}
            onOpen={(p) => {
              askAbout(p.scope, null, "");
              ask(p.qid, "pin", undefined, false, undefined, p.scope);
            }}
            onRemove={(key) => update((st) => ({ pins: st.pins.filter((p) => p.key !== key) }))}
          />
        </div>
      </LayoutGroup>
    </div>
  );
}
