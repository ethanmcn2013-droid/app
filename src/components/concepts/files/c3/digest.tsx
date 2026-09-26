"use client";

import { useState, type ReactNode } from "react";
import { CONFLICT, FILES, PEOPLE, euro, whenPhrase } from "./data";
import { Avatar, FinalStamp, Icon, KindIcon } from "./parts";
import type { Mode } from "./rail";
import s from "./c3.module.css";

type Line = { id: string; also?: string[]; node: ReactNode };

/** Hand-edited lead lines for the digest: the news, not the log. */
const LINES: Line[] = [
  {
    id: "e-marquee-3",
    node: (
      <>
        The marquee quote dropped €350:{" "}
        <span className={s.inlineDiff}>
          <s className={s.inlineOld}>{euro(4200)}</s> {euro(3850)}
        </span>
      </>
    ),
  },
  {
    id: "e-seating-noisy",
    node: (
      <>
        Mara moved 4 guests on the seating plan.{" "}
        <span className={s.inlineDiff}>
          Aunt Clare <span className={s.inlineOld}>3</span> <Icon name="arrow" size={11} className={s.arrowIcon} /> 6
        </span>
      </>
    ),
  },
  {
    id: "e-runsheet-6",
    node: (
      <>
        Speeches now come before dinner. <span className={`${s.inlineDiff} ${s.inlineAdd}`}>+ 16:40 Speeches</span>
      </>
    ),
  },
  {
    id: "e-welcome-signed",
    node: (
      <>
        Mara signed off the welcome sign. <FinalStamp small />
      </>
    ),
  },
  {
    id: "e-vows-comments",
    node: <>Finn left 2 comments on the vows, both about the second reading.</>,
  },
  {
    id: "e-sides-link",
    also: ["e-selects"],
    node: (
      <>
        <span className={s.lineAlso}>Also new:</span> Orla’s marquee sides spec, and 14 photo selects from Niamh.
      </>
    ),
  },
];

