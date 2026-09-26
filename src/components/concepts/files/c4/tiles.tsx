"use client";

import { useRef, type CSSProperties, type DragEvent, type MouseEvent, type PointerEvent as RPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Art } from "./art";
import { PEOPLE, bare, kindLabel, type Asset, type Verdict } from "./data";
import * as I from "./icons";
import s from "./moodwall.module.css";

export function Avatar({ name, size = 20, ring }: { name: string; size?: number; ring?: boolean }) {
  // Below 16px an initial is unreadable, so it becomes a plain colour dot.
  return (
    <span className={`${s.avatar} ${ring ? s.avatarRing : ""}`} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.46)), background: PEOPLE[name] ?? "var(--v3-kind-neutral)" }} aria-hidden="true">
      {size >= 16 ? name[0] : null}
    </span>
  );
}

function PdfFace({ asset }: { asset: Asset }) {
  const [title, ...rest] = asset.lines ?? [asset.name];
  const deck = asset.project === "kiln";
  return (
    <div className={`${s.face} ${s.pdfFace}`}>
      <div className={s.pdfStack} aria-hidden="true" />
      <div className={`${s.pdfPage} ${deck ? s.pdfDeck : ""}`}>
        <div className={s.pdfTitle}>{title}</div>
        <div className={s.pdfRule} />
        {rest.map((line, i) => (
          <div key={i} className={s.pdfLine}>
            {line}
          </div>
        ))}
        <div className={s.pdfFiller}>
          {[88, 72, 80, 60, 76].map((w, i) => (
            <span key={i} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <span className={s.kindTag} style={{ "--kind": "var(--v3-danger)" } as CSSProperties}>
        PDF · {asset.pages} {asset.pages === 1 ? "page" : "pages"}
      </span>
    </div>
  );
}

function SheetFace({ asset }: { asset: Asset }) {
  const cols = asset.lines ?? ["A", "B", "C"];
  const rows = 9;
  return (
    <div className={`${s.face} ${s.sheetFace}`}>
      <div className={s.sheetGrid} style={{ gridTemplateColumns: `28px repeat(${cols.length}, 1fr)` }}>
        <span className={s.sheetCorner} />
        {cols.map((c) => (
          <span key={c} className={s.sheetHead}>
            {c}
          </span>
        ))}
        {Array.from({ length: rows }, (_, r) => (
          <SheetRow key={r} r={r} cols={cols.length} />
        ))}
      </div>
      <span className={s.kindTag} style={{ "--kind": "var(--v3-kind-sheet)" } as CSSProperties}>
        Sheet{asset.source === "Google Drive" ? " · Google Drive" : ""}
      </span>
    </div>
  );
}

function SheetRow({ r, cols }: { r: number; cols: number }) {
  return (
    <>
      <span className={s.sheetNum}>{r + 1}</span>
      {Array.from({ length: cols }, (_, c) => {
        const w = 30 + ((r * 7 + c * 13) % 55);
        const tint = c === cols - 1 && r % 3 !== 1;
        return (
          <span key={c} className={s.sheetCell}>
            <i style={{ width: `${w}%` }} className={tint ? s.sheetTint : ""} />
          </span>
        );
      })}
    </>
  );
}

export function TypeFace({ asset }: { asset: Asset }) {
  if (asset.kind === "quote") {
    return (
      <div className={`${s.face} ${s.typeFace}`}>
        <span className={s.typeKind}>
          <i style={{ background: "var(--v3-kind-doc)" }} />
          Quote
        </span>
        <div className={s.quoteVendor}>{asset.vendor}</div>
        <div className={s.quoteAmount}>{asset.amount}</div>
        <div className={s.typeDetail}>{asset.detail}</div>
        <div className={s.quoteFoot}>
          <span>Quote, PDF</span>
          <span>{asset.size}</span>
        </div>
      </div>
    );
  }
  if (asset.kind === "link") {
    const brand = asset.brand ?? "var(--v3-kind-link)";
    return (
      <div className={`${s.face} ${s.typeFace} ${s.linkFace}`} style={{ "--brand": brand } as CSSProperties}>
        <span className={s.linkMark} aria-hidden="true">
          {(asset.domain ?? asset.name)[0].toUpperCase()}
        </span>
        <div className={s.linkTitle}>{asset.detail}</div>
        <div className={s.linkDomain}>
          <I.Link size={12} />
          {asset.domain}
        </div>
        <span className={s.linkArrow} aria-hidden="true">
          <I.Arrow size={14} />
        </span>
      </div>
    );
  }
  if (asset.kind === "note") {
    return (
      <div className={`${s.face} ${s.typeFace} ${s.noteFace}`}>
        <span className={s.noteMark} aria-hidden="true">
          &ldquo;
        </span>
        <div className={s.noteText}>{asset.detail}</div>
        <div className={s.noteBy}>
          <Avatar name={asset.by} size={18} />
          {asset.by}, {asset.added.toLowerCase()}
        </div>
      </div>
    );
  }
  // doc: reads like the top of a page, title straight under the label.
  return (
    <div className={`${s.face} ${s.typeFace} ${s.docFace}`}>
      <span className={`${s.typeKind} ${s.typeKindTight}`}>
        <i style={{ background: "var(--v3-kind-doc)" }} />
        Doc{asset.source === "Google Drive" ? " · Google Drive" : ""}
      </span>
      <div className={s.docTitle}>{asset.name}</div>
      <div className={s.docBody}>
        {(asset.lines ?? []).map((l, i) => (
          <p key={i} className={s.docLine}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The picture (or considered stand-in) for any asset, at its own ratio. */
export function Face({ asset }: { asset: Asset }) {
  if (asset.kind === "image" && asset.scene) return <Art scene={asset.scene} variant={asset.variant} ratio={asset.ratio} className={s.art} />;
  if (asset.kind === "pdf") return <PdfFace asset={asset} />;
  if (asset.kind === "sheet") return <SheetFace asset={asset} />;
  return <TypeFace asset={asset} />;
}

export function VerdictPill({ verdict, by, fresh, compact }: { verdict: Verdict; by: string; fresh?: boolean; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`${s.verdict} ${verdict === "love" ? s.verdictLove : s.verdictPass}`}
      initial={fresh && !reduce ? { scale: 0.4, opacity: 0, y: -6 } : false}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
    >
      {verdict === "love" ? <I.Heart size={12} filled /> : <I.Pass size={12} />}
      {compact ? by : verdict === "love" ? `${by} loved this` : `Not for ${by}`}
    </motion.span>
  );
}

type TileProps = {
  asset: Asset;
  selected: boolean;
  selecting: boolean;
  dimmed: boolean;
  verdict?: { by: string; verdict: Verdict; fresh?: boolean };
  onToggle: (id: string, range: boolean) => void;
  onOpen: (id: string) => void;
  onDragStart: (id: string, e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onLongPress: (id: string) => void;
  onRelink: (id: string) => void;
  onRemove: (id: string) => void;
  /** Bumps each time "Show" asks this tile to announce itself. */
  pulse?: number;
};

const BURST = [
  [-26, -30],
  [-6, -40],
  [16, -34],
  [30, -18],
  [-34, -10],
  [8, -22],
];

function Burst({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`${s.burst} ${verdict === "love" ? s.burstLove : ""}`} aria-hidden="true">
      {BURST.map(([x, y], i) => (
        <motion.span
          key={i}
          className={s.burstBit}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{ x, y, scale: [0.4, 1, 0.7], opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, delay: 0.08 + i * 0.03, ease: [0.2, 0.7, 0.3, 1] }}
        >
          {verdict === "love" ? <I.Heart size={10} filled /> : <I.Pass size={9} />}
        </motion.span>
      ))}
    </span>
  );
}

export function Tile({ asset, selected, selecting, dimmed, verdict, onToggle, onOpen, onDragStart, onDragEnd, onLongPress, onRelink, onRemove, pulse }: TileProps) {
  const press = useRef<{ t: number; x: number; y: number; fired: boolean } | null>(null);
  const reduce = useReducedMotion();
  const ringColour = verdict ? (PEOPLE[verdict.by] ?? "var(--v3-accent)") : "var(--v3-accent)";

  const quiet = asset.kind !== "image";
  const typographic = quiet && asset.kind !== "pdf" && asset.kind !== "sheet";
  const cls = [s.tile, quiet ? s.tileQuiet : "", typographic ? s.tileType : "", selected ? s.tileSelected : "", dimmed ? s.tileDim : "", selecting ? s.tileSelecting : ""].join(" ");

  if (asset.broken) {
    return (
      <div className={`${s.tile} ${s.tileBroken} ${dimmed ? s.tileDim : ""}`} data-tile={asset.id}>
        <div className={s.brokenBody}>
          <span className={s.brokenIcon}>
            <I.Broken size={18} />
          </span>
          <div className={s.brokenTitle}>This image moved in Google Drive</div>
          <div className={s.brokenMeta}>
            {asset.name}, added by {asset.by}. We kept its place on the wall.
          </div>
          <div className={s.brokenActions}>
            <button type="button" className={s.btnSmall} onClick={() => onRelink(asset.id)}>
              <I.Drive size={14} /> Find it again
            </button>
            <button type="button" className={s.btnGhostSmall} onClick={() => onRemove(asset.id)}>
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const start = { t: 0, x: e.clientX, y: e.clientY, fired: false };
    start.t = window.setTimeout(() => {
      start.fired = true;
      onLongPress(asset.id);
      if (navigator.vibrate) navigator.vibrate(8);
    }, 420);
    press.current = start;
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      window.clearTimeout(p.t);
      press.current = null;
    }
  };
  const up = () => {
    const p = press.current;
    if (p) window.clearTimeout(p.t);
  };

  const activate = (e: MouseEvent) => {
    const p = press.current;
    press.current = null;
    if (p?.fired) return;
    if (selecting || e.metaKey || e.ctrlKey || e.shiftKey) onToggle(asset.id, e.shiftKey);
    else onOpen(asset.id);
  };

  return (
    <div
      className={cls}
      data-tile={asset.id}
      draggable
      onDragStart={(e) => onDragStart(asset.id, e)}
      onDragEnd={onDragEnd}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => {
        if (press.current) e.preventDefault();
      }}
    >
      <div className={s.faceWrap}>
        <Face asset={asset} />
      </div>
      {verdict?.fresh ? <span key="fresh" className={s.ring} style={{ "--ring": ringColour } as CSSProperties} aria-hidden="true" /> : null}
      {pulse ? <span key={`p${pulse}`} className={s.ring} style={{ "--ring": ringColour } as CSSProperties} aria-hidden="true" /> : null}
      <button type="button" className={s.hit} onClick={activate} aria-label={`Open ${asset.name}`} />
      <div className={s.scrim} aria-hidden="true" />

      <button
        type="button"
        className={`${s.check} ${selected ? s.checkOn : ""}`}
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${asset.name}` : `Select ${asset.name}`}
        onClick={(e) => onToggle(asset.id, e.shiftKey)}
      >
        <I.Check size={12} />
      </button>

      <div className={s.topRight}>
        {asset.version ? <span className={`${s.version} ${asset.version === "v3" ? s.versionLatest : ""}`}>{asset.version === "v3" ? "v3, latest" : asset.version}</span> : null}
      </div>

      <div className={s.info}>
        {verdict ? (
          <span className={s.verdictWrap}>
            <VerdictPill verdict={verdict.verdict} by={verdict.by} fresh={verdict.fresh} />
            {verdict.fresh && !reduce ? <Burst verdict={verdict.verdict} /> : null}
          </span>
        ) : null}
        <div className={s.infoReveal}>
          <div className={s.name}>{bare(asset.name)}</div>
          <div className={s.infoRow}>
            {asset.task ? (
              <span className={s.taskChip}>
                <I.Task size={12} />
                <span>{asset.task}</span>
              </span>
            ) : quiet ? (
              <span className={s.kindChip}>{kindLabel(asset.kind)}</span>
            ) : null}
            <span className={s.grow} />
            {asset.hearts?.length ? (
              <span className={s.hearts} title={`${asset.hearts.join(", ")} liked this`}>
                <span className={s.stack}>
                  {asset.hearts.slice(0, 3).map((h) => (
                    <Avatar key={h} name={h} size={16} ring />
                  ))}
                </span>
                <I.Heart size={12} filled />
              </span>
            ) : null}
            {asset.comments ? (
              <span className={s.comments}>
                <I.Comment size={12} />
                {asset.comments}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
