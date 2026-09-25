"use client";

import { LayoutGroup, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { projectById } from "./data";
import { AnswerBlock, AskField, Back, EmptyProject, MissBlock, Pins, Starters, type Entry, type How, type Pin } from "./parts";
import s from "./c5.module.css";

const SEED_PINS: Pin[] = [
  { key: "seed-1", qid: "time-goes", scope: "orchard", on: "Pinned 11 Sep", then: "41% waiting then" },
  { key: "seed-2", qid: "who-busy", scope: "riverside", on: "Pinned 18 Sep" },
  { key: "seed-3", qid: "how-long", scope: "brightwater", on: "Pinned 2 Sep" },
];

let counter = 0;
const nextKey = () => `e${++counter}`;

export default function AskConcept() {
  const reduce = useReducedMotion();
  const [scopeId, setScopeId] = useState("orchard");
  const [thread, setThread] = useState<Entry[]>([]);
  const [pins, setPins] = useState<Pin[]>(SEED_PINS);
  const [compact, setCompact] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const scope = projectById(scopeId);

  // "/" puts you in the question field from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
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
  useEffect(() => {
    if (count < 2) {
      rootRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    lastRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [count, reduce]);

  function ask(qid: string, how: How, typed?: string, fuzzy?: boolean, lift?: string, scopeFor = scopeId) {
    setThread((t) => [...t, { key: nextKey(), kind: "answer", qid, scope: scopeFor, how, typed, fuzzy, lift }]);
  }

  function miss(typed: string, offers: string[]) {
    setThread((t) => [...t, { key: nextKey(), kind: "miss", typed, scope: scopeId, offers }]);
  }

  function togglePin(qid: string, sc: string) {
    setPins((ps) => {
      const found = ps.find((p) => p.qid === qid && p.scope === sc);
      if (found) return ps.filter((p) => p !== found);
      return [{ key: nextKey(), qid, scope: sc, on: "Pinned today" }, ...ps];
    });
  }

  const empty = scope.status === "empty";
  const answered = thread.filter((e) => e.kind === "answer").length;

  return (
    <div className={s.page} ref={rootRef}>
      <LayoutGroup>
        <div className={s.inner}>
          <header className={`${s.hero} ${thread.length && !empty ? s.heroCompact : ""}`}>
            <h1 className={s.h1}>Ask about your work</h1>
            <p className={s.lede}>Plain answers from your tasks, dates and history. Pick a question, or type your own.</p>
          </header>

          <div className={s.fieldBar}>
            <AskField compact={compact} scope={scope} onScope={setScopeId} onAsk={(qid, how, typed, fuzzy, lift) => ask(qid, how, typed, fuzzy, lift)} onMiss={miss} inputRef={inputRef} />
          </div>

          {empty ? (
            <EmptyProject scope={scope} />
          ) : thread.length === 0 ? (
            <Starters scope={scope} onAsk={(qid, how, typed, fuzzy, lift) => ask(qid, how, typed, fuzzy, lift)} lift={!reduce} />
          ) : (
            <div className={s.thread}>
              <div className={s.threadBar}>
                <Back onClick={() => setThread([])}>All questions</Back>
                <span className={s.threadCount}>
                  {answered === 1 ? "1 answer" : `${answered} answers`} so far · scroll up to see earlier ones
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
                      />
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
              setScopeId(p.scope);
              ask(p.qid, "pin", undefined, false, undefined, p.scope);
            }}
            onRemove={(key) => setPins((ps) => ps.filter((p) => p.key !== key))}
          />
        </div>
      </LayoutGroup>
    </div>
  );
}
