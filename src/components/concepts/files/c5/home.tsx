"use client";

import type { CSSProperties, ReactNode } from "react";
import { SUGGESTIONS, TRY, type FileItem } from "./data";
import { Glyph, Icon, Kbd, PageThumb, ProjectTag, useMod } from "./parts";
import s from "./ask.module.css";

const SUGGESTION_ICON = {
  due: "clock",
  images: "image",
  notask: "task",
} as const;

/** Home: three ways to narrow, written as the tokens they are. */
export function Suggestions({
  counts,
  onPick,
}: {
  counts: Record<string, number>;
  onPick: (token: string) => void;
}) {
  return (
    <div
      className={`${s.narrow} ${s.narrowHome}`}
      role="group"
      aria-label="Suggested searches"
    >
      <span className={s.narrowLabel}>Try</span>
      {SUGGESTIONS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          className={s.narrowTok}
          onClick={() => onPick(c.token)}
          style={{ "--i": i } as CSSProperties}
          aria-label={`${c.label}, ${counts[c.id] ?? 0} files`}
        >
          <Icon name={SUGGESTION_ICON[c.id]} size={13} />
          <code className={s.narrowCode}>{c.token}</code>
          <span className={s.narrowCount}>{counts[c.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

export type PinRow = {
  id: string;
  name: string;
  count: number;
  fresh: number;
  on: boolean;
};

export function Home({
  feature,
  featureQuestion,
  pins,
  bumped,
  onPin,
  recent,
  onOpen,
  onRun,
}: {
  feature: ReactNode;
  featureQuestion: string;
  pins: PinRow[];
  bumped: string | null;
  onPin: (id: string) => void;
  recent: FileItem[];
  onOpen: (id: string) => void;
  onRun: (q: string) => void;
}) {
  const mod = useMod();
  return (
    <div className={s.home}>
      <div className={s.homeLead}>
        <section className={`${s.homeBlock} ${s.homeFeature}`} aria-labelledby="c5-ask">
          <div className={s.blockHead}>
            <h2 id="c5-ask" className={s.blockTitle}>
              Ask it things
            </h2>
            <span className={s.blockNote}>
              The answer comes quoted from inside the file
            </span>
          </div>
          {feature}
          <ul className={s.tryList} aria-label="More questions to try">
            {TRY.filter((t) => t !== featureQuestion).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  className={s.tryRow}
                  onClick={() => onRun(t)}
                >
                  <Icon name="search" size={14} />
                  <span className={s.tryText}>{t}</span>
                  <Icon name="enter" size={14} className={s.tryEnter} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className={s.homeSide}>
          <section className={s.homeBlock} aria-labelledby="c5-pins">
            <div className={s.blockHead}>
              <h2 id="c5-pins" className={s.blockTitle}>
                Pinned searches
              </h2>
            </div>
            <ul className={s.pinList}>
              {pins.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`${s.pinRow} ${bumped === p.id ? s.pinBump : ""}`}
                    onClick={() => onPin(p.id)}
                    aria-label={`${p.name}, ${p.count} files${p.fresh ? `, ${p.fresh} new` : ""}`}
                  >
                    <Icon name="pin" size={14} className={s.pinIcon} />
                    <span className={s.pinName}>{p.name}</span>
                    {p.fresh ? (
                      <span className={s.pinFresh}>
                        <span className={s.pinFreshDot} aria-hidden="true" />+{p.fresh}
                      </span>
                    ) : null}
                    <span key={p.count} className={s.pinCount}>
                      {p.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={s.pinHint}>
              Search for anything, then pin it{" "}
              <span className={s.hoverOnly}>
                <Kbd>{mod === "⌘" ? "⌘S" : "Ctrl S"}</Kbd>
              </span>
              . Pins keep counting as new files arrive.
            </p>
          </section>

          <section
            className={`${s.homeBlock} ${s.hoverOnly}`}
            aria-labelledby="c5-keys"
          >
            <div className={s.blockHead}>
              <h2 id="c5-keys" className={s.blockTitle}>
                Keys
              </h2>
            </div>
            <dl className={s.keyList}>
              <div className={s.keyRow}>
                <dt>
                  <Kbd>/</Kbd>
                </dt>
                <dd>Search from anywhere</dd>
              </div>
              <div className={s.keyRow}>
                <dt>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </dt>
                <dd>Move through results</dd>
              </div>
              <div className={s.keyRow}>
                <dt>
                  <Kbd>Tab</Kbd>
                </dt>
                <dd>Narrow with a token</dd>
              </div>
              <div className={s.keyRow}>
                <dt>
                  <Kbd>{mod === "⌘" ? "⌘↵" : "Ctrl ↵"}</Kbd>
                </dt>
                <dd>Copy a link</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className={s.homeBlock} aria-labelledby="c5-recent">
        <div className={s.blockHead}>
          <h2 id="c5-recent" className={s.blockTitle}>
            Jump back in
          </h2>
          <span className={s.blockNote}>Files you opened this week</span>
        </div>
        <ul className={s.recent}>
          {recent.map((f, i) => (
            <li
              key={f.id}
              style={{ "--i": i } as CSSProperties}
              className={s.recentItem}
            >
              <button
                type="button"
                className={s.recentCard}
                onClick={() => onOpen(f.id)}
              >
                <span className={s.recentPreview}>
                  <PageThumb file={f} para={-1} className={s.recentThumb} />
                </span>
                <span className={s.recentInfo}>
                  <span className={s.recentName}>
                    <Glyph file={f} size={18} />
                    <span className={s.recentNameText}>{f.name}</span>
                  </span>
                  <span className={s.recentMeta}>
                    <span className={s.recentProject}>
                      <ProjectTag id={f.project} compact />
                    </span>
                    <span className={s.recentWhen}>{f.opened}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
