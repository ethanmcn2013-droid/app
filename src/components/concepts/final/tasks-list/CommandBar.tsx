"use client";

import type { CSSProperties, RefObject } from "react";
import { eventOf, type PersonId, type PriorityId, type StatusId } from "./data";
import { chipFor, prettyWord, type Chip, type Token } from "./command";
import { Avatar, Icon, Kbd, PriorityGlyph, StatusGlyph } from "./icons";
import c from "./command.module.css";

export type CmdMode = "idle" | "edit" | "filter" | "new";

export type CmdState = {
  mode: CmdMode;
  tokens: Token[];
  /** Rows the sentence would edit: the ticked rows, else the rows under the selection. */
  targets: number;
  /** Cells that would really change, and on how many rows. */
  plan: { cells: number; rows: number };
  remove: boolean;
  filter: { shown: number; total: number };
  newTitle: string;
  newWhere: string;
  canApply: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function CommandBar({
  cmd,
  state,
  inputRef,
  onCmd,
  onSubmit,
  onEscape,
  onSaveSheet,
  scope,
  phone,
  cellSelected = false,
}: {
  cmd: string;
  state: CmdState;
  inputRef: RefObject<HTMLInputElement | null>;
  onCmd: (v: string) => void;
  onSubmit: () => void;
  onEscape: () => void;
  onSaveSheet: () => void;
  /** What the selection is, in words: "3 ticked rows", "4 rows under the selection". */
  scope: string;
  phone: boolean;
  /** A cell is selected: say how typing into it starts, and that N and / keep their meaning. */
  cellSelected?: boolean;
}) {
  const { mode, tokens } = state;
  const unknown = tokens.filter((t): t is Extract<Token, { kind: "word" }> => t.kind === "word");
  const known = tokens.filter((t) => t.kind !== "word");
  const isFilter = mode === "filter";
  const chips = known
    .map((t) => chipFor(t, isFilter))
    .filter((x): x is Chip => !!x)
    .map((x) => (x.key === "delete" && !isFilter ? { ...x, value: plural(state.targets, "task") } : x));

  const fix = (word: string, to: string) => {
    onCmd(cmd.replace(new RegExp(`(^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i"), `$1${to}`));
    inputRef.current?.focus();
  };

  const placeholder =
    state.targets > 0
      ? phone
        ? "Type a change, like “orla friday”"
        : "Type a change, like “orla friday high” or “paid”. Start with “show” to filter."
      : phone
        ? "Filter, like “orla unpaid”"
        : "Filter the sheet, like “orla unpaid”, or select cells to change them";

  /* The one line a screen reader hears as the sentence is parsed. */
  const summary =
    mode === "edit"
      ? state.remove
        ? `Deletes ${plural(state.targets, "task")}`
        : unknown.length
          ? `${plural(unknown.length, "word")} not understood`
          : !chips.length
            ? "Keep typing"
            : state.plan.cells
              ? `Changes ${plural(state.plan.cells, "cell")} on ${plural(state.plan.rows, "task")}`
              : `Already set on ${state.targets === 1 ? "this task" : `all ${state.targets} tasks`}`
      : mode === "filter"
        ? `Shows ${state.filter.shown} of ${plural(state.filter.total, "task")}`
        : mode === "new"
          ? state.newTitle
            ? `Adds a task to ${state.newWhere}`
            : "Name the task, then a comma"
          : "";

  return (
    <div className={c.bar} data-mode={mode} data-phone={phone || undefined}>
      {mode !== "idle" && (
        <div className={c.panel} id="tl-cmd-panel">
          <div className={c.parsed}>
            {!state.remove && (
              <span className={c.lead}>
                {mode === "edit" && `Change ${plural(state.targets, "task")}`}
                {mode === "filter" && "Show tasks with"}
                {mode === "new" && "New task"}
              </span>
            )}
            {mode === "new" && state.newTitle && <span className={c.titleChip}>{state.newTitle}</span>}
            {chips.map((chip, i) => (
              <ChipView key={`${i}-${chip.key}-${chip.value}`} chip={chip} i={i} />
            ))}
            {isFilter &&
              unknown.map((t, i) => (
                <span key={`w${i}`} className={c.chip} style={{ animationDelay: `${(chips.length + i) * 40}ms` }}>
                  <Icon name="search" size={13} />
                  <span className={c.chipLabel}>Words</span>“{t.word}”
                </span>
              ))}
            {!chips.length && !unknown.length && mode !== "new" && <span className={c.muted}>Keep typing</span>}
          </div>
          {!isFilter &&
            unknown.map((t) => (
              <p key={t.word} className={c.unknown}>
                <span className={c.unknownMark} aria-hidden>
                  ?
                </span>
                <span>
                  Could not place “{t.word}”.
                  {t.suggestion ? (
                    <>
                      {" "}
                      Did you mean{" "}
                      <button type="button" className={c.textBtn} onClick={() => fix(t.word, t.suggestion!)}>
                        {prettyWord(t.suggestion)}
                      </button>
                      ? {!phone && <span className={c.unknownKey}>Tab to fix</span>}
                    </>
                  ) : (
                    ` ${t.hint ?? "Try a name, a day, a priority, a status, paid, or a cost."}`
                  )}
                </span>
              </p>
            ))}
          <div className={c.foot}>
            <span className={c.count} role="status" aria-live="polite" data-tone={state.remove ? "danger" : undefined}>
              {summary}
            </span>
            {mode === "edit" && !state.remove && state.plan.cells > 0 && !phone && <span className={c.muted}>Outlined in the sheet</span>}
            {isFilter && cmd.trim() && (
              <button type="button" className={c.textBtn} onClick={onSaveSheet}>
                Save as a sheet
              </button>
            )}
          </div>
        </div>
      )}

      <div className={c.row}>
        <span className={c.prompt} aria-hidden>
          <Icon name="command" size={16} />
        </span>
        {state.targets > 0 && mode !== "new" && (
          <span className={c.scope} title={scope}>
            <span className={c.scopeNum}>{state.targets}</span>
            <span className={c.scopeText}>{state.targets === 1 ? "task" : "tasks"}</span>
          </span>
        )}
        <input
          ref={inputRef}
          className={c.input}
          value={cmd}
          onChange={(e) => onCmd(e.target.value)}
          placeholder={placeholder}
          aria-label={state.targets > 0 ? `Command line. Describe a change for ${scope}, or start with show to filter.` : "Command line. Type words to filter the sheet."}
          aria-describedby={mode !== "idle" ? "tl-cmd-panel" : undefined}
          aria-keyshortcuts="/"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint={mode === "filter" ? "search" : "done"}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onEscape();
            } else if (e.key === "Tab" && !e.shiftKey && unknown[0]?.suggestion && !isFilter) {
              e.preventDefault();
              fix(unknown[0].word, unknown[0].suggestion);
            }
          }}
        />
        {mode === "edit" && (
          <button type="button" className={c.apply} data-danger={state.remove || undefined} disabled={!state.canApply} onClick={onSubmit}>
            {state.remove ? `Delete ${state.targets}` : phone ? "Apply" : `Apply to ${plural(state.targets, "task")}`}
            <Icon name="enter" size={14} />
          </button>
        )}
        {mode === "new" && (
          <button type="button" className={c.apply} disabled={!state.canApply} onClick={onSubmit}>
            Add task <Icon name="enter" size={14} />
          </button>
        )}
        {mode === "filter" && (
          <button type="button" className={c.ghost} onClick={onSubmit}>
            {phone ? "Keep" : "Keep filter"} <Icon name="enter" size={14} />
          </button>
        )}
        {mode === "idle" && !phone && (
          <span className={c.hints} aria-hidden>
            {cellSelected ? (
              <>
                <Kbd>↵</Kbd> or type to edit the cell <span className={c.hintSep}>·</span> <Kbd>N</Kbd> new task <span className={c.hintSep}>·</span> <Kbd>/</Kbd> command line
              </>
            ) : (
              <>
                <Kbd>N</Kbd> new task <span className={c.hintSep}>·</span> <Kbd>/</Kbd> command line
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function ChipView({ chip, i }: { chip: Chip; i: number }) {
  const style = { animationDelay: `${i * 40}ms` } as CSSProperties;
  let icon: React.ReactNode;
  if (chip.icon === "person") icon = <Avatar person={(chip.ref as PersonId) ?? null} size={18} />;
  else if (chip.icon === "status") icon = <StatusGlyph status={chip.ref as StatusId} size={14} />;
  else if (chip.icon === "priority") icon = <PriorityGlyph p={(chip.ref as PriorityId) ?? null} size={14} />;
  else if (chip.icon === "event") icon = <span className={c.tile} style={{ background: eventOf(chip.ref)?.tone ?? "transparent" }} data-empty={!chip.ref || undefined} />;
  else if (chip.icon === "late") icon = <Icon name="warning" size={13} />;
  else if (chip.icon === "delete") icon = <Icon name="trash" size={13} />;
  else icon = <Icon name={chip.icon} size={13} />;
  return (
    <span className={c.chip} data-danger={chip.danger || undefined} style={style}>
      <span className={c.chipIcon}>{icon}</span>
      <span className={c.chipLabel}>{chip.label}</span>
      {chip.value && <strong className={c.chipValue}>{chip.value}</strong>}
    </span>
  );
}
