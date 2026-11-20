"use client";

/* The front door of the workbench: say what you need, see the tool with your own data, add it as a pane. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { projectById, toolById, type ProjectId, type ToolId } from "./data";
import { interpret, PLACEHOLDER, SUGGESTIONS, type Answer } from "./ask-match";
import { sourcesFor, type Live } from "./sources";
import { cx } from "./ctx";
import { ToolTile } from "./chrome";
import { ArrowRightIcon, AskIcon, BookIcon, CloseIcon, ReturnIcon, SourceIcon } from "./glyphs";
import a from "./ask.module.css";

type Option = { key: string; kind: "suggest"; text: string; why: string } | { key: string; kind: "tool"; answer: Answer } | { key: string; kind: "browse" };

type Props = {
  project: ProjectId;
  on: ToolId[];
  isOpen: (tool: ToolId) => boolean;
  live: Live;
  phone: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (tool: ToolId) => void;
  onShow: (tool: ToolId) => void;
  onBrowse: () => void;
  /** The tool's real pane body, shown read-only before it is added. */
  preview: (tool: ToolId) => ReactNode;
};

export function AskBar({ project, on, isOpen, live, phone, inputRef, open, onOpenChange, onAdd, onShow, onBrowse, preview }: Props) {
  const reduced = useReducedMotion();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const typing = useRef<number | null>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState({ key: "", i: 0 });
  const p = projectById(project);

  const result = useMemo(() => interpret(text), [text]);
  const options: Option[] = useMemo(() => {
    if (result.kind !== "answers" && result.kind !== "none") return [];
    return [...result.answers.map((answer) => ({ key: answer.tool, kind: "tool" as const, answer })), { key: "browse", kind: "browse" as const }];
  }, [result]);

  const listKey = `${project}:${options.map((o) => o.key).join("|")}`;
  const selIdx = sel.key === listKey ? Math.min(sel.i, options.length - 1) : 0;
  const current = options[selIdx];
  const tools = options.filter((o): o is Extract<Option, { kind: "tool" }> => o.kind === "tool");
  const shown = current?.kind === "tool" ? current.answer.tool : tools[0]?.answer.tool;
  const replying = open && text.trim().length > 0;

  const stopTyping = () => {
    if (typing.current !== null) window.clearInterval(typing.current);
    typing.current = null;
  };
  useEffect(() => stopTyping, []);

  /* Close when the pointer goes down anywhere else. */
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open, onOpenChange]);

  const typeIn = (phrase: string) => {
    stopTyping();
    inputRef.current?.focus({ preventScroll: true });
    onOpenChange(true);
    if (reduced) {
      setText(phrase);
      return;
    }
    let i = 0;
    setText("");
    typing.current = window.setInterval(() => {
      i += 1;
      setText(phrase.slice(0, i));
      if (i >= phrase.length) stopTyping();
    }, 22);
  };

  const reset = () => {
    stopTyping();
    setText("");
  };

  const choose = (o: Option | undefined) => {
    if (!o || o.kind === "suggest") return;
    reset();
    onOpenChange(false);
    if (o.kind === "browse") return onBrowse();
    const tool = o.answer.tool;
    if (isOpen(tool)) onShow(tool);
    else onAdd(tool);
  };

  const move = (d: number) => options.length && setSel({ key: listKey, i: (selIdx + d + options.length) % options.length });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "/" && !text) {
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!replying && text.trim()) onOpenChange(true);
      else move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!replying && text.trim()) onOpenChange(true);
      else if (replying) choose(current);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) {
        reset();
        onOpenChange(false);
      } else inputRef.current?.blur();
    }
  };

  const optId = (i: number) => `${listId}-o${i}`;
  const lead = tools[0] ? toolById(tools[0].answer.tool) : null;
  const others = tools.length - 1;
  const reply =
    result.kind === "answers" && lead ? (
      <>
        <strong>{lead.name}</strong> fits best. Here it is with what is already in {p.name}
        {others > 0 ? `, and ${others === 1 ? "one other way" : `${WORDS[others] ?? others} other ways`} to do it.` : "."}
      </>
    ) : result.kind === "none" ? (
      <>Nothing does exactly that yet. These come closest, or see how teams like yours do it.</>
    ) : (
      <>
        Keep going. Say what it should help with, like{" "}
        <button type="button" className={a.inlineLink} onPointerDown={(e) => e.preventDefault()} onClick={() => typeIn(PLACEHOLDER[project])}>
          {PLACEHOLDER[project]}
        </button>
        .
      </>
    );

  return (
    <div ref={wrapRef} className={cx(a.ask, replying && a.askOpen, phone && a.phone)}>
      <div className={cx(a.askCard, focused && a.askCardFocus)} onPointerDown={(e) => e.target === e.currentTarget && e.preventDefault()} onClick={() => inputRef.current?.focus()}>
        <span className={a.mark} aria-hidden="true">
          <AskIcon size={20} />
        </span>
        <label className={a.srOnly} htmlFor={`${listId}-in`}>
          Ask for a tool for {p.name}
        </label>
        <input
          id={`${listId}-in`}
          ref={inputRef}
          className={a.input}
          value={text}
          placeholder={phone ? "What should this layout help with?" : `What should this layout help with for ${p.name}?`}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={replying && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={replying && current ? optId(selIdx) : undefined}
          onFocus={() => {
            setFocused(true);
            if (text.trim()) onOpenChange(true);
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            stopTyping();
            setText(e.target.value);
            onOpenChange(e.target.value.trim().length > 0);
          }}
          onKeyDown={onKeyDown}
        />
        {text ? (
          <button
            type="button"
            className={a.clear}
            onClick={(e) => {
              e.stopPropagation();
              reset();
              onOpenChange(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear what you asked"
          >
            <CloseIcon size={15} />
          </button>
        ) : (
          !phone && (
            <span className={a.hint} aria-hidden="true">
              {focused ? (
                "Say it in your own words"
              ) : (
                <>
                  Press <kbd className={a.slash}>/</kbd> to ask
                </>
              )}
            </span>
          )
        )}
      </div>

      <div className={a.chips}>
        <span className={a.chipsLabel}>Try</span>
        <ul className={a.chipList} aria-label={`Things to ask for ${p.name}`}>
          {SUGGESTIONS[project].map((x) => (
            <li key={x.text}>
              <button type="button" className={a.chip} onClick={() => typeIn(x.text)} title={x.why}>
                {x.text}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={a.browseBtn} onClick={onBrowse} data-browse="">
          <BookIcon size={16} />
          <span>Browse ideas</span>
        </button>
      </div>

      <AnimatePresence>
        {replying && (
          <motion.div
            className={cx(a.panel, tools.length > 0 && a.panelWide)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 520, damping: 42 }}
          >
            <p className={a.reply} aria-live="polite">
              <span className={a.replyMark} aria-hidden="true">
                <AskIcon size={15} />
              </span>
              <span>{reply}</span>
            </p>

            {options.length > 0 && (
              <div className={a.replyBody}>
                <div className={a.listCol}>
                  <ul id={listId} role="listbox" aria-label="Tools for what you asked" className={a.list}>
                    {options.map((o, i) => {
                      const isSel = i === selIdx;
                      const common = {
                        id: optId(i),
                        role: "option" as const,
                        "aria-selected": isSel,
                        onPointerDown: (e: { preventDefault: () => void }) => e.preventDefault(),
                        onMouseMove: () => i !== selIdx && setSel({ key: listKey, i }),
                        onClick: () => choose(o),
                      };
                      if (o.kind === "browse") {
                        return (
                          <li key={o.key} {...common} className={cx(a.opt, a.optBrowse, isSel && a.optOn)}>
                            <span className={a.browseTile} aria-hidden="true">
                              <BookIcon size={16} />
                            </span>
                            <span className={a.optText}>
                              <span className={a.optName}>Not it? Browse ideas</span>
                              <span className={a.optWhy}>How teams like yours use a tool</span>
                            </span>
                            <ArrowRightIcon size={15} className={a.optArrow} />
                          </li>
                        );
                      }
                      if (o.kind !== "tool") return null;
                      const t = toolById(o.answer.tool);
                      const state = isOpen(t.id) ? "Open" : on.includes(t.id) ? "On" : null;
                      return (
                        <li key={o.key} {...common} className={cx(a.opt, isSel && a.optOn)}>
                          <ToolTile tool={t.id} size={30} />
                          <span className={a.optText}>
                            <span className={a.optRank}>{o.answer.rank}</span>
                            <span className={a.optName}>{t.name}</span>
                          </span>
                          {state && <span className={a.optState}>{state}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {shown && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={shown}
                      className={a.previewCol}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <Preview
                        tool={shown}
                        project={project}
                        live={live}
                        open={isOpen(shown)}
                        isOn={on.includes(shown)}
                        body={preview(shown)}
                        onAct={() => choose(options.find((o) => o.kind === "tool" && o.answer.tool === shown))}
                      />
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const WORDS: Record<number, string> = { 2: "two", 3: "three" };

/* ── the answer, with where its data comes from ─────────────────────── */

function Preview({ tool, project, live, open, isOn, body, onAct }: { tool: ToolId; project: ProjectId; live: Live; open: boolean; isOn: boolean; body: ReactNode; onAct: () => void }) {
  const t = toolById(tool);
  const p = projectById(project);
  const src = sourcesFor(tool, project, live);
  return (
    <div className={a.preview}>
      <div className={a.pvHead}>
        <ToolTile tool={tool} size={40} />
        <span className={a.pvTitles}>
          <span className={a.pvName}>{t.name}</span>
          <span className={a.pvLine}>{t.line}</span>
        </span>
      </div>

      <section className={a.sources} aria-label="Where its data comes from">
        <h3 className={a.sourcesHead}>Where it comes from</h3>
        {src.items.length > 0 && (
          <ul className={a.sourceList}>
            {src.items.map((x) => (
              <li key={x.what} className={a.source}>
                <span className={a.sourceWhat}>{x.what}</span>
                <span className={a.sourceFrom}>
                  <SourceIcon size={13} />
                  {x.from}
                </span>
              </li>
            ))}
          </ul>
        )}
        {src.empty && <p className={a.sourceEmpty}>{src.empty}</p>}
      </section>

      {!open && (
        <motion.div layoutId={`c5-arrive-${tool}`} className={a.frame} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
          <div className={a.frameHead}>
            <ToolTile tool={tool} size={20} />
            <span className={a.frameName}>{t.name}</span>
            <span className={a.frameTag}>Preview</span>
          </div>
          <div className={a.frameBody} inert>
            {body}
          </div>
        </motion.div>
      )}

      <footer className={a.pvFoot}>
        <button type="button" className={a.primary} onPointerDown={(e) => e.preventDefault()} onClick={onAct}>
          {open ? "Show it" : "Add as a pane"}
          <kbd className={a.enterKey} aria-hidden="true">
            <ReturnIcon size={13} />
          </kbd>
        </button>
        <span className={a.pvNote}>{open ? "Already open in this layout." : isOn ? `On for ${p.name}. It opens beside the others.` : `Adding it turns it on for everyone in ${p.name}.`}</span>
      </footer>
    </div>
  );
}
