"use client";

import { LABELS, LABEL_IDS, OTHER_PROJECTS, PEOPLE, PERSON_IDS, PRIORITIES, STATUSES, TODAY, type LabelId } from "./data";
import { Avatar, Icon, Kbd, PriorityIcon, StatusGlyph } from "./glyphs";
import { addDays, longDate, parse, prettyWord, type Change, type Token } from "./parse";
import s from "./list.module.css";

export type PickerKind = "status" | "assign" | "due" | "priority" | "labels" | "move";
export type Option = { key: string; label: string; hint?: string; icon: React.ReactNode; change?: Change; toggleLabel?: LabelId; move?: string };
export type Toast = { n: number; text: string; undo: boolean };

const PICKER_TITLE: Record<PickerKind, string> = {
  status: "Set status",
  assign: "Assign",
  due: "Set a due date",
  priority: "Set priority",
  labels: "Labels",
  move: "Move to project",
};

export function pickerOptions(kind: PickerKind): Option[] {
  switch (kind) {
    case "status":
      return STATUSES.map((st) => ({ key: st.id, label: st.name, hint: st.hint, icon: <StatusGlyph status={st.id} />, change: { status: st.id } }));
    case "assign":
      return [
        ...PERSON_IDS.map((p) => ({ key: p, label: PEOPLE[p].name, hint: PEOPLE[p].role, icon: <Avatar person={p} size={20} />, change: { assign: p } })),
        { key: "none", label: "No one", icon: <Avatar person={null} size={20} />, change: { assign: null } },
      ];
    case "due": {
      const d = (label: string, iso: string | null, hint?: string): Option => ({
        key: label,
        label,
        hint: hint ?? (iso ? longDate(iso) : undefined),
        icon: <Icon name="calendar" />,
        change: { due: iso },
      });
      return [
        d("Today", TODAY),
        d("Tomorrow", addDays(TODAY, 1)),
        d("Monday", addDays(TODAY, 3)),
        d("Friday", addDays(TODAY, 7)),
        d("In two weeks", addDays(TODAY, 14)),
        d("No date", null, "Clear the date"),
      ];
    }
    case "priority":
      return PRIORITIES.map((p) => ({ key: String(p.p), label: p.name, icon: <PriorityIcon p={p.p} />, change: { priority: p.p } }));
    case "labels":
      return LABEL_IDS.map((l) => ({
        key: l,
        label: LABELS[l].name,
        hint: "Add or remove",
        icon: <span className={s.dotLg} style={{ background: LABELS[l].tone }} />,
        toggleLabel: l,
      }));
    case "move":
      return OTHER_PROJECTS.map((p, i) => ({
        key: p,
        label: p,
        icon: (
          <span className={s.projTileSm} style={{ background: `var(--v3-project-${[2, 3, 5][i]})` }} aria-hidden>
            {p.includes("Kitchen") ? "K" : "T"}
          </span>
        ),
        move: p,
      }));
  }
}

export function filterOptions(kind: PickerKind, q: string) {
  const all = pickerOptions(kind);
  const query = q.trim().toLowerCase();
  return query ? all.filter((o) => o.label.toLowerCase().includes(query) || (o.hint ?? "").toLowerCase().includes(query)) : all;
}

type Props = {
  cmd: string;
  onCmd: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  selectedCount: number;
  focusedKey: string | null;
  newGroupName: string;
  filterCount: { shown: number; total: number };
  picker: { kind: PickerKind; targets: number[] } | null;
  pickerQuery: string;
  onPickerQuery: (v: string) => void;
  pickerIndex: number;
  onPickerIndex: (i: number) => void;
  onPick: (o: Option) => void;
  onClosePicker: () => void;
  onOpenPicker: (k: PickerKind) => void;
  onSubmit: () => void;
  onEscape: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onSaveView: () => void;
  onShortcuts: () => void;
  toast: Toast | null;
  onUndo: () => void;
  onDismissToast: () => void;
  compact: boolean;
};

