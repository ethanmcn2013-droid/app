"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode, type RefObject } from "react";
import {
  PEOPLE,
  PROJECTS,
  PROJECT_ORDER,
  TASKS,
  agoShort,
  suggestTokens,
  tokenKey,
  tokenLabel,
  tokenText,
  type CollectionId,
  type FileItem,
  type ProjectId,
  type TaskId,
  type Token,
} from "./data";
import { Avatar } from "./filmstrip";
import { Icon, KindGlyph } from "./glyphs";
import s from "./inspector.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Count that ticks when it changes ────────────────────────────────── */

export function Tick({ value }: { value: number }) {
  return (
    <span className={s.railCount}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ── Rail ────────────────────────────────────────────────────────────── */

type RailProps = {
  current: CollectionId;
  counts: (c: CollectionId) => number;
  unfiledCount: number;
  project: ProjectId;
  tasks: TaskId[];
  allTasks: boolean;
  onAllTasks: (v: boolean) => void;
  onPick: (c: CollectionId) => void;
};

function RailItem({ id, current, icon, label, count, extra, onPick }: { id: CollectionId; current: CollectionId; icon: ReactNode; label: ReactNode; count?: ReactNode; extra?: ReactNode; onPick: (c: CollectionId) => void }) {
  return (
    <button type="button" className={s.railItem} data-rail="" aria-current={current === id} onClick={() => onPick(id)}>
      <span className={s.railIcon}>{icon}</span>
      <span className={s.railText}>{label}</span>
      {extra}
      {count}
    </button>
  );
}

export function Rail({ current, counts, unfiledCount, project, tasks, allTasks, onAllTasks, onPick }: RailProps) {
  const shown = allTasks ? tasks : tasks.slice(0, 5);
  return (
    <nav className={cx(s.pane, s.rail)} aria-label="Collections">
      <div className={s.railHead}>
        <span className={s.h1} aria-hidden>
          Files
        </span>
        <button type="button" className={s.iconBtn} aria-label="Add files" title="Add files">
          <Icon name="plus" />
        </button>
      </div>
      <div className={s.railScroll}>
        <RailItem id="recent" current={current} onPick={onPick} icon={<Icon name="clock" />} label="Recent" count={<span className={s.railCount}>{counts("recent")}</span>} />
        <RailItem id="starred" current={current} onPick={onPick} icon={<Icon name="star" />} label="Starred" count={<span className={s.railCount}>{counts("starred")}</span>} />
        <RailItem
          id="unfiled"
          current={current}
          onPick={onPick}
          icon={<Icon name="inbox" />}
          label="Unfiled"
          extra={
            unfiledCount > 0 ? (
              <span className={s.warnPill}>
                <Tick value={unfiledCount} />
                <span className={s.srOnly}> need a home</span>
              </span>
            ) : (
              <span className={s.okMark}>
                <Icon name="check" size={14} />
                <span className={s.srOnly}>All filed</span>
              </span>
            )
          }
        />

        <div className={s.railGroup}>
          <p className={s.railLabel}>Projects</p>
          {PROJECT_ORDER.map((p) => (
            <RailItem
              key={p}
              id={`project:${p}`}
              current={current}
              onPick={onPick}
              icon={
                <span className={s.tone} style={{ background: PROJECTS[p].tone }} aria-hidden>
                  {PROJECTS[p].initial}
                </span>
              }
              label={PROJECTS[p].name}
              count={<span className={s.railCount}>{counts(`project:${p}`)}</span>}
            />
          ))}
        </div>

        <div className={s.railGroup}>
          <p className={s.railLabel}>Tasks in {PROJECTS[project].short}</p>
          <AnimatePresence initial={false}>
            {shown.map((t) => (
              <motion.div key={t} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className={s.subList}>
                <RailItem
                  id={`task:${t}`}
                  current={current}
                  onPick={onPick}
                  icon={<span className={s.status} data-s={TASKS[t].status} aria-hidden />}
                  label={<span title={TASKS[t].title}>{TASKS[t].title}</span>}
                  count={<span className={s.railCount}>{counts(`task:${t}`) || ""}</span>}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length > 5 ? (
            <button type="button" className={s.railMore} aria-expanded={allTasks} onClick={() => onAllTasks(!allTasks)}>
              {allTasks ? "Show fewer" : `Show all ${tasks.length} tasks`}
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

/* ── Chip row (medium and phone widths) ──────────────────────────────── */

export function Chips({ current, counts, unfiledCount, onPick }: { current: CollectionId; counts: (c: CollectionId) => number; unfiledCount: number; onPick: (c: CollectionId) => void }) {
  const items: { id: CollectionId; label: string; n: number; warn?: boolean }[] = [
    { id: "recent", label: "Recent", n: counts("recent") },
    { id: "unfiled", label: "Unfiled", n: unfiledCount, warn: unfiledCount > 0 },
    { id: "starred", label: "Starred", n: counts("starred") },
    ...PROJECT_ORDER.map((p) => ({ id: `project:${p}` as CollectionId, label: PROJECTS[p].short, n: counts(`project:${p}`) })),
  ];
  return (
    <div className={s.chips} role="toolbar" aria-label="Collections">
      {items.map((i) => (
        <button key={i.id} type="button" className={s.chip} data-rail="" aria-pressed={current === i.id} onClick={() => onPick(i.id)}>
          {i.label}
          <span className={cx(s.chipCount, i.warn && s.chipWarn)}>{i.n}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Filter field with from: and type: tokens ────────────────────────── */

function FilterField({
  filter,
  tokens,
  filterRef,
  onFilter,
  onAddToken,
  onRemoveToken,
}: {
  filter: string;
  tokens: Token[];
  filterRef: RefObject<HTMLInputElement | null>;
  onFilter: (v: string) => void;
  onAddToken: (t: Token, rest: string) => void;
  onRemoveToken: (t: Token) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [hi, setHi] = useState(0);
  const words = filter.split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const rest = words.slice(0, -1).join(" ");
  const sugg = focused ? suggestTokens(last, tokens) : [];
  const active = Math.min(hi, Math.max(0, sugg.length - 1));
  const accept = (t: Token) => {
    onAddToken(t, rest ? `${rest} ` : "");
    setHi(0);
  };
  return (
    <div className={s.searchWrap}>
      <label className={s.search} data-focus={focused}>
        <Icon name="search" size={14} />
        {tokens.map((t) => (
          <span key={tokenKey(t)} className={s.token}>
            {t.kind === "from" ? <Avatar id={t.id} sm /> : null}
            {tokenLabel(t)}
            <button type="button" className={s.tokenX} aria-label={`Remove ${tokenLabel(t)}`} onClick={() => onRemoveToken(t)}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path d="m2.5 2.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={filterRef}
          className={s.searchInput}
          value={filter}
          role="combobox"
          aria-expanded={sugg.length > 0}
          aria-controls="c1-suggest"
          aria-autocomplete="list"
          aria-activedescendant={sugg.length ? `c1-sugg-${active}` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            onFilter(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (sugg.length && (e.key === "Tab" || e.key === "Enter")) {
              e.preventDefault();
              e.stopPropagation();
              accept(sugg[active]);
            } else if (sugg.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              e.stopPropagation();
              setHi((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + sugg.length) % sugg.length);
            } else if (e.key === "Backspace" && !filter && tokens.length) {
              onRemoveToken(tokens[tokens.length - 1]);
            }
          }}
          placeholder={tokens.length ? "Add more" : "Filter, or try from:Mara type:sheet"}
          aria-label="Filter files"
        />
        {!focused && !filter && !tokens.length ? <kbd className={cx(s.kbd, s.searchKey)}>/</kbd> : null}
      </label>
      {sugg.length ? (
        <ul id="c1-suggest" className={s.suggestMenu} role="listbox" aria-label="Filters">
          {sugg.map((t, i) => (
            <li
              key={tokenKey(t)}
              id={`c1-sugg-${i}`}
              role="option"
              aria-selected={i === active}
              className={s.suggestItem}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(t);
              }}
            >
              {t.kind === "from" ? <Avatar id={t.id} sm /> : <Icon name="type" size={14} />}
              <span className={s.suggestText}>{tokenText(t)}</span>
              <span className={s.suggestHint}>{t.kind === "from" ? PEOPLE[t.id].name : tokenLabel(t)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── List ────────────────────────────────────────────────────────────── */

export type Group = { key: string; label?: string; rows: FileItem[]; kind?: "triage" | "filed" | "cleared" };

type ListProps = {
  title: string;
  count: number;
  groups: Group[];
  selectedId: string | undefined;
  kbd: boolean;
  filter: string;
  tokens: Token[];
  filterRef: RefObject<HTMLInputElement | null>;
  upload: number;
  filed: Record<string, TaskId | undefined>;
  isUnfiledView: boolean;
  emptyTask?: string;
  chips: ReactNode;
  onFilter: (v: string) => void;
  onAddToken: (t: Token, rest: string) => void;
  onRemoveToken: (t: Token) => void;
  onSelect: (id: string) => void;
  onFile: (id: string) => void;
};

export function ListPane({ filterRef, ...p }: ListProps) {
  const noRows = p.groups.every((g) => g.rows.length === 0);
  const countText = p.isUnfiledView ? (p.count ? `${p.count} need a home` : "All filed") : `${p.count} ${p.count === 1 ? "file" : "files"}`;
  return (
    <section className={cx(s.pane, s.list)} aria-label="Files">
      <div className={s.listHead}>
        <h1 className={cx(s.h1, s.listH1)}>
          Files<span className={s.h1Coll}> · {p.title}</span>
        </h1>
        <div className={s.listTitleRow}>
          <h2 className={s.listTitle}>{p.title}</h2>
          <span className={s.listCount}>{countText}</span>
        </div>
        <FilterField filter={p.filter} tokens={p.tokens} filterRef={filterRef} onFilter={p.onFilter} onAddToken={p.onAddToken} onRemoveToken={p.onRemoveToken} />
      </div>
      {p.chips}
      <div
        className={s.listScroll}
        role="listbox"
        tabIndex={0}
        aria-label={`${p.title}, ${countText}`}
        aria-activedescendant={p.selectedId ? `c1-row-${p.selectedId}` : undefined}
      >
        {p.emptyTask && noRows ? (
          <div className={cx(s.empty, s.emptyDrop)}>
            <span className={s.dropArt}>
              <Icon name="upload" size={20} />
            </span>
            <h3>Nothing on this task yet</h3>
            <p>Drop a file here or paste a link. It shows up on “{p.emptyTask}” too.</p>
            <button type="button" className={s.ghostBtn}>
              <Icon name="plus" size={14} /> Add a file
            </button>
          </div>
        ) : null}
        {!p.emptyTask && noRows && (p.filter || p.tokens.length) ? (
          <div className={s.empty}>
            <h3>{p.filter ? `No files match “${p.filter}”` : "No files match these filters"}</h3>
            <p>Try a task name, from:someone, or a type like type:sheet.</p>
          </div>
        ) : null}
        {p.groups.map((g) => (
          <div key={g.key} role="group" aria-label={g.label}>
            {g.label ? (
              <div className={s.groupHead} aria-hidden>
                {g.kind === "filed" ? <Icon name="check" size={12} /> : null}
                <span>{g.label}</span>
                {g.rows.length ? <span className={s.groupCount}>{g.rows.length}</span> : null}
              </div>
            ) : null}
            {g.kind === "cleared" && g.rows.length === 0 ? <Cleared /> : null}
            {g.rows.map((f) => (
              <Row
                key={f.id}
                f={f}
                selectedId={p.selectedId}
                kbd={p.kbd}
                upload={p.upload}
                filed={p.filed}
                isUnfiledView={p.isUnfiledView}
                onSelect={p.onSelect}
                onFile={p.onFile}
                triage={g.kind === "triage"}
                filedGroup={g.kind === "filed"}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={s.legend} aria-label="Keyboard shortcuts">
        <span>
          <kbd className={s.kbd}>↑</kbd>
          <kbd className={s.kbd}>↓</kbd> Move
        </span>
        <span>
          <kbd className={s.kbd}>[</kbd>
          <kbd className={s.kbd}>]</kbd> Versions
        </span>
        <span>
          <kbd className={s.kbd}>Space</kbd> Focus
        </span>
        <span>
          <kbd className={s.kbd}>⏎</kbd> File
        </span>
      </div>
    </section>
  );
}

function Cleared() {
  return (
    <motion.div className={s.empty} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}>
      <svg className={s.clearArt} viewBox="0 0 64 64" aria-hidden>
        <path className={s.clearLeaf} d="M47 12c6 1 9 6 8 11-5 0-10-3-8-11Z" />
        <path className={s.clearLeaf} d="M12 44c-5 2-6 8-3 11 4-2 6-6 3-11Z" />
        <circle className={s.clearRing} cx="32" cy="32" r="20" />
        <path className={s.clearTick} d="m23 32.5 6.5 6.5L42 26" />
      </svg>
      <h3>Everything has a home</h3>
      <p>New files from email, and uploads without a task, land here first.</p>
    </motion.div>
  );
}

function Row({
  f,
  selectedId,
  kbd,
  upload,
  filed,
  triage,
  filedGroup,
  isUnfiledView,
  onSelect,
  onFile,
}: Pick<ListProps, "selectedId" | "kbd" | "upload" | "filed" | "isUnfiledView" | "onSelect" | "onFile"> & { f: FileItem; triage: boolean; filedGroup: boolean }) {
  const n = f.versions.length;
  const last = f.versions[n - 1];
  const uploading = f.uploading && upload < 100;
  const stillUnfiled = !!f.unfiled && !filed[f.id];
  const selected = selectedId === f.id;
  const sub = uploading ? `Uploading, ${upload}%` : `${PEOPLE[last.by].short} · ${agoShort(f.minutesAgo)}${f.tasks[0] ? ` · ${TASKS[f.tasks[0]].title}` : ""}`;

  const common = {
    id: `c1-row-${f.id}`,
    role: "option" as const,
    "aria-selected": selected,
    "data-kbd": kbd,
    "data-uploading": uploading ? true : undefined,
    onClick: () => onSelect(f.id),
  };

  const body =
    triage && f.unfiled ? (
      <>
        <span className={s.rowGlyph}>
          <KindGlyph kind={f.kind} />
        </span>
        <div className={s.triageBody}>
          <div className={s.triageTop}>
            <span className={s.rowName}>{f.name}</span>
            <span className={s.rowMeta}>{agoShort(f.minutesAgo)}</span>
          </div>
          <span className={s.triageFrom}>{f.unfiled.from}</span>
          <div className={s.suggest}>
            <span className={s.suggestLine}>
              Looks like it belongs to <strong>{TASKS[f.unfiled.suggest].title}</strong>
            </span>
            {/* Pointer shortcut only: keyboard and screen readers file with Enter, or the previewer's File it button. */}
            <span
              className={s.fileBtn}
              aria-hidden
              onClick={(e) => {
                e.stopPropagation();
                onFile(f.id);
              }}
            >
              File <kbd className={s.kbd}>⏎</kbd>
            </span>
          </div>
        </div>
      </>
    ) : (
      <>
        <span className={s.rowGlyph}>
          <KindGlyph kind={f.kind} />
        </span>
        <span className={s.rowMain}>
          <span className={s.rowName}>{f.name}</span>
          <span className={s.rowSub}>{sub}</span>
        </span>
        {stillUnfiled && !isUnfiledView ? <span className={s.unfiledTag}>Unfiled</span> : null}
        {filedGroup && filed[f.id] ? (
          <span className={s.filedTo}>
            <Icon name="check" size={12} />
            <span>Filed</span>
          </span>
        ) : null}
        {n > 1 ? (
          <span className={s.vBadge} title={`${n} versions`}>
            v{n}
            <span className={s.srOnly}>, {n} versions</span>
          </span>
        ) : null}
        {!filedGroup ? <span className={s.rowMeta}>{uploading ? `${upload}%` : `${PEOPLE[last.by].short} · ${agoShort(f.minutesAgo)}`}</span> : null}
        {uploading ? (
          <span className={s.progress} aria-hidden>
            <span style={{ width: `${upload}%` }} />
          </span>
        ) : null}
      </>
    );

  if (isUnfiledView) {
    return (
      <motion.div layout layoutId={`c1-${f.id}`} transition={{ type: "spring", stiffness: 420, damping: 38 }} className={cx(s.row, triage && s.triage)} {...common}>
        {body}
      </motion.div>
    );
  }
  return (
    <div className={s.row} {...common}>
      {body}
    </div>
  );
}
