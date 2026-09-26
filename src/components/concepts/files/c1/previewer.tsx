"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PEOPLE, PROJECTS, TASKS, sourceLabel, type FileItem, type TaskId } from "./data";
import { Avatar, Dock } from "./filmstrip";
import { Icon, KindGlyph } from "./glyphs";
import { Mock } from "./mocks";
import { SignArt } from "./scenes";
import s from "./inspector.module.css";
import m from "./mocks.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export { Avatar };

type ViewerProps = {
  file: FileItem | undefined;
  starred: boolean;
  pos: number;
  scrubbing: boolean;
  showChanges: boolean;
  focus: boolean;
  open: boolean;
  isUnfiled: boolean;
  detailsOpen: boolean;
  onDetails: (v: boolean) => void;
  onPos: (pos: number, dragging: boolean) => void;
  onToggleChanges: () => void;
  onToggleFocus: () => void;
  onStar: () => void;
  onJumpTask: (t: TaskId) => void;
  onFile: () => void;
  onClose: () => void;
  emptyLabel: string;
};

export function Previewer(p: ViewerProps) {
  const { file } = p;
  const n = file?.versions.length ?? 1;
  const vIndex = Math.max(0, Math.min(n - 1, Math.round(p.pos)));
  const version = file?.versions[vIndex];
  const base = Math.max(0, Math.min(n - 2, Math.floor(p.pos)));
  const frac = p.pos - base;
  const morphing = !!file && n > 1 && p.scrubbing && frac > 0.001 && frac < 0.999;
  const changes = p.showChanges && !file?.locked;

  return (
    <section className={cx(s.pane, s.viewer)} data-open={p.open} aria-label="Preview">
      <header className={s.vHead}>
        <button type="button" className={cx(s.iconBtn, s.back)} onClick={p.onClose} aria-label="Back to files">
          <Icon name="back" size={20} />
        </button>
        {file ? (
          <>
            <div className={s.vTitleBlock}>
              <h2 className={s.vTitle}>
                <KindGlyph kind={file.kind} />
                <span>{file.name}</span>
              </h2>
              <p className={s.vMeta}>
                <span className={s.tone} style={{ background: PROJECTS[file.project].tone }} aria-hidden>
                  {PROJECTS[file.project].initial}
                </span>
                {PROJECTS[file.project].short} · {PEOPLE[file.versions[n - 1].by].short} · {file.uploading ? "uploading" : `edited ${file.versions[n - 1].ago.toLowerCase()}`}
              </p>
            </div>
            <div className={s.vActions}>
              <button type="button" className={s.iconBtn} aria-pressed={p.starred} aria-label={p.starred ? "Unstar" : "Star"} title="Star (S)" onClick={p.onStar}>
                <Icon name={p.starred ? "starFill" : "star"} />
              </button>
              <button type="button" className={cx(s.iconBtn, s.hideMedium)} aria-label="Download" title="Download">
                <Icon name="download" />
              </button>
              <button type="button" className={cx(s.iconBtn, s.hideMedium)} aria-label="Open in a new tab" title="Open in a new tab">
                <Icon name="open" />
              </button>
              <button type="button" className={s.iconBtn} aria-label="More actions" title="More">
                <Icon name="more" />
              </button>
              <span className={s.sep} aria-hidden />
              <button type="button" className={s.textBtn}>
                <Icon name="share" size={14} /> Share
              </button>
              <button type="button" className={s.iconBtn} onClick={p.onToggleFocus} aria-pressed={p.focus} aria-label={p.focus ? "Leave focus" : "Focus the preview"} title="Focus (Space)">
                <Icon name={p.focus ? "collapse" : "expand"} />
              </button>
            </div>
          </>
        ) : (
          <div className={s.vTitleBlock}>
            <h2 className={s.vTitle}>
              <span>Nothing to preview yet</span>
            </h2>
          </div>
        )}
      </header>

      {file ? <MetaBar file={file} vIndex={vIndex} isUnfiled={p.isUnfiled} open={p.detailsOpen} onOpen={p.onDetails} onPos={p.onPos} onJumpTask={p.onJumpTask} onFile={p.onFile} /> : null}

      <div className={s.stage} data-dock={file ? (n > 1 && !file.uploading ? "multi" : "solo") : undefined} data-older={!!file && vIndex < n - 1 && !file.uploading}>
        {file && version ? (
          <AnimatePresence initial={false}>
            <motion.div key={file.id} className={s.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12, ease: "linear" }}>
              {version.body.t === "sign" && n > 1 ? (
                <SignWipe file={file} pos={p.pos} scrubbing={p.scrubbing} onPos={p.onPos} />
              ) : morphing ? (
                /* While you drag, the two neighbouring versions cross-fade by how far along you are. */
                <div className={s.morph}>
                  <div className={s.morphLayer} style={{ opacity: 1 - frac }} aria-hidden>
                    <Mock file={file} version={file.versions[base]} prev={file.versions[base - 1]} showChanges={false} />
                  </div>
                  <div className={s.morphLayer} style={{ opacity: frac }}>
                    <Mock file={file} version={file.versions[base + 1]} prev={file.versions[base]} showChanges={changes} />
                  </div>
                </div>
              ) : (
                <Mock file={file} version={version} prev={file.versions[vIndex - 1]} showChanges={changes} />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className={s.stageEmpty}>
            <span className={s.emptyArt} aria-hidden>
              <Icon name="upload" size={20} />
            </span>
            <strong>{p.emptyLabel}</strong>
            <p>The first file that lands here opens in this space, with its versions and tasks around it.</p>
          </div>
        )}
        {file && vIndex < n - 1 && !file.uploading ? (
          <button type="button" className={s.olderBanner} onClick={() => p.onPos(n - 1, false)}>
            <span>
              Older version, v{vIndex + 1} of {n}
            </span>
            <span className={s.olderBack}>
              Back to latest <kbd className={s.kbd}>]</kbd>
            </span>
          </button>
        ) : null}
        {p.focus && file ? (
          <span className={s.stageHint} key={`hint-${file.id}`}>
            <kbd className={s.kbd}>Space</kbd> or <kbd className={s.kbd}>Esc</kbd> to leave focus
          </span>
        ) : null}
        {file && version ? <Dock file={file} pos={p.pos} scrubbing={p.scrubbing} vIndex={vIndex} showChanges={p.showChanges} onPos={p.onPos} onToggleChanges={p.onToggleChanges} /> : null}
      </div>

      {file ? (
        <div className={s.bottomBar}>
          <button type="button" className={cx(s.barBtn, s.barPrimary)}>
            <Icon name="share" size={16} /> Share
          </button>
          <button type="button" className={s.barBtn}>
            <Icon name="open" size={16} /> Open
          </button>
          <button type="button" className={s.barBtn}>
            <Icon name="more" size={16} /> More
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ── Image wipe: the welcome sign, first print against reprint ───────── */

function SignWipe({ file, pos, scrubbing, onPos }: { file: FileItem; pos: number; scrubbing: boolean; onPos: (pos: number, dragging: boolean) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const n = file.versions.length;
  const base = Math.max(0, Math.min(n - 2, Math.floor(pos)));
  const frac = Math.max(0, Math.min(1, pos - base));
  const a = file.versions[base].body;
  const b = file.versions[base + 1].body;
  const fromEvent = (e: ReactPointerEvent) => {
    const r = frameRef.current?.getBoundingClientRect();
    if (!r) return pos;
    return base + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const showHandle = scrubbing || hover || (frac > 0.02 && frac < 0.98);
  return (
    <div className={cx(m.fit, m.photo)} style={{ "--ar": 400 / 560 } as CSSProperties}>
      <div
        ref={frameRef}
        className={cx(m.photoFrame, s.wipe)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onPos(fromEvent(e), true);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) onPos(fromEvent(e), true);
        }}
        onPointerUp={(e) => onPos(Math.round(fromEvent(e)), false)}
        role="img"
        aria-label={`Welcome sign, comparing version ${base + 1} with version ${base + 2}`}
      >
        {a.t === "sign" ? <SignArt look={a.look} /> : null}
        <div className={cx(s.wipeTop, !scrubbing && s.wipeSnap)} style={{ clipPath: `inset(0 ${(1 - frac) * 100}% 0 0)` }}>
          {b.t === "sign" ? <SignArt look={b.look} /> : null}
        </div>
        <span className={cx(s.wipeHandle, !scrubbing && s.wipeSnap)} style={{ left: `${frac * 100}%`, opacity: showHandle ? 1 : 0 }}>
          <span className={s.wipeKnob} aria-hidden>
            ⇆
          </span>
        </span>
        <span className={s.wipeTag} style={{ left: 12, opacity: frac > 0.08 ? 1 : 0 }}>
          v{base + 2}, reprint
        </span>
        <span className={s.wipeTag} style={{ right: 12, opacity: frac < 0.92 ? 1 : 0 }}>
          v{base + 1}, first print
        </span>
      </div>
      <p className={m.caption}>Drag across the artwork, or along the versions below, to compare.</p>
    </div>
  );
}

/* ── Meta bar: one row of what matters, the rest behind Details ──────── */

function MetaBar({
  file,
  vIndex,
  isUnfiled,
  open,
  onOpen,
  onPos,
  onJumpTask,
  onFile,
}: {
  file: FileItem;
  vIndex: number;
  isUnfiled: boolean;
  open: boolean;
  onOpen: (v: boolean) => void;
  onPos: (pos: number, dragging: boolean) => void;
  onJumpTask: (t: TaskId) => void;
  onFile: () => void;
}) {
  const shown = file.sharedWith.slice(0, 3);
  const more = file.sharedWith.length - shown.length;
  const d = details(file);
  const names = file.sharedWith.map((id) => PEOPLE[id].short);
  return (
    <div className={s.metaWrap}>
    <div className={s.meta}>
      <div className={s.metaTasks}>
        {isUnfiled && file.unfiled ? (
          <>
            <span className={s.metaLabel}>Suggested</span>
            <TaskChip id={file.unfiled.suggest} suggest onClick={onFile} />
            <button type="button" className={s.primaryBtn} onClick={onFile}>
              File it <kbd className={s.kbd}>⏎</kbd>
            </button>
          </>
        ) : file.tasks.length ? (
          file.tasks.map((t) => <TaskChip key={t} id={t} onClick={() => onJumpTask(t)} />)
        ) : (
          <span className={s.metaLabel}>No task yet</span>
        )}
      </div>
      <span className={s.stack} role="img" aria-label={`Shared with ${names.join(", ")}`}>
        {shown.map((id) => (
          <Avatar key={id} id={id} />
        ))}
        {more > 0 ? <span className={s.stackMore}>+{more}</span> : null}
      </span>
      <span className={s.metaFacts}>
        {file.size === "Link" ? sourceLabel(file) : file.size} · {file.source === "email" ? "From email" : file.source === "drive" ? "In Drive" : `${sourceLabel(file)} by ${PEOPLE[file.owner].short}`}
      </span>
      <button
        type="button"
        className={cx(s.iconBtn, s.infoBtn)}
        aria-expanded={open}
        aria-controls="c1-details"
        aria-label="Details"
        title="Details (I)"
        onClick={() => onOpen(!open)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.9" fill="currentColor" />
        </svg>
      </button>
    </div>
      <div id="c1-details" className={s.details} data-open={open} role="region" aria-label="File details">
        <div className={s.dSection}>
          <span className={s.dLabel}>Shared with</span>
          <ul className={s.people}>
            {file.sharedWith.map((id) => (
              <li key={id}>
                <Avatar id={id} />
                <span>{PEOPLE[id].name}</span>
                {PEOPLE[id].client ? <span className={s.dMuted}>Client</span> : null}
              </li>
            ))}
          </ul>
          <span className={s.dMuted}>
            {file.linkAccess === "view" ? "Anyone with the link can view" : file.linkAccess === "comment" ? "Anyone with the link can comment" : "Only the people added"}
          </span>
        </div>
        <div className={s.dSection}>
          <span className={s.dLabel}>Versions</span>
          <ol className={s.vList}>
            {[...file.versions].reverse().map((v) => {
              const i = v.n - 1;
              return (
                <li key={v.n}>
                  <button type="button" className={s.vRow} aria-current={i === vIndex} onClick={() => onPos(i, false)}>
                    <span className={s.vN}>v{v.n}</span>
                    <span className={s.vWho}>
                      {PEOPLE[v.by].short}, {v.ago}
                      {v.note ? <span className={s.dMuted}>{v.note}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className={s.dGrid}>
          <div>
            <span className={s.dLabel}>{d.label}</span>
            <span className={s.dValue}>{d.value}</span>
            <span className={s.dMuted}>{d.sub}</span>
          </div>
          <div>
            <span className={s.dLabel}>Source</span>
            <span className={s.dValue}>{sourceLabel(file)}</span>
            <span className={s.dMuted}>
              {file.unfiled ? file.unfiled.from.replace(", by email", "") : file.source === "drive" ? `Owned by ${PEOPLE[file.owner].short}` : file.source === "link" ? "Checked 10 min ago" : `By ${PEOPLE[file.owner].short}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function details(file: FileItem): { label: string; value: string; sub: string } {
  const body = file.versions[file.versions.length - 1].body;
  if (file.kind === "link") return { label: "Kind", value: "Web page", sub: body.t === "link" ? body.domain : "" };
  if (file.kind === "design") return { label: "Kind", value: "Figma file", sub: "3 frames" };
  if (file.source === "drive") return { label: "Kind", value: "Google Sheet", sub: "Lives in Drive" };
  if (body.t === "photo") return { label: "Size", value: file.size, sub: body.h > body.w ? "3024 × 4032 px" : "4032 × 2688 px" };
  if (body.t === "sign") return { label: "Size", value: file.size, sub: "2400 × 3360 px" };
  if (body.t === "swatches") return { label: "Size", value: file.size, sub: "3000 × 2000 px" };
  if (body.t === "none") return { label: "Size", value: file.size, sub: "AutoCAD drawing" };
  return { label: "Size", value: file.size, sub: file.pages ?? `.${file.ext}` };
}

function TaskChip({ id, suggest, onClick }: { id: TaskId; suggest?: boolean; onClick: () => void }) {
  const t = TASKS[id];
  return (
    <button type="button" className={cx(s.taskChip, suggest && s.suggestChip)} onClick={onClick}>
      <span className={s.status} data-s={t.status} aria-hidden />
      <span className={s.taskChipText}>{t.title}</span>
      <span className={s.hover} role="tooltip">
        <span className={s.hoverTitle}>{t.title}</span>
        <span className={s.hoverMeta}>
          <span className={s.status} data-s={t.status} aria-hidden /> {t.status} · due {t.due}
        </span>
        <span className={s.hoverMeta}>
          <Avatar id={t.owner} /> {PEOPLE[t.owner].name} · {PROJECTS[t.project].short}
        </span>
        <span className={s.hoverFoot}>{suggest ? "Click or press Enter to file it here" : "Click to see every file on this task"}</span>
      </span>
    </button>
  );
}