export function Digest({
  mode,
  unseen,
  seen,
  open,
  onToggle,
  onJump,
  onMarkAll,
  onStart,
  onPin,
  refEl,
  conflict,
}: {
  mode: Mode;
  unseen: string[];
  seen: Set<string>;
  open: boolean;
  onToggle: () => void;
  onJump: (id: string) => void;
  onMarkAll: () => void;
  onStart: () => void;
  onPin: (file: string) => void;
  refEl: (el: HTMLElement | null) => void;
  conflict?: ReactNode;
}) {
  if (mode === "first") {
    return (
      <section className={`${s.digest} ${s.digestFirst}`} ref={refEl} aria-labelledby="c3-digest-title">
        <div className={s.firstArt} aria-hidden>
          <span className={s.firstChip}>
            <s className={s.inlineOld}>€4,200</s> €3,850
          </span>
          <span className={s.firstChip}>
            Aunt Clare <span className={s.inlineOld}>3</span> → 6
          </span>
          <span className={`${s.firstChip} ${s.inlineAdd}`}>+ 16:40 Speeches</span>
        </div>
        <p className={s.digestKicker}>Welcome to Files</p>
        <h2 id="c3-digest-title" className={s.digestLead}>
          Every change, in plain words, with the difference shown.
        </h2>
        <p className={s.digestText}>
          Prices, guests, lines and artwork are compared for you, so you can trust the latest version without opening it. Below is everything from the last three weeks, newest first. From your next visit, this card sums up what moved while you were away.
        </p>
        <div className={s.digestFoot}>
          <button type="button" className={s.primaryBtn} onClick={onStart}>
            Start reading
          </button>
          <span className={s.digestHint}>Tip: star the files you care about and they stay in Following.</span>
        </div>
      </section>
    );
  }

  if (mode === "quiet") {
    return (
      <section className={`${s.digest} ${s.digestQuiet}`} ref={refEl} aria-labelledby="c3-digest-title">
        <div className={s.quietIcon} aria-hidden>
          <Icon name="check" size={18} />
        </div>
        <div className={s.quietBody}>
          <h2 id="c3-digest-title" className={s.digestLeadSm}>
            Nothing new since Tuesday at 16:20
          </h2>
          <p className={s.digestText}>
            Last change: <Avatar id="dev" size={18} /> Dev renamed <strong>Bar order</strong> at 15:52 on Tuesday.
          </p>
          <div className={s.quietTodo}>
            <span className={s.quietTodoLabel}>While it’s quiet, two files have no final version yet</span>
            {["marquee", "menu"].map((id) => (
              <button key={id} type="button" className={s.quietFile} onClick={() => onPin(id)}>
                <KindIcon kind={FILES[id].kind} size={14} />
                {FILES[id].name}
                <Icon name="chevronRight" size={12} />
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const total = unseen.length;
  const left = unseen.filter((id) => !seen.has(id)).length;
  const done = left === 0;

  return (
    <section className={`${s.digest} ${done ? s.digestDone : ""}`} data-open={open} ref={refEl} aria-labelledby="c3-digest-title">
      <button type="button" className={s.digestPhoneBar} onClick={onToggle} aria-expanded={open}>
        <span className={s.digestPhoneText}>
          {done ? (
            <>
              <Icon name="check" size={14} className={s.doneCheck} /> You’re up to date
            </>
          ) : (
            <>
              <strong>Since Tuesday</strong> · {total} changes · {left} to catch up
            </>
          )}
        </span>
        <Icon name="chevron" size={16} className={open ? s.flip : ""} />
      </button>

      <div className={s.digestHead}>
        <div className={s.digestHeadText}>
          <h2 id="c3-digest-title" className={s.digestLead}>
            Since Tuesday at 16:20
          </h2>
          <p className={s.digestSum}>3 files changed, 2 new and 1 signed off, from Mara, Hireco, Dev and 3 others.</p>
        </div>
        <div className={s.digestProgress}>
          <span className={s.countdown} aria-live="polite">
            {done ? (
              <span className={s.doneKicker}>
                <svg width="16" height="16" viewBox="0 0 16 16" className={s.doneDraw} aria-hidden>
                  <circle cx="8" cy="8" r="7" />
                  <path d="M4.8 8.3l2.2 2.2 4.2-4.6" />
                </svg>
                You’re up to date
              </span>
            ) : left === total ? (
              `${left} to catch up`
            ) : (
              `${left} left to catch up`
            )}
          </span>
          <div className={s.progress} aria-hidden>
            {unseen.map((id) => (
              <span key={id} className={`${s.seg} ${seen.has(id) ? s.segOn : ""}`} />
            ))}
          </div>
          {done ? (
            <span className={s.digestHint}>Next time this starts from now</span>
          ) : (
            <button type="button" className={s.linkBtn} onClick={onMarkAll}>
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {conflict}

      <div className={s.digestBody}>
        <ul className={s.digestLines}>
          {LINES.map((l) => {
            const read = [l.id, ...(l.also ?? [])].every((id) => seen.has(id));
            return (
              <li key={l.id}>
                <button type="button" className={`${s.digestLine} ${read ? s.digestLineRead : ""}`} onClick={() => onJump(l.id)}>
                  <span className={s.lineTick} aria-hidden>
                    {read && <Icon name="check" size={10} />}
                  </span>
                  <span className={s.digestLineText}>{l.node}</span>
                  <Icon name="chevronRight" size={12} className={s.digestGo} />
                </button>
              </li>
            );
          })}
        </ul>
        {!done && (
          <button type="button" className={`${s.linkBtn} ${s.digestPhoneMark}`} onClick={onMarkAll}>
            Mark all as read
          </button>
        )}
      </div>
    </section>
  );
}

/** The one thing that needs a decision, folded into the digest above the news. */
export function ConflictRow({ final, onKeep, onUndo }: { final: string | undefined; onKeep: (version: string) => void; onUndo: () => void }) {
  const [compare, setCompare] = useState(false);
  const f = FILES[CONFLICT.file];
  if (final) {
    const v = f.versions.find((x) => x.id === final)!;
    const text =
      final === "seating-3"
        ? `Kept v3 from Drive (${PEOPLE[v.by].name}, ${whenPhrase(v.at)}). The upload is superseded on Send place cards to print.`
        : final === "seating-2"
          ? "Kept the upload, a copy of v2. Drive’s v3 stays in the history as a newer draft."
          : `Kept ${v.label}. Drive and the upload are both superseded on Send place cards to print.`;
    return (
      <div className={s.conflictDone} role="status">
        <Icon name="check" size={14} />
        <span>{text}</span>
        <button type="button" className={s.linkBtn} onClick={onUndo}>
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className={s.conflict} role="group" aria-labelledby="c3-conflict-title">
      <div className={s.conflictHead}>
        <span className={s.conflictIcon} aria-hidden>
          <Icon name="warn" size={14} />
        </span>
        <div className={s.conflictText}>
          <p id="c3-conflict-title" className={s.conflictTitle}>
            Two copies of the seating plan disagree on 4 guests
          </p>
          <p className={s.conflictSub}>
            Place cards print from the one you keep.{" "}
            <button type="button" className={s.linkBtn} onClick={() => setCompare((v) => !v)} aria-expanded={compare}>
              {compare ? "Hide" : "Compare"}
              <Icon name="chevron" size={12} className={compare ? s.flip : ""} />
            </button>
          </p>
        </div>
        <div className={s.conflictBtns}>
          <button type="button" className={s.keepBtn} onClick={() => onKeep("seating-3")} aria-label={`Keep Drive: v3, ${PEOPLE[CONFLICT.a.by].name}, ${CONFLICT.a.when}`}>
            Keep Drive
          </button>
          <button type="button" className={s.keepBtn} onClick={() => onKeep("seating-2")} aria-label={`Keep upload: ${PEOPLE[CONFLICT.b.by].name}, ${CONFLICT.b.when}`}>
            Keep upload
          </button>
        </div>
      </div>
      <div className={`${s.collapse} ${compare ? "" : s.collapsed}`}>
        <div className={s.collapseInner}>
          <table className={s.compare}>
            <thead>
              <tr>
                <th scope="col">
                  <span className={s.srOnly}>Guest</span>
                </th>
                <th scope="col">
                  <span className={s.compareSide}>Drive, v3</span>
                  <span className={s.compareWho}>
                    {PEOPLE[CONFLICT.a.by].name}, {CONFLICT.a.when}
                  </span>
                </th>
                <th scope="col">
                  <span className={s.compareSide}>Upload, copy of v2</span>
                  <span className={s.compareWho}>
                    {PEOPLE[CONFLICT.b.by].name}, {CONFLICT.b.when}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {CONFLICT.differences.map((d) => (
                <tr key={d.guest}>
                  <th scope="row">{d.guest}</th>
                  <td>{d.drive}</td>
                  <td className={d.upload === "Not listed" ? s.compareMissing : ""}>{d.upload}</td>
                </tr>
              ))}
              <tr className={s.compareTotal}>
                <th scope="row">Guests</th>
                <td>{CONFLICT.a.guests}</td>
                <td>{CONFLICT.b.guests}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
