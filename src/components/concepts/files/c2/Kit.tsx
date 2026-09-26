"use client";

import { type DragEvent, useRef, useState } from "react";
import * as I from "./icons";
import { cx, countdown, dayNum, monthName, plural, TODAY_DAY, weekday, type FileView, type KitView, type PackResult, askLabel } from "./model";
import { Preview } from "./Preview";
import k from "./kit.module.css";

/* ── Readiness: one bar, one line ────────────────────────────────────── */

function statusLine(kit: KitView) {
  const r = kit.r;
  if (kit.tone === "done") return "Done and filed";
  if (kit.tone === "set") return `All set for ${kit.kitName}`;
  const left: string[] = [];
  if (r.missing) left.push(`${r.missing} missing`);
  if (r.waiting) left.push(`${r.waiting} waiting`);
  if (r.draft) left.push(`${r.draft} in draft`);
  return left.join(", ");
}

/** A 28px stack of the kit's first pages. Once packed, it closes into a folder. */
function MiniStack({ kit, packed }: { kit: KitView; packed: boolean }) {
  const pages = kit.files.filter((f) => f.state !== "missing").slice(0, 3);
  if (packed) {
    return (
      <span className={k.miniFolder} title={`Packed, ${plural(kit.files.length, "file")}`} aria-hidden="true">
        <span className={k.miniFolderTab} />
        <span className={k.miniFolderFront}>
          <I.Check size={10} strokeWidth={2.6} />
        </span>
      </span>
    );
  }
  return (
    <span className={k.miniStack} aria-hidden="true">
      {pages.map((f, i) => (
        <span key={f.id} className={k.miniPage} style={{ ["--n" as string]: pages.length - 1 - i }}>
          <Preview spec={f.preview} kind={f.kind} />
        </span>
      ))}
      {pages.length === 0 && <span className={cx(k.miniPage, k.miniGhost)} style={{ ["--n" as string]: 0 }} />}
    </span>
  );
}

export function Meter({ kit, packed }: { kit: KitView; packed: boolean }) {
  const order = { ready: 0, draft: 1, waiting: 2, missing: 3 } as const;
  const segs = [...kit.files].sort((a, b) => order[a.state] - order[b.state]);
  const status = statusLine(kit);
  const good = kit.tone === "set" || kit.tone === "done";
  return (
    <div className={k.meter}>
      <div className={k.meterRow}>
        <div className={k.meterBar} role="img" aria-label={`${kit.r.ready} of ${kit.r.total} files ready`}>
          {segs.map((f) => (
            <span key={f.id} className={k.seg} data-state={f.state} />
          ))}
        </div>
        <MiniStack kit={kit} packed={packed} />
      </div>
      <p className={k.status} data-tone={kit.tone}>
        {good && <I.CheckCircle size={14} className={k.statusIcon} />}
        <span className={k.meterCount}>
          <span key={kit.r.ready} className={k.meterNum}>
            {kit.r.ready}
          </span>{" "}
          of {kit.r.total} ready
        </span>
        {status && <span className={k.statusRest}>{good ? `, ${status.charAt(0).toLowerCase()}${status.slice(1)}` : ` · ${status}`}</span>}
      </p>
    </div>
  );
}

/* ── A file in a kit ─────────────────────────────────────────────────── */

const STATE_ICON = {
  ready: I.CheckCircle,
  draft: I.Pencil,
  waiting: I.Clock,
  missing: I.Dashed,
};

export function StateLine({ f }: { f: FileView }) {
  const Icon = STATE_ICON[f.state];
  const word = f.state === "ready" ? "Ready" : f.state === "draft" ? "Draft" : null;
  return (
    <span className={k.stateLine} data-state={f.state}>
      <Icon size={13} className={k.stateIcon} />
      <span className={k.stateText}>
        {word && <b>{word}</b>}
        {word && " · "}
        {f.note}
      </span>
    </span>
  );
}

type FileHandlers = {
  onOpen: (fileId: string) => void;
  onAsk: (fileId: string) => void;
  onLand: (fileId: string, name: string) => void;
};

export function FileRow({ f, selected, justLanded, onOpen }: { f: FileView; selected: boolean; justLanded: boolean; onOpen: (id: string) => void }) {
  return (
    <li className={k.rowItem}>
      <button
        type="button"
        className={cx(k.row, selected && k.rowSelected, justLanded && k.rowLanded)}
        data-state={f.state}
        data-file={f.id}
        onClick={() => onOpen(f.id)}
      >
        <span className={k.thumb}>
          <Preview spec={f.preview} kind={f.kind} />
          {f.state === "ready" && (
            <span className={k.thumbTick}>
              <I.Check size={10} strokeWidth={2.4} />
            </span>
          )}
        </span>
        <span className={k.rowBody}>
          <span className={k.rowName}>{f.name}</span>
          <StateLine f={f} />
        </span>
      </button>
    </li>
  );
}

