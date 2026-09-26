"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useDialogFocus } from "./focus";
import QRCode from "qrcode";
import * as I from "./icons";
import { cx, plural, short, TODAY_DAY, totalSize, type KitView, type PackMode, type PackResult } from "./model";
import { Preview } from "./Preview";
import p from "./pack.module.css";

const MODES: { id: PackMode; title: string; icon: typeof I.LinkIcon; desc: (k: KitView, size: string) => string }[] = [
  { id: "link", title: "Share a link", icon: I.LinkIcon, desc: () => "Anyone with the link can view and download. It closes on its own." },
  { id: "offline", title: "Save for offline", icon: I.Download, desc: (_k, size) => `One download, ${size}. For the barn, where the signal drops.` },
  { id: "print", title: "Print bundle", icon: I.Printer, desc: (k) => `A run-sheet cover, then every file in order. A4, about ${k.files.length * 3 + 2} pages.` },
];

function Qr({ text }: { text: string }) {
  const cells = useMemo(() => {
    const q = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = q.modules.size;
    const out: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(x, y)) out.push([x, y]);
    return { n, out };
  }, [text]);
  return (
    <svg className={p.qr} viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="QR code for the kit link">
      <rect x={-2} y={-2} width={cells.n + 4} height={cells.n + 4} className={p.qrBg} />
      {cells.out.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} className={p.qrCell} />
      ))}
    </svg>
  );
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
}

