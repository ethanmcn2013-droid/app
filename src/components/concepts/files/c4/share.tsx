"use client";

import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TONES, type Asset, type Board, type Project, type ToneId, type Verdict } from "./data";
import { Face, Avatar } from "./tiles";
import * as I from "./icons";
import s from "./share.module.css";

type Props = {
  board: Board;
  project: Project;
  assets: Asset[];
  palette: ToneId[];
  verdicts: Record<string, { by: string; verdict: Verdict }>;
  onVerdict: (id: string, v: Verdict | null) => void;
  onClose: () => void;
  onSend: (opts: { note: string }) => void;
  onCopy: () => void;
};

const DEFAULT_NOTE: Record<string, string> = {
  tablescape: "Here is where we have landed for the tables. Tap the heart on anything you love and pass on anything that isn't you. There are no wrong answers.",
  florals: "Everything we've gathered for the flowers, from the arch to the buttonholes. Love what feels like you two, and pass on the rest before the florist walkthrough on Friday.",
  signage: "The welcome sign in three drafts, plus table numbers and the bar sign. Tell us which feels right.",
  barn: "How the barn could feel after dark. We'd love your reaction before the lighting plan is signed off.",
};

export function ShareModal({ board, project, assets, palette, verdicts, onVerdict, onClose, onSend, onCopy }: Props) {
  const reduce = useReducedMotion();
  const [note, setNote] = useState(DEFAULT_NOTE[board.id] ?? `A first look at ${board.name.toLowerCase()} for ${project.name}. Love what feels right, pass on the rest.`);
  const [tint, setTint] = useState<string>(project.colour);
  const [reactions, setReactions] = useState(true);
  const [docs, setDocs] = useState(true);
  const [downloads, setDownloads] = useState(false);
  const [mobileView, setMobileView] = useState<"settings" | "page">("settings");

  const shown = assets.filter((a) => !a.broken && (docs || a.kind === "image"));
  const reviewed = shown.filter((a) => verdicts[a.id]).length;
  const loved = shown.filter((a) => verdicts[a.id]?.verdict === "love").length;
  const recipients = project.client;
  const who = recipients.join(" and ");
  const title = `${board.name} for ${project.name}`;
  const slug = `${project.name}-${board.name}`.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-");
  const pageColours = [project.colour, ...palette.slice(0, 4).map((t) => TONES[t].hex)];

  return (
    <div className={s.layer} role="presentation">
      <motion.div className={s.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mw-share-title"
        className={s.dialog}
        data-view={mobileView}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        {/* ── The client-facing page ─────────────────────────── */}
        <section className={s.preview} aria-label="Page preview">
          <div className={s.browser}>
            <span className={s.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={s.url}>
              <I.Eye size={13} />
              signalstudio.ie/p/orchard/{slug}
            </span>
            <span className={s.as}>Previewing as {recipients[0]}</span>
          </div>
          <div className={s.page} style={{ "--page": tint, "--page-ink": inkOn(tint) } as CSSProperties}>
            <header className={s.pageHead}>
              <div className={s.pageBrand}>
                <span className={s.pageMark} aria-hidden="true" />
                The Orchard
              </div>
              <h2 className={s.pageTitle}>{title}</h2>
              <p className={s.pageNote}>{note}</p>
              <div className={s.pageFrom}>
                <Avatar name="Orla" size={24} />
                <span>
                  Orla Daly
                  <em>Events, The Orchard</em>
                </span>
              </div>
              {reactions ? (
                <div className={s.pageProgress}>
                  <span>
                    {reviewed} of {shown.length} reviewed{loved ? `, ${loved} loved` : ""}
                  </span>
                  <span className={s.pageBar}>
                    <motion.i animate={{ width: `${(reviewed / Math.max(shown.length, 1)) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                  </span>
                </div>
              ) : null}
            </header>
            <div className={s.pageGrid}>
              {shown.map((a) => {
                const v = verdicts[a.id]?.verdict;
                return (
                  <figure key={a.id} className={`${s.card} ${v === "pass" ? s.cardPassed : ""}`}>
                    <div className={s.cardFace} style={{ aspectRatio: `1 / ${a.ratio}` }}>
                      <Face asset={a} />
                      {v === "love" ? (
                        <motion.span className={s.cardLoved} initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                          <I.Heart size={16} filled />
                        </motion.span>
                      ) : null}
                    </div>
                    <figcaption className={s.caption}>
                      <span>{a.caption ?? a.name}</span>
                      {downloads ? (
                        <span className={s.captionDl}>
                          <I.Download size={13} /> Save
                        </span>
                      ) : null}
                    </figcaption>
                    {reactions ? (
                      <div className={s.vote} role="group" aria-label={`Your reaction to ${a.caption ?? a.name}`}>
                        <button type="button" className={`${s.voteBtn} ${v === "love" ? s.voteLove : ""}`} aria-pressed={v === "love"} onClick={() => onVerdict(a.id, v === "love" ? null : "love")}>
                          <I.Heart size={14} filled={v === "love"} /> Love it
                        </button>
                        <button type="button" className={`${s.voteBtn} ${v === "pass" ? s.votePass : ""}`} aria-pressed={v === "pass"} onClick={() => onVerdict(a.id, v === "pass" ? null : "pass")}>
                          <I.Pass size={14} /> Not for us
                        </button>
                      </div>
                    ) : null}
                  </figure>
                );
              })}
            </div>
            <footer className={s.pageFoot}>Shared privately by The Orchard with {who}. Made with Signal Studio.</footer>
          </div>
        </section>

        {/* ── Settings ───────────────────────────────────────── */}
        <aside className={s.side}>
          <div className={s.grabber} aria-hidden="true" />
          <div className={s.sideHead}>
            <div>
              <h2 id="mw-share-title" className={s.sideTitle}>
                Share {board.name} as a page
              </h2>
              <p className={s.sideSub}>A private page for {who}. They don&rsquo;t need an account.</p>
            </div>
            <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
              <I.Close size={16} />
            </button>
          </div>

          {board.shared ? (
            <div className={s.status}>
              <Avatar name={board.shared.with[0]} size={22} />
              <span>
                {board.shared.with.join(" and ")} opened this {board.shared.on === "Just now" ? "just now" : `on ${board.shared.on}`}. {reviewed} of {shown.length} reviewed.
              </span>
            </div>
          ) : null}

          <div className={s.mobileSwitch} role="tablist" aria-label="Share view">
            <button type="button" role="tab" aria-selected={mobileView === "settings"} className={mobileView === "settings" ? s.switchOn : ""} onClick={() => setMobileView("settings")}>
              Details
            </button>
            <button type="button" role="tab" aria-selected={mobileView === "page"} className={mobileView === "page" ? s.switchOn : ""} onClick={() => setMobileView("page")}>
              See the page
            </button>
          </div>

          <div className={s.field}>
            <span className={s.label}>Who it&rsquo;s for</span>
            <div className={s.people}>
              {recipients.map((r) => (
                <span key={r} className={s.person}>
                  <Avatar name={r} size={20} />
                  {r} {r === "Mara" ? "Byrne" : r === "Finn" ? "O'Neill" : ""}
                </span>
              ))}
              <button type="button" className={s.addPerson}>
                <I.Plus size={13} /> Add
              </button>
            </div>
          </div>

          <label className={s.field}>
            <span className={s.label}>Note at the top</span>
            <textarea className={s.note} value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
          </label>

          <div className={s.field}>
            <span className={s.label} id="mw-page-colour">
              Page colour
            </span>
            <div className={s.tints} role="radiogroup" aria-labelledby="mw-page-colour">
              {pageColours.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={tint === c} aria-label={i === 0 ? "Project colour" : TONES[palette[i - 1]].name} className={`${s.tint} ${tint === c ? s.tintOn : ""}`} style={{ background: c }} onClick={() => setTint(c)} />
              ))}
            </div>
          </div>

          <div className={s.toggles}>
            <Toggle label="Love it and Not for us on each picture" on={reactions} set={setReactions} />
            <Toggle label="Include quotes and documents" on={docs} set={setDocs} />
            <Toggle label="Let them save full-size files" on={downloads} set={setDownloads} />
          </div>

          <div className={s.linkRow}>
            <I.Link size={14} />
            <span className={s.linkText}>signalstudio.ie/p/orchard/{slug}</span>
            <button type="button" className={s.copy} onClick={onCopy}>
              <I.Copy size={13} /> Copy
            </button>
          </div>

          <div className={s.actions}>
            <button type="button" className={s.secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={s.primary} onClick={() => onSend({ note })}>
              <I.Share size={14} /> {board.shared ? "Send the update" : `Send to ${who}`}
            </button>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}

function inkOn(c: string) {
  if (!c.startsWith("#")) return "#ffffff";
  const n = parseInt(c.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#141414" : "#ffffff";
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={s.toggle} onClick={() => set(!on)}>
      <span>{label}</span>
      <span className={`${s.switch} ${on ? s.switchOnTrack : ""}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}