export function MissingCard({
  f,
  kitTitle,
  selected,
  showAsk,
  onOpen,
  onAsk,
  onLand,
}: { f: FileView; kitTitle: string; selected: boolean; showAsk: boolean } & FileHandlers) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ask = askLabel(f.who);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    onLand(f.id, file?.name ?? f.name);
  };
  return (
    <li className={k.missingItem}>
      <div
        className={cx(k.missing, over && k.missingOver, selected && k.rowSelected)}
        data-file={f.id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!over) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <button type="button" className={k.missingMain} onClick={() => onOpen(f.id)}>
          <span className={k.ghostThumb}>
            <I.Plus size={14} />
          </span>
          <span className={k.rowBody}>
            <span className={k.rowName}>{f.name}</span>
            <span className={k.missingNote}>{over ? `Drop to add it to ${kitTitle.toLowerCase()}` : f.asked ? `Asked ${f.who} today` : f.note}</span>
          </span>
        </button>
        <div className={k.missingActions}>
          {ask && f.asked && (
            <span className={k.askedChip}>
              <I.Send size={12} /> Request sent
            </span>
          )}
          {ask && !f.asked && showAsk && (
            <button type="button" className={k.miniBtnGhost} onClick={() => onAsk(f.id)}>
              <I.Send size={12} /> {ask}
            </button>
          )}
          <button type="button" className={k.miniBtnGhost} onClick={() => input.current?.click()}>
            <I.Upload size={12} /> {ask ? "Add file" : "Add the file"}
          </button>
          <span className={k.dropHint}>or drop it here</span>
          <input
            ref={input}
            type="file"
            className={k.hiddenInput}
            data-land={f.id}
            tabIndex={-1}
            aria-label={`Add ${f.name}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onLand(f.id, file.name);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </li>
  );
}

/* ── A kit column ────────────────────────────────────────────────────── */

type KitProps = FileHandlers & {
  kit: KitView;
  shown: FileView[];
  hidden: number;
  isNext: boolean;
  dim: boolean;
  flash: boolean;
  hovered: boolean;
  packed?: PackResult;
  selectedFileId: string | null;
  landed: Set<string>;
  onPack: () => void;
  onCollapse?: () => void;
  onHover: (id: string | null) => void;
  setRef: (el: HTMLElement | null) => void;
  index: number;
};

/** What the kit needs next decides its main button. */
function nextStep(kit: KitView) {
  const askable = kit.files.filter((f) => f.state === "missing" && !f.asked && askLabel(f.who));
  if (!askable.length) return null;
  const people = new Set(askable.map((f) => f.who));
  const who = askable[0].who!;
  const label = people.size === 1 ? `Ask ${who} for ${plural(askable.length, "file")}` : `Chase ${plural(askable.length, "file")}`;
  return { label, fileId: askable[0].id, many: askable.length > 1 };
}

export function KitColumn({ setRef, ...p }: KitProps) {
  const { kit } = p;
  const late = kit.tone === "overdue";
  const cd = countdown(kit.day);
  const missing = p.shown.filter((f) => f.state === "missing");
  const rest = p.shown.filter((f) => f.state !== "missing");
  const step = p.packed ? null : nextStep(kit);
  const strong = late || p.isNext || kit.tone === "set";
  return (
    <article
      ref={setRef}
      tabIndex={-1}
      className={cx(k.kit, p.dim && k.kitDim, p.flash && k.kitFlash, p.hovered && k.kitHovered)}
      data-tone={kit.tone}
      data-next={p.isNext || undefined}
      data-packed={p.packed ? "" : undefined}
      data-col-day={kit.day}
      data-kit={kit.id}
      aria-labelledby={`kit-${kit.id}`}
      onMouseEnter={() => p.onHover(kit.id)}
      onMouseLeave={() => p.onHover(null)}
      style={{ ["--i" as string]: p.index }}
    >
      <header className={k.kitHead}>
        <div className={k.kitTop}>
          <div className={k.dateTile}>
            <span className={k.dateWd}>{weekday(kit.day)}</span>
            <span className={k.dateNum}>{dayNum(kit.day)}</span>
            <span className={k.dateMo}>{monthName(kit.day)}</span>
          </div>
          <div className={k.kitTitleWrap}>
            <div className={k.kitChips}>
              {p.isNext && <span className={k.nextChip}>Next up</span>}
              <span className={cx(k.countChip, late && k.countLate)}>{late ? `${TODAY_DAY - kit.day} days late` : cd}</span>
            </div>
            <h3 id={`kit-${kit.id}`} className={k.kitTitle}>
              {kit.title}
            </h3>
            {(kit.time || kit.place) && <p className={k.kitMeta}>{[kit.time, kit.place].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
        <Meter kit={kit} packed={!!p.packed} />
      </header>

      {missing.length > 0 && (
        <ul className={k.missingList} aria-label={`Missing from ${kit.title}`}>
          {missing.map((f) => (
            <MissingCard
              key={f.id}
              f={f}
              kitTitle={kit.title}
              selected={p.selectedFileId === f.id}
              showAsk={!!step?.many}
              onOpen={p.onOpen}
              onAsk={p.onAsk}
              onLand={p.onLand}
            />
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <ul className={k.list} aria-label={`Files for ${kit.title}`}>
          {rest.map((f) => (
            <FileRow key={f.id} f={f} selected={p.selectedFileId === f.id} justLanded={p.landed.has(f.id)} onOpen={p.onOpen} />
          ))}
        </ul>
      )}
      {p.shown.length === 0 && <p className={k.listEmpty}>{p.hidden ? `Everything here is ready. ${plural(p.hidden, "file")} hidden.` : "Nothing matches"}</p>}
      {p.hidden > 0 && p.shown.length > 0 && <p className={k.hiddenNote}>{plural(p.hidden, "ready file")} hidden</p>}

      <footer className={k.kitFoot}>
        {p.packed ? (
          <button type="button" className={k.packedBtn} onClick={p.onPack}>
            <span className={k.packedIcon}>
              <I.Check size={12} strokeWidth={2.2} />
            </span>
            <span className={k.packedText}>
              <b>Packed</b>
              <span>{p.packed.mode === "link" ? `Link open until ${p.packed.expires}` : p.packed.mode === "offline" ? `Saved for offline, ${p.packed.size}` : "Print bundle ready"}</span>
            </span>
            <I.ChevronRight size={14} />
          </button>
        ) : step ? (
          <div className={k.footRow}>
            <button type="button" className={cx(k.packBtn, strong && k.packBtnStrong)} data-tone={kit.tone} onClick={() => p.onAsk(step.fileId)}>
              <I.Send size={14} />
              {step.label}
            </button>
            <button type="button" className={k.packIcon} onClick={p.onPack} aria-label="Pack this kit" title="Pack this kit">
              <I.Pack size={16} />
            </button>
          </div>
        ) : (
          <button type="button" className={cx(k.packBtn, strong && k.packBtnStrong)} onClick={p.onPack}>
            <I.Pack size={15} />
            Pack this kit
          </button>
        )}
        {p.onCollapse && (
          <button type="button" className={k.collapseBtn} onClick={p.onCollapse}>
            Fold away
          </button>
        )}
      </footer>
    </article>
  );
}

/* ── Done stub ───────────────────────────────────────────────────────── */

export function DoneSpine({ kit, onOpen, setRef }: { kit: KitView; onOpen: () => void; setRef: (el: HTMLElement | null) => void }) {
  const label = `${kit.title}, done ${weekday(kit.day)} ${dayNum(kit.day)} ${monthName(kit.day)}, ${plural(kit.files.length, "file")}. Open the kit`;
  return (
    <article ref={setRef} className={k.spineWrap} data-stub="" data-col-day={kit.day} data-kit={kit.id} tabIndex={-1} aria-label={`${kit.title}, done`}>
      <button type="button" className={k.spine} onClick={onOpen} title={`${kit.title}, done. Open the kit`} aria-label={label}>
        <span className={k.spineCheck}>
          <I.Check size={12} strokeWidth={2.4} />
        </span>
        <span className={k.spineDate}>
          <b>{dayNum(kit.day)}</b>
          {monthName(kit.day)}
        </span>
        <span className={k.spineText}>
          <b>{kit.title}</b>
          <span>
            Done · {dayNum(kit.day)} {monthName(kit.day)}
          </span>
        </span>
        <span className={k.spineCount}>{plural(kit.files.length, "file")}</span>
      </button>
    </article>
  );
}
