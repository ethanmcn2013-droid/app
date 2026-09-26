"use client";

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PEOPLE, versionDelta, type FileItem, type PersonId, type Version } from "./data";
import { SignArt } from "./scenes";
import s from "./inspector.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Avatar({ id, lg, sm }: { id: PersonId; lg?: boolean; sm?: boolean }) {
  const p = PEOPLE[id];
  return (
    <span className={cx(s.avatar, lg && s.avatarLg, sm && s.avatarSm)} style={{ background: p.tone }} title={p.name} aria-hidden>
      {p.initials}
    </span>
  );
}

/* ── Thumbnail of one version: a tiny map of where it changed ─────────── */

export function Thumb({ file, i }: { file: FileItem; i: number }) {
  const body = file.versions[i].body;
  if (body.t === "sign") {
    return (
      <span className={cx(s.thumbArt, s.thumbImage)}>
        <SignArt look={body.look} />
      </span>
    );
  }
  if (body.t === "logo") {
    return (
      <span className={cx(s.thumbArt, s.thumbCanvas)} data-round={body.round}>
        {body.round === 1 ? (
          <>
            <i />
            <i />
            <i />
          </>
        ) : (
          <b />
        )}
      </span>
    );
  }
  const d = versionDelta(file, i);
  if (d.grid) {
    const cells = Math.min(d.lines, d.grid.cols * 7);
    return (
      <span className={cx(s.thumbArt, s.thumbGrid)} style={{ "--tc": d.grid.cols } as CSSProperties}>
        {Array.from({ length: cells }, (_, k) => (
          <i key={k} data-on={d.changed.includes(k) || undefined} />
        ))}
      </span>
    );
  }
  const lines = Math.min(d.lines, 10);
  return (
    <span className={cx(s.thumbArt, s.thumbPage)}>
      <b />
      {Array.from({ length: lines }, (_, k) => (
        <i key={k} data-on={d.changed.includes(k) || undefined} style={{ width: `${62 + ((k * 23) % 34)}%` }} />
      ))}
    </span>
  );
}

/* ── The dock: floats over the bottom of the stage ────────────────────── */

type DockProps = {
  file: FileItem;
  pos: number;
  scrubbing: boolean;
  vIndex: number;
  showChanges: boolean;
  onPos: (pos: number, dragging: boolean) => void;
  onToggleChanges: () => void;
};

export function Dock({ file, pos, scrubbing, vIndex, showChanges, onPos, onToggleChanges }: DockProps) {
  const filmRef = useRef<HTMLDivElement>(null);
  const n = file.versions.length;
  const v: Version = file.versions[vIndex];

  if (file.uploading) {
    return (
      <div className={cx(s.dock, s.dockSolo)}>
        <Avatar id="you" lg />
        <div className={s.dockText}>
          <span className={s.dockLine}>Uploading to Harbour Bakery launch</span>
          <span className={s.dockNote}>Keep working. It lands on its task when it&apos;s done.</span>
        </div>
      </div>
    );
  }

  if (n < 2) {
    return (
      <div className={cx(s.dock, s.dockSolo)}>
        <Avatar id={v.by} lg />
        <div className={s.dockText}>
          <span className={s.dockLine}>
            {file.kind === "link" ? "Added" : "Version 1"} · {PEOPLE[v.by].short}, {v.ago}
          </span>
          <span className={s.dockNote}>
            {file.kind === "link" ? "Links stay live. We check them every hour." : file.source === "drive" ? "Edits in Drive arrive here as new versions." : "Upload a new copy and it stacks here as version 2."}
          </span>
        </div>
      </div>
    );
  }

  const fromEvent = (e: ReactPointerEvent) => {
    const r = filmRef.current?.getBoundingClientRect();
    if (!r) return pos;
    const pad = 36;
    const t = Math.max(0, Math.min(1, (e.clientX - r.left - pad) / (r.width - pad * 2)));
    return t * (n - 1);
  };
  const at = (x: number) => `calc(36px + (100% - 72px) * ${x / (n - 1)})`;

  return (
    <div className={cx(s.dock, s.dockMulti)}>
      <div className={s.dockHead}>
        <Avatar id={v.by} lg />
        <span className={s.dockLine}>
          v{v.n} · {PEOPLE[v.by].short}, {v.ago}
          {vIndex > 0 ? <span className={s.dockDelta}> · {versionDelta(file, vIndex).label.toLowerCase()}</span> : null}
        </span>
        <button type="button" className={s.toggle} aria-pressed={showChanges} onClick={onToggleChanges} title="Show changes (C)">
          <span className={s.switch} aria-hidden />
          Changes
        </button>
      </div>
      <p className={s.dockNote2}>
        <span className={s.whatMark}>{vIndex === 0 ? "Start" : "What changed"}</span>
        {v.note ?? "The first version"}
      </p>
      <div
        ref={filmRef}
        className={s.film}
        style={{ "--n": n } as CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label="Version"
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={vIndex + 1}
        aria-valuetext={`Version ${vIndex + 1} of ${n}, ${PEOPLE[v.by].short}, ${v.ago}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onPos(fromEvent(e), true);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) onPos(fromEvent(e), true);
        }}
        onPointerUp={(e) => onPos(Math.round(fromEvent(e)), false)}
        onPointerCancel={() => onPos(Math.round(pos), false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            onPos(Math.max(0, Math.min(n - 1, vIndex + (e.key === "ArrowLeft" ? -1 : 1))), false);
          }
        }}
      >
        <span className={s.filmRail} aria-hidden>
          <span className={cx(s.filmFill, !scrubbing && s.snap)} style={{ width: `${(pos / (n - 1)) * 100}%` }} />
        </span>
        {file.versions.map((ver, i) => {
          const d = versionDelta(file, i);
          const near = Math.max(0, 1 - Math.abs(pos - i));
          return (
            <span key={ver.n} className={s.stop} data-current={i === vIndex} data-past={i <= pos + 0.001} style={{ left: at(i), "--near": near } as CSSProperties} aria-hidden>
              <span className={s.stopDelta}>{d.label}</span>
              <span className={s.stopFrame}>
                <Thumb file={file} i={i} />
                <span className={s.stopWho}>
                  <Avatar id={ver.by} sm />
                </span>
              </span>
              <span className={s.stopTick} />
            </span>
          );
        })}
        <span className={cx(s.knob, !scrubbing && s.snap)} style={{ left: at(pos) }} aria-hidden />
      </div>
    </div>
  );
}