export function PackDialog({
  kit,
  tone,
  reduced,
  existing,
  onClose,
  onPacked,
}: {
  kit: KitView;
  tone: number;
  reduced: boolean;
  existing?: PackResult;
  onClose: () => void;
  onPacked: (r: PackResult) => void;
}) {
  const present = kit.files.filter((f) => f.state !== "missing");
  const missing = kit.files.filter((f) => f.state === "missing");
  const [mode, setMode] = useState<PackMode>(existing?.mode ?? "link");
  const [expiry, setExpiry] = useState<"after" | "7" | "30">("after");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(present.map((f) => f.id)));
  const [phase, setPhase] = useState<"choose" | "packing" | "done">(existing ? "done" : "choose");
  const [result, setResult] = useState<PackResult | null>(existing ?? null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, { initial: existing ? "[data-autofocus]" : '[role="radio"][aria-checked="true"]', trap: true });
  // The Pack button leaves the page once packing ends; hand focus to the result.
  useEffect(() => {
    if (phase !== "done") return;
    const el = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>("[data-done]");
    el?.focus({ preventScroll: true });
  }, [phase]);

  const chosen = present.filter((f) => picked.has(f.id));
  const size = totalSize(chosen);
  const expiresOn = expiry === "after" ? short(kit.day + 1) : short(TODAY_DAY + (expiry === "7" ? 7 : 30));

  const pack = () => {
    const r: PackResult = {
      mode,
      count: chosen.length,
      url: `signal.studio/k/${slug(kit.title)}-7q`,
      expires: mode === "link" ? expiresOn : undefined,
      size,
    };
    setPhase("packing");
    timer.current = window.setTimeout(
      () => {
        setPhase("done");
        setResult(r);
        onPacked(r);
      },
      reduced ? 50 : 1250,
    );
  };

  const stackCards = (phase === "choose" ? chosen : present.filter((f) => (result ? true : picked.has(f.id)))).slice(0, 5);
  const n = stackCards.length;
  const closed = phase !== "choose";

  return (
    <div className={p.scrim} onPointerDown={(e) => e.target === e.currentTarget && phase !== "packing" && onClose()}>
      <motion.div
        ref={box}
        className={p.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-title"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ ["--pj" as string]: `var(--v3-project-${tone})` }}
      >
        {/* The stage: cards drop into the kit folder */}
        <div className={p.stage} aria-hidden="true">
          <div className={p.folder}>
            <div className={p.folderBack}>
              <span className={p.folderTab} />
            </div>
            {stackCards.map((f, i) => {
              const o = i - (n - 1) / 2;
              return (
                <motion.span
                  key={f.id}
                  className={p.card}
                  initial={false}
                  animate={
                    closed
                      ? { x: o * 3, y: 44 - i * 2, rotate: o * 1.5, scale: 0.9 }
                      : { x: o * 30, y: 0, rotate: o * 7, scale: 1 }
                  }
                  transition={
                    reduced
                      ? { duration: 0 }
                      : closed
                        ? { type: "spring", stiffness: 260, damping: 22, delay: 0.08 * i }
                        : { type: "spring", stiffness: 300, damping: 24 }
                  }
                  style={{ zIndex: 10 + i }}
                >
                  <Preview spec={f.preview} kind={f.kind} />
                </motion.span>
              );
            })}
            <motion.div
              className={p.folderFront}
              initial={false}
              animate={closed ? { rotateX: 0, y: 0 } : { rotateX: 18, y: 6 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22, delay: closed ? 0.45 : 0 }}
            >
              <span className={p.folderLabel}>{kit.title}</span>
              <span className={p.folderCount}>{plural(phase === "choose" ? chosen.length : (result?.count ?? chosen.length), "file")}</span>
              {phase === "done" && (
                <motion.span
                  className={p.folderCheck}
                  initial={reduced ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                >
                  <I.Check size={14} strokeWidth={2.6} />
                </motion.span>
              )}
            </motion.div>
          </div>
          <p className={p.stageCaption}>
            {phase === "choose" ? `${short(kit.day)}${kit.time ? `, ${kit.time}` : ""}` : phase === "packing" ? "Packing…" : "Packed and ready"}
          </p>
        </div>

        <div className={p.side}>
          <div className={p.head}>
            <div>
              <h2 id="pack-title" className={p.title}>
                {phase === "done" ? `Kit for ${kit.kitName} is ready` : `Pack the kit for ${kit.kitName}`}
              </h2>
              <p className={p.sub}>
                {phase === "done" && result
                  ? `${plural(result.count, "file")}, ${result.size}${missing.length ? `. ${plural(missing.length, "missing file")} will join when ${missing.length === 1 ? "it lands" : "they land"}.` : "."}`
                  : `${plural(chosen.length, "file")} ready to go${missing.length ? `, ${missing.length} still missing` : ""}`}
              </p>
            </div>
            <button type="button" className={p.iconBtn} onClick={onClose} aria-label="Close" disabled={phase === "packing"}>
              <I.Close size={14} />
            </button>
          </div>

          {phase !== "done" || !result ? (
            <>
              <div className={p.modes} role="radiogroup" aria-label="How to pack it">
                {MODES.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={mode === m.id}
                      className={cx(p.mode, mode === m.id && p.modeOn)}
                      onClick={() => setMode(m.id)}
                      disabled={phase === "packing"}
                    >
                      <span className={p.modeIcon}>
                        <Icon size={16} />
                      </span>
                      <span className={p.modeText}>
                        <b>{m.title}</b>
                        <span>{m.desc(kit, size)}</span>
                      </span>
                      <span className={p.radio} />
                    </button>
                  );
                })}
              </div>

              {mode === "link" && (
                <div className={p.expiry}>
                  <span className={p.label}>Link closes</span>
                  <div className={p.seg}>
                    {(
                      [
                        ["after", `After ${kit.kitName}`],
                        ["7", "In 7 days"],
                        ["30", "In 30 days"],
                      ] as const
                    ).map(([id, label]) => (
                      <button key={id} type="button" className={cx(p.segBtn, expiry === id && p.segOn)} aria-pressed={expiry === id} onClick={() => setExpiry(id)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className={p.contents}>
                <span className={p.label}>In the kit</span>
                <ul className={p.contentList}>
                  {present.map((f) => (
                    <li key={f.id}>
                      <label className={p.contentRow}>
                        <input
                          type="checkbox"
                          checked={picked.has(f.id)}
                          disabled={phase === "packing"}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(f.id);
                            else next.delete(f.id);
                            setPicked(next);
                          }}
                        />
                        <span className={p.contentThumb}>
                          <Preview spec={f.preview} kind={f.kind} />
                        </span>
                        <span className={p.contentName}>{f.name}</span>
                        <span className={p.contentState} data-state={f.state}>
                          {f.state === "ready" ? "Ready" : f.state === "draft" ? "Draft" : "Waiting"}
                        </span>
                      </label>
                    </li>
                  ))}
                  {missing.map((f) => (
                    <li key={f.id} className={p.contentMissing}>
                      <span className={p.contentGhost}>
                        <I.Plus size={10} />
                      </span>
                      <span className={p.contentName}>{f.name}</span>
                      <span className={p.contentLater}>Joins when it lands</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={p.foot}>
                <button type="button" className={p.btnQuiet} onClick={onClose} disabled={phase === "packing"}>
                  Cancel
                </button>
                <button type="button" className={p.btnPrimary} onClick={pack} disabled={phase === "packing" || chosen.length === 0}>
                  <I.Pack size={15} /> {phase === "packing" ? "Packing" : `Pack ${plural(chosen.length, "file")}`}
                </button>
              </div>
            </>
          ) : (
            <motion.div
              className={p.result}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              {result.mode === "link" && (
                <>
                  <div className={p.linkRow}>
                    <I.LinkIcon size={15} />
                    <input readOnly value={`https://${result.url}`} aria-label="Kit link" onFocus={(e) => e.target.select()} />
                    <button
                      type="button"
                      data-autofocus=""
                      className={p.btnPrimary}
                      onClick={() => {
                        navigator.clipboard?.writeText(`https://${result.url}`).catch(() => {});
                        setCopied(true);
                      }}
                    >
                      {copied ? <I.Check size={14} /> : <I.Copy size={14} />} {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                  <div className={p.qrRow}>
                    <Qr text={`https://${result.url}`} />
                    <div className={p.qrText}>
                      <b>Scan on the day</b>
                      <span>Print this on the run-sheet so anyone on the floor can open the kit from their phone.</span>
                      <span className={p.expires}>
                        <I.Clock size={13} /> Closes {result.expires}. You can close it sooner.
                      </span>
                    </div>
                  </div>
                </>
              )}
              {result.mode === "offline" && (
                <div className={p.fileOut}>
                  <span className={p.zip}>ZIP</span>
                  <span className={p.fileOutText}>
                    <b>kit-{slug(kit.title)}.zip</b>
                    <span>
                      {plural(result.count, "file")}, {result.size}. Opens without a connection.
                    </span>
                  </span>
                  <button type="button" className={p.btnPrimary}>
                    <I.Download size={14} /> Save
                  </button>
                </div>
              )}
              {result.mode === "print" && (
                <div className={p.fileOut}>
                  <span className={p.zip}>A4</span>
                  <span className={p.fileOutText}>
                    <b>{kit.title}, print bundle</b>
                    <span>Run-sheet cover first, then {plural(result.count, "file")} in the order you need them.</span>
                  </span>
                  <button type="button" className={p.btnPrimary}>
                    <I.Printer size={14} /> Print
                  </button>
                </div>
              )}
              <div className={p.foot}>
                <button
                  type="button"
                  className={p.btnQuiet}
                  onClick={() => {
                    setPhase("choose");
                    setResult(null);
                    setCopied(false);
                  }}
                >
                  Repack
                </button>
                <button type="button" className={p.btn} onClick={onClose} data-done="">
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