export function Dock({ inputRef, ...p }: Props) {
  const { cmd, picker, selectedCount } = p;
  const isNew = /^\s*new\s*:/i.test(cmd);
  const tokens: Token[] = cmd.trim() ? parse(isNew ? cmd.replace(/^\s*new\s*:/i, "").split(",").slice(1).join(",") : cmd) : [];
  const unknown = tokens.filter((t) => t.kind === "word") as Extract<Token, { kind: "word" }>[];
  const known = tokens.filter((t) => t.kind !== "word");
  const mode: "picker" | "new" | "edit" | "filter" | "idle" = picker
    ? "picker"
    : isNew
      ? "new"
      : cmd.trim()
        ? selectedCount
          ? "edit"
          : "filter"
        : "idle";
  const options = picker ? filterOptions(picker.kind, p.pickerQuery) : [];
  const canApply = mode === "edit" && known.length > 0 && unknown.length === 0;
  const newTitle = isNew ? cmd.replace(/^\s*new\s*:/i, "").split(",")[0].trim() : "";

  const fixWord = (word: string, to: string) => {
    p.onCmd(cmd.replace(new RegExp(`\\b${word}\\b`, "i"), to));
    inputRef.current?.focus();
  };

  const placeholder = picker
    ? "Type to filter"
    : selectedCount
      ? p.compact
        ? `Change ${selectedCount === 1 ? "1 task" : `${selectedCount} tasks`}…`
        : `Describe a change for ${selectedCount} ${selectedCount === 1 ? "task" : "tasks"}, like “Orla, Friday, high”`
      : p.compact
        ? "Ask or change…"
        : "Type a command or describe a change…";

  return (
    <div className={s.dock} data-mode={mode}>
      {p.toast && (
        <div className={s.toast} key={p.toast.n} role="status">
          <Icon name="check" size={14} />
          <span className={s.toastText}>{p.toast.text}</span>
          {p.toast.undo && (
            <button type="button" className={s.toastUndo} onClick={p.onUndo}>
              Undo <span className={s.toastKey}>Z</span>
            </button>
          )}
          <button type="button" className={s.toastClose} onClick={p.onDismissToast} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {selectedCount > 0 && !picker && (
        <div className={s.strip} role="toolbar" aria-label="Selection actions">
          <span className={s.stripCount}>
            <span className={s.stripNum}>{selectedCount}</span> selected
          </span>
          <span className={s.stripDivider} aria-hidden />
          <StripBtn icon={<StatusGlyph status="progress" size={14} />} label="Set status" k="S" onClick={() => p.onOpenPicker("status")} />
          <StripBtn icon={<Icon name="person" size={14} />} label="Assign" k="A" onClick={() => p.onOpenPicker("assign")} />
          <StripBtn icon={<Icon name="calendar" size={14} />} label="Due" k="D" onClick={() => p.onOpenPicker("due")} />
          <StripBtn icon={<PriorityIcon p={3} />} label="Priority" k="P" onClick={() => p.onOpenPicker("priority")} />
          <StripBtn icon={<Icon name="arrow" size={14} />} label="Move" k="M" onClick={() => p.onOpenPicker("move")} />
          <StripBtn icon={<Icon name="trash" size={14} />} label="Delete" k="⌫" onClick={p.onDelete} danger />
          <button type="button" className={s.stripClear} onClick={p.onClearSelection} aria-label="Clear selection (Esc)" title="Clear selection (Esc)">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <div className={s.cmd} data-open={mode !== "idle" || undefined}>
        {mode === "picker" && picker && (
          <div className={s.panel}>
            <div className={s.panelHead}>
              <span>
                {PICKER_TITLE[picker.kind]} for {picker.targets.length === 1 ? "1 task" : `${picker.targets.length} tasks`}
              </span>
              <span className={s.panelKeys}>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to choose, <Kbd>↵</Kbd> to apply
              </span>
            </div>
            <ul className={s.options} role="listbox" aria-label={PICKER_TITLE[picker.kind]}>
              {options.map((o, i) => (
                <li key={o.key} role="option" aria-selected={i === p.pickerIndex}>
                  <button
                    type="button"
                    className={s.option}
                    data-active={i === p.pickerIndex || undefined}
                    onMouseEnter={() => p.onPickerIndex(i)}
                    onClick={() => p.onPick(o)}
                  >
                    <span className={s.optionIcon}>{o.icon}</span>
                    <span className={s.optionLabel}>{o.label}</span>
                    {o.hint && <span className={s.optionHint}>{o.hint}</span>}
                  </button>
                </li>
              ))}
              {options.length === 0 && <li className={s.optionEmpty}>Nothing matches “{p.pickerQuery}”.</li>}
            </ul>
          </div>
        )}

        {(mode === "edit" || mode === "filter" || mode === "new") && (
          <div className={s.panel}>
            <div className={s.parsed}>
              <span className={s.parsedLead}>
                {mode === "edit" && (known.length ? `Change ${selectedCount === 1 ? "1 task" : `${selectedCount} tasks`}` : "Keep typing")}
                {mode === "filter" && "Showing"}
                {mode === "new" && `New task in ${p.newGroupName}`}
              </span>
              {mode === "new" && newTitle && <span className={s.tokenTitle}>{newTitle}</span>}
              {known.map((t, i) => (
                <TokenChip key={`${i}-${JSON.stringify(t)}`} t={t} i={i} />
              ))}
              {mode === "filter" &&
                unknown.map((t, i) => (
                  <span key={`w${i}`} className={s.token} style={{ animationDelay: `${(known.length + i) * 40}ms` }}>
                    <Icon name="filter" size={13} />“{t.word}”
                  </span>
                ))}
              <span className={s.parsedEnd}>
                {mode === "filter" && (
                  <>
                    <span className={s.parsedCount}>
                      {p.filterCount.shown} of {p.filterCount.total}
                    </span>
                    <button type="button" className={s.textBtn} onClick={p.onSaveView}>
                      Save as view
                    </button>
                  </>
                )}
              </span>
            </div>
            {mode !== "filter" &&
              unknown.map((t) => (
                <p key={t.word} className={s.unknown}>
                  <span className={s.unknownMark} aria-hidden>
                    ?
                  </span>
                  <span>
                    Could not match “{t.word}”.
                    {t.suggestion ? (
                      <>
                        {" "}
                        Did you mean{" "}
                        <button type="button" className={s.textBtn} onClick={() => fixWord(t.word, t.suggestion!)}>
                          {prettyWord(t.suggestion)}
                        </button>
                        ? <span className={s.unknownKey}>Tab to fix</span>
                      </>
                    ) : (
                      " Try a name, a day, a priority or a status."
                    )}
                  </span>
                </p>
              ))}
          </div>
        )}

        <div className={s.cmdRow}>
          <span className={s.cmdIcon} aria-hidden>
            <Icon name="spark" />
          </span>
          {picker && <span className={s.pickerTag}>{PICKER_TITLE[picker.kind]}</span>}
          <input
            ref={inputRef}
            className={s.cmdInput}
            value={picker ? p.pickerQuery : cmd}
            onChange={(e) => (picker ? p.onPickerQuery(e.target.value) : p.onCmd(e.target.value))}
            placeholder={placeholder}
            aria-label="Command line"
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (picker) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  p.onPickerIndex(Math.min(options.length - 1, p.pickerIndex + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  p.onPickerIndex(Math.max(0, p.pickerIndex - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (options[p.pickerIndex]) p.onPick(options[p.pickerIndex]);
                } else if (e.key === "Escape" || (e.key === "Backspace" && !p.pickerQuery)) {
                  e.preventDefault();
                  p.onClosePicker();
                }
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                p.onSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                p.onEscape();
              } else if (e.key === "Tab" && unknown[0]?.suggestion && mode !== "filter") {
                e.preventDefault();
                fixWord(unknown[0].word, unknown[0].suggestion);
              }
            }}
          />
          {mode === "edit" && (
            <button type="button" className={s.applyBtn} disabled={!canApply} onClick={p.onSubmit}>
              Apply to {selectedCount} <Icon name="enter" size={14} />
            </button>
          )}
          {mode === "new" && (
            <button type="button" className={s.applyBtn} disabled={!newTitle} onClick={p.onSubmit}>
              Create <Icon name="enter" size={14} />
            </button>
          )}
          {mode === "filter" && (
            <button type="button" className={s.ghostBtn} onClick={p.onEscape}>
              Clear <Kbd>Esc</Kbd>
            </button>
          )}
          {mode === "idle" && (
            <span className={s.cmdHints}>
              <Kbd>/</Kbd>
              <button type="button" className={s.ghostBtn} onClick={p.onShortcuts} aria-label="Keyboard shortcuts">
                <Icon name="keyboard" /> <span className={s.hideSm}>Shortcuts</span>
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StripBtn({ icon, label, k, onClick, danger }: { icon: React.ReactNode; label: string; k: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={s.stripBtn} data-danger={danger || undefined} onClick={onClick}>
      <span className={s.stripIcon}>{icon}</span>
      {label}
      <span className={s.stripKey} aria-hidden>
        {k}
      </span>
    </button>
  );
}

function TokenChip({ t, i }: { t: Token; i: number }) {
  const style = { animationDelay: `${i * 40}ms` };
  switch (t.kind) {
    case "assign":
      return (
        <span className={s.token} style={style}>
          <Avatar person={t.person} size={18} />
          {t.person ? PEOPLE[t.person].name : "No one"}
        </span>
      );
    case "due":
      return (
        <span className={s.token} style={style}>
          <Icon name="calendar" size={14} />
          {t.date ? longDate(t.date) : "No date"}
        </span>
      );
    case "priority":
      return (
        <span className={s.token} style={style}>
          <PriorityIcon p={t.p} />
          {PRIORITIES.find((x) => x.p === t.p)!.name}
        </span>
      );
    case "status":
      return (
        <span className={s.token} style={style}>
          <StatusGlyph status={t.s} size={14} />
          {STATUSES.find((x) => x.id === t.s)!.name}
        </span>
      );
    case "label":
      return (
        <span className={s.token} style={style}>
          <span className={s.dot} style={{ background: LABELS[t.label].tone }} />
          {LABELS[t.label].name}
        </span>
      );
    case "late":
      return (
        <span className={s.token} style={style}>
          <Icon name="calendar" size={14} />
          Late
        </span>
      );
    case "delete":
      return (
        <span className={s.token} data-danger style={style}>
          <Icon name="trash" size={14} />
          Delete
        </span>
      );
    default:
      return null;
  }
}
