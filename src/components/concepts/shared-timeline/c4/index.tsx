"use client";

/* Every Day Poster. The shared timeline as a single living poster: one
   dot for every day of the project, filled up to today, set on a strict
   grid and ready to post. The page is the poster and the poster is the
   share. Concept only: invented sample data, no back end. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { compose } from "./compose";
import {
  buildModel,
  FORMATS,
  fmtDM,
  fmtDMY,
  fmtWDM,
  MOMENTS,
  WORLDS,
  type Format,
  type Model,
  type Moment,
  type WorldId,
} from "./data";
import { makeMeasure, paint, readFaces, readPalette, type Faces } from "./paint";
import { PosterArt } from "./poster";
import s from "./c4.module.css";

const PHONE_QUERY = "(max-width: 759px)";
const ASIDE_W = 300;
/* The concept toolbar under the poster, and its gap. */
const BAR_H = 58;

function subscribeQuery(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const noop = () => () => {};

export default function EveryDayPoster() {
  const [worldId, setWorldId] = useState<WorldId>("wedding");
  const [moment, setMoment] = useState<Moment>("live");
  const [picked, setPicked] = useState<Format | null>(null);
  const [faces, setFaces] = useState<Faces | null>(null);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const isPhone = useSyncExternalStore(subscribeQuery, () => window.matchMedia(PHONE_QUERY).matches, () => false);
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
  const format: Format = picked ?? (isPhone ? "story" : "poster");
  const spec = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const model = useMemo(() => buildModel(worldId, moment), [worldId, moment]);

  /* A shared page stands alone: whatever sits behind it (the app, in
     this concept gallery) is hidden from pointer, keyboard and screen
     reader while the poster is open. */
  useEffect(() => {
    const host = rootRef.current;
    if (!mounted || !host) return;
    const others = Array.from(document.body.children).filter((el) => el !== host && !el.hasAttribute("inert"));
    others.forEach((el) => el.setAttribute("inert", ""));
    return () => others.forEach((el) => el.removeAttribute("inert"));
  }, [mounted]);

  /* Fonts first, so the measured type is the type on screen. */
  useEffect(() => {
    let alive = true;
    if (!mounted) return;
    document.fonts.ready.then(() => {
      if (alive && rootRef.current) setFaces(readFaces(rootRef.current));
    });
    return () => {
      alive = false;
    };
  }, [mounted]);

  useEffect(() => {
    const el = rootRef.current;
    if (!mounted || !el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  const frame = useMemo(() => {
    if (!stage) return null;
    const ar = spec.w / spec.h;
    if (isPhone) {
      const w = stage.w;
      return { w, h: Math.round(w / ar) };
    }
    const gap = Math.max(40, Math.min(72, stage.w * 0.045));
    const padX = Math.max(32, Math.min(56, stage.w * 0.035));
    const padY = Math.max(28, Math.min(40, stage.h * 0.045));
    const w = Math.min(stage.w - padX * 2 - gap - ASIDE_W, (stage.h - padY * 2 - BAR_H) * ar);
    return { w: Math.round(w), h: Math.round(w / ar), gap };
  }, [stage, spec, isPhone]);

  const scene = useMemo(() => {
    if (!faces || !frame) return null;
    return compose(model, format, frame.w, frame.h, makeMeasure(faces));
  }, [faces, frame, model, format]);

  const say = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus((cur) => (cur === text ? "" : cur)), 2400);
  };

  const render = async () => {
    const root = rootRef.current;
    if (!root) return null;
    const f = readFaces(root);
    const colours = readPalette(root);
    const big = compose(model, format, spec.w, spec.h, makeMeasure(f));
    const canvas = document.createElement("canvas");
    paint(canvas, big, colours, f);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const fileName = `${model.world.slug}-${spec.label.toLowerCase()}.png`;

  const download = async () => {
    setBusy(true);
    const blob = await render();
    setBusy(false);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    say(`Saved ${fileName}`);
  };

  const shareImage = async () => {
    const blob = await render();
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: model.world.plainTitle, url: model.shareUrl });
      } else {
        await navigator.share({ title: model.world.plainTitle, url: model.shareUrl });
      }
    } catch {
      /* The person closed the share sheet. Nothing to say. */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.shareUrl);
      say("Link copied");
    } catch {
      say("Copy the link from the address bar");
    }
  };

  const choose = (w: WorldId, m: Moment) => {
    setWorldId(w);
    setMoment(m);
  };

  const shareTools = (
    <ShareTools
      model={model}
      spec={spec}
      busy={busy}
      status={status}
      canShare={canShare && isPhone}
      onDownload={download}
      onCopy={copy}
      onShare={shareImage}
    />
  );
  const formatPicker = <FormatPicker format={format} onPick={setPicked} />;
  const preview = (bar: boolean) => <Preview bar={bar} worldId={worldId} moment={moment} onChoose={choose} />;

  if (!mounted) return null;

  return createPortal(
    <div ref={rootRef} className={s.root} data-world={worldId}>
      <h1 className={s.srOnly}>{model.world.plainTitle}</h1>
      <p className={s.srOnly}>
        {model.world.kicker}. {model.dateLine}, {model.world.place}. {model.big} {model.small}.
      </p>

      <div className={s.layout} style={frame && !isPhone ? { gap: frame.gap } : undefined}>
        <main className={s.stage}>
          {frame ? (
            <div className={s.frame} style={{ width: frame.w, height: frame.h }}>
              {scene ? (
                <div key={`${worldId}-${moment}`} className={s.fresh}>
                  <PosterArt scene={scene} model={model} />
                </div>
              ) : null}
            </div>
          ) : null}

          <section className={`${s.phoneOnly} ${s.below}`} aria-labelledby="pz-below">
            <h2 id="pz-below" className={s.belowTitle}>
              Every milestone
            </h2>
            <p className={s.hint}>{model.spanLabel}. Tap any dot on the poster to see that day.</p>
            <Milestones model={model} />
            <p className={s.belowFoot}>
              <MarkGlyph /> Made with Signal Studio
            </p>
          </section>
        </main>

        <aside
          className={s.aside}
          aria-label="Share and milestones"
          style={frame && !isPhone ? { height: Math.max(frame.h, 560), width: ASIDE_W } : undefined}
        >
          <div className={s.from}>
            <p className={s.fromName}>From {model.world.from}</p>
            <p className={s.fromLine}>
              Every dot is one day. Point at any of them to see what it held, or use the arrow keys.
            </p>
          </div>
          {shareTools}
          {formatPicker}
          <section className={s.section} aria-labelledby="pz-ms">
            <h2 id="pz-ms" className={s.h2}>
              Milestones
            </h2>
            <Milestones model={model} />
          </section>
        </aside>
      </div>
      {frame && !isPhone ? <div className={s.barWrap}>{preview(true)}</div> : null}

      <button type="button" className={s.handle} onClick={() => setSheet(true)} aria-expanded={sheet} aria-controls="pz-sheet">
        <span className={s.grab} aria-hidden="true" />
        Share or save
      </button>

      <AnimatePresence>
        {sheet && isPhone ? (
          <>
            <motion.div
              key="scrim"
              className={s.scrim}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setSheet(false)}
            />
            <motion.div
              key="sheet"
              id="pz-sheet"
              className={s.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pz-sheet-title"
              initial={{ y: reduce ? 0 : "100%" }}
              animate={{ y: 0 }}
              exit={{ y: reduce ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              drag={reduce ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90) setSheet(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSheet(false);
              }}
            >
              <span className={s.sheetGrab} aria-hidden="true" />
              <div className={s.sheetHead}>
                <h2 id="pz-sheet-title" className={s.sheetTitle}>
                  Share or save
                </h2>
                <button type="button" className={s.close} onClick={() => setSheet(false)} autoFocus>
                  Done
                </button>
              </div>
              {shareTools}
              {formatPicker}
              {preview(false)}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ── Share ─────────────────────────────────────────────────────────── */

function ShareTools(props: {
  model: Model;
  spec: (typeof FORMATS)[number];
  busy: boolean;
  status: string;
  canShare: boolean;
  onDownload: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  const { model, spec, busy, status, canShare } = props;
  const shortUrl = model.shareUrl.replace(/^https?:\/\//, "");
  const copied = status === "Link copied";
  const saved = status.startsWith("Saved");
  return (
    <section className={s.section} aria-labelledby="pz-share">
      <h2 id="pz-share" className={s.h2}>
        Share this
      </h2>
      <div className={s.buttons}>
        {canShare ? (
          <button type="button" className={s.primary} onClick={props.onShare}>
            <ShareIcon />
            <span className={s.btnText}>
              Share image
              <span className={s.btnMeta}>
                {spec.label} · {spec.w} × {spec.h}
              </span>
            </span>
          </button>
        ) : null}
        <button type="button" className={canShare ? s.secondary : s.primary} onClick={props.onDownload} disabled={busy}>
          <DownloadIcon />
          <span className={s.btnText}>
            {saved ? "Saved to your downloads" : busy ? "Making your image" : "Download image"}
            <span className={s.btnMeta}>
              {spec.label} {spec.ratio} · PNG, {spec.w} × {spec.h}
            </span>
          </span>
        </button>
        <button type="button" className={s.secondary} onClick={props.onCopy}>
          <LinkIcon done={copied} />
          <span className={s.btnText}>
            {copied ? "Link copied" : "Copy link"}
            <span className={s.btnMeta}>{shortUrl}</span>
          </span>
        </button>
      </div>
      <span className={s.live} role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}

function FormatPicker({ format, onPick }: { format: Format; onPick: (f: Format) => void }) {
  const glyph: Record<Format, [number, number]> = { poster: [16, 20], story: [12, 21], square: [18, 18], wide: [25, 14] };
  return (
    <section className={s.section} aria-labelledby="pz-size">
      <h2 id="pz-size" className={s.h2}>
        Size
      </h2>
      <div className={s.segs} role="group" aria-labelledby="pz-size">
        {FORMATS.map((f) => (
          <button key={f.id} type="button" className={s.seg} aria-pressed={f.id === format} onClick={() => onPick(f.id)}>
            <span className={s.glyphBox} aria-hidden="true">
              <span className={s.glyph} style={{ width: glyph[f.id][0], height: glyph[f.id][1] }} />
            </span>
            <span>{f.label}</span>
            <span className={s.segRatio}>{f.ratio}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Milestones in plain text ──────────────────────────────────────── */

function Milestones({ model }: { model: Model }) {
  const todayAt = model.milestones.findIndex((m) => m.n >= model.today);
  const todayRow = (
    <li className={s.todayRow} key="today">
      <span className={s.todayDot} aria-hidden="true" />
      <span>
        Today · {fmtWDM(model.today)} · day {model.dayNumber.toLocaleString("en-IE")}
      </span>
    </li>
  );
  const rows = model.milestones.map((m) => (
    <li key={m.num} className={s.item} data-state={m.state}>
      <span className={s.marker} aria-hidden="true" />
      <span className={s.itemDate}>{model.long || m.isEnd ? fmtDMY(m.n).replace(/ 20(\d\d)$/, " ’$1") : fmtDM(m.n)}</span>
      <span className={s.itemLabel}>
        {m.label}
        <span className={s.srOnly}>{m.state === "done" ? ", done" : m.state === "next" ? ", next" : ""}</span>
      </span>
    </li>
  ));
  if (model.moment !== "after") rows.splice(todayAt === -1 ? rows.length : todayAt, 0, todayRow);
  return <ol className={s.list}>{rows}</ol>;
}

/* ── Concept preview controls ──────────────────────────────────────── */

function Preview({
  bar,
  worldId,
  moment,
  onChoose,
}: {
  bar: boolean;
  worldId: WorldId;
  moment: Moment;
  onChoose: (w: WorldId, m: Moment) => void;
}) {
  const id = bar ? "pz-preview-bar" : "pz-preview";
  return (
    <section className={bar ? s.bar : `${s.section} ${s.preview}`} aria-labelledby={id}>
      <h2 id={id} className={bar ? s.barTitle : s.h2}>
        {bar ? "Concept preview" : "Try another example"}
      </h2>
      <div className={s.chips} role="group" aria-label="Example project">
        {WORLDS.map((w) => (
          <button key={w.id} type="button" className={s.chip} aria-pressed={w.id === worldId} onClick={() => onChoose(w.id, moment)}>
            {w.label}
          </button>
        ))}
      </div>
      {bar ? <span className={s.barRule} aria-hidden="true" /> : null}
      <div className={s.chips} role="group" aria-label="Moment in the project">
        {MOMENTS.map((m) => (
          <button key={m.id} type="button" className={s.chip} aria-pressed={m.id === moment} onClick={() => onChoose(worldId, m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {bar ? null : <p className={s.previewNote}>Concept preview only. Visitors never see this.</p>}
    </section>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────── */

function DownloadIcon() {
  return (
    <svg className={s.btnIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className={s.btnIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 10V2.5M5 5.5 8 2.5l3 3M4 8H3v5.5h10V8h-1" />
    </svg>
  );
}

function LinkIcon({ done }: { done: boolean }) {
  return (
    <svg className={s.btnIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {done ? (
        <path d="m3.5 8.5 3 3 6-7" />
      ) : (
        <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" />
      )}
    </svg>
  );
}

function MarkGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="7" r="2" fill="currentColor" />
    </svg>
  );
}
