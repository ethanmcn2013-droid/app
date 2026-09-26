"use client";

import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { DiffView } from "./diffs";
import { FILES, PEOPLE, PROJECTS, timeOf, shortWhen, whenPhrase, type FeedEvent, type PersonId, type Segment } from "./data";
import { Avatar, Icon, KindIcon, ProjectDot } from "./parts";
import s from "./c3.module.css";

export type ItemHandlers = {
  onPersonEnter: (id: PersonId, el: HTMLElement) => void;
  onPersonLeave: () => void;
  onPerson: (id: PersonId) => void;
  onPin: (file: string) => void;
  onOpen: (file: string, version?: string) => void;
  onMark: (file: string, version: string) => void;
  onFollow: (file: string) => void;
};

function Sentence({ segs, h }: { segs: Segment[]; h: ItemHandlers }) {
  return (
    <>
      {segs.map((seg, i) => {
        if (typeof seg === "string") return <span key={i}>{seg}</span>;
        if ("p" in seg) {
          const p = PEOPLE[seg.p];
          return (
            <button
              key={i}
              type="button"
              className={s.personLink}
              onMouseEnter={(e) => h.onPersonEnter(seg.p, e.currentTarget)}
              onMouseLeave={h.onPersonLeave}
              onFocus={(e) => h.onPersonEnter(seg.p, e.currentTarget)}
              onBlur={h.onPersonLeave}
              onClick={(e) => {
                e.stopPropagation();
                h.onPerson(seg.p);
              }}
            >
              {p.name}
              {(p.client || p.org) && <span className={s.srOnly}>{p.client ? ", client" : ", supplier"}</span>}
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            className={s.fileLink}
            onClick={(e) => {
              e.stopPropagation();
              h.onPin(seg.f);
            }}
            title="Show the whole history"
          >
            {seg.label ?? FILES[seg.f].name}
          </button>
        );
      })}
    </>
  );
}

export function FeedItem({
  ev,
  unread,
  hidden,
  dim,
  focused,
  final,
  freshFinal,
  following,
  thread,
  h,
  register,
}: {
  ev: FeedEvent;
  unread: boolean;
  hidden: boolean;
  dim: boolean;
  focused: boolean;
  final: string | undefined;
  freshFinal: string | null;
  following: boolean;
  thread: boolean;
  h: ItemHandlers;
  register: (id: string, el: HTMLElement | null) => void;
}) {
  const f = FILES[ev.file];
  const actor = PEOPLE[ev.actor];
  const ver = ev.version ? f.versions.find((v) => v.id === ev.version) : undefined;
  const vIndex = ver ? f.versions.indexOf(ver) : -1;
  const prev = vIndex > 0 ? f.versions[vIndex - 1] : undefined;
  const [expanded, setExpanded] = useState(false);
  const isFinal = !!ev.version && final === ev.version;
  const finalV = final ? f.versions.find((v) => v.id === final) : undefined;
  const finalIndex = finalV ? f.versions.indexOf(finalV) : -1;
  const superseded = !!ev.version && !!finalV && vIndex >= 0 && vIndex < finalIndex;
  const newerThanFinal = !!ev.version && !!finalV && vIndex > finalIndex;
  const folded = superseded && !expanded;
  const markable = !!ev.version && f.versions.length > 1 && !["rename", "link", "photos", "comments"].includes(ev.diff.type);
  const openLabel =
    f.kind === "link" ? "Open link" : f.kind === "folder" ? "Open folder" : ver && /^v\d/.test(ver.label) ? `Open ${ver.label}` : "Open this version";

  const openFromDiff = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, input, a, summary")) return;
    if (window.getSelection()?.toString()) return;
    h.onOpen(ev.file, ev.version);
  };

  return (
    <div className={`${s.itemWrap} ${hidden ? s.itemGone : ""}`} aria-hidden={hidden || undefined}>
      <div className={s.itemClip}>
        <article
          ref={(el) => register(ev.id, el)}
          data-event={ev.id}
          tabIndex={-1}
          className={`${s.item} ${dim ? s.itemDim : ""} ${focused ? s.itemFocus : ""} ${thread ? s.itemThread : ""} ${folded ? s.itemFolded : ""}`}
          aria-label={`${actor.name}: ${ev.gist}`}
        >
          <div className={s.itemGutter}>
            <Avatar id={ev.actor} size={folded ? 22 : 30} client={actor.client} />
            {unread && <span className={s.unreadDot} role="img" aria-label="New since your last visit" />}
          </div>
          {folded ? (
            <div className={s.itemBody}>
              <p className={s.foldLine}>
                <span className={s.foldWhat}>
                  {f.name} {ver?.label}
                </span>
                <span className={s.foldMeta}>
                  {actor.name}, {thread ? shortWhen(ev.at) : timeOf(ev.at)}
                </span>
                <span className={s.metaSep} aria-hidden>
                  ·
                </span>
                <span className={s.foldBy}>
                  Superseded by {finalV!.label}, {PEOPLE[finalV!.by].name}, {whenPhrase(finalV!.at)}
                </span>
                <button type="button" className={s.foldShow} onClick={() => setExpanded(true)} aria-label={`Show ${f.name} ${ver?.label}`}>
                  Show
                </button>
              </p>
            </div>
          ) : (
          <div className={s.itemBody}>
            <p className={s.headline}>
              <Sentence segs={ev.sentence} h={h} />
            </p>
            <div className={s.meta}>
              <time className={s.metaTime}>{thread ? shortWhen(ev.at) : timeOf(ev.at)}</time>
              <span className={s.metaSep} aria-hidden>
                ·
              </span>
              <span className={s.metaProject}>
                <ProjectDot id={f.project} size={7} />
                {PROJECTS[f.project].name}
              </span>
              {ver && (
                <>
                  <span className={s.metaSep} aria-hidden>
                    ·
                  </span>
                  <span className={s.metaVersion}>
                    {prev ? (
                      <>
                        {prev.label} <Icon name="arrow" size={11} className={s.arrowIcon} /> {ver.label}
                      </>
                    ) : (
                      ver.label
                    )}
                  </span>
                </>
              )}
              {isFinal && <span className={s.srOnly}>, marked final</span>}
              {newerThanFinal && (
                <>
                  <span className={s.metaSep} aria-hidden>
                    ·
                  </span>
                  <span className={s.newerTag}>Newer than the final {finalV!.label}</span>
                </>
              )}
              {superseded && (
                <>
                  <span className={s.metaSep} aria-hidden>
                    ·
                  </span>
                  <span className={s.superTag}>Superseded by {finalV!.label}</span>
                  <button type="button" className={s.foldShow} onClick={() => setExpanded(false)}>
                    Fold
                  </button>
                </>
              )}
            </div>

            <div className={s.diffWrap}>
            {isFinal && (
              <span className={`${s.bigStamp} ${freshFinal === ev.version ? s.bigStampFresh : ""}`} aria-hidden>
                <Icon name="stamp" size={18} />
                <span className={s.bigStampText}>
                  <strong>Final</strong>
                  <span>{ver?.label}</span>
                </span>
              </span>
            )}
            <div
              className={`${s.diffCard} ${superseded ? s.diffSuper : ""} ${isFinal ? s.diffFinal : ""}`}
              onClick={openFromDiff}
              title={ev.version ? `Open ${f.name} at ${ver?.label}` : undefined}
            >
              <div className={s.diffFile}>
                <KindIcon kind={f.kind} size={14} />
                <span className={s.diffFileName}>{f.name}</span>
                <span className={s.diffFileSource}>{f.source}</span>
              </div>
              <DiffView ev={ev} />
            </div>
            </div>

            <div className={s.actions}>
              {ev.version && (
                <button type="button" className={s.actBtn} onClick={() => h.onOpen(ev.file, ev.version)} aria-label={`${openLabel}: ${f.name}`}>
                  <Icon name="open" size={14} />
                  <span className={s.actLabel}>{openLabel}</span>
                </button>
              )}
              {markable &&
                (isFinal ? (
                  <span className={`${s.actBtn} ${s.actDone} ${s.actKeep}`}>
                    <Icon name="check" size={14} />
                    <span className={s.actLabel}>This is the one</span>
                  </span>
                ) : (
                  <button type="button" className={`${s.actBtn} ${s.actKeep}`} onClick={() => h.onMark(ev.file, ev.version!)}>
                    <Icon name="stamp" size={14} />
                    <span className={s.actLabel}>Mark as the one</span>
                  </button>
                ))}
              {!thread && (
                <button type="button" className={s.actBtn} onClick={() => h.onPin(ev.file)} aria-label={`Show the history of ${f.name}`}>
                  <Icon name="thread" size={14} />
                  <span className={s.actLabel}>History</span>
                </button>
              )}
              <button
                type="button"
                className={`${s.actBtn} ${following ? s.actFollowing : ""}`}
                onClick={() => h.onFollow(ev.file)}
                aria-pressed={following}
                aria-label={following ? `Following ${f.name}` : `Follow ${f.name}`}
              >
                <Icon name="star" size={13} style={{ fill: following ? "currentColor" : "none" } as CSSProperties} />
                <span className={s.actLabel}>{following ? "Following" : "Follow"}</span>
              </button>
            </div>
          </div>
          )}
        </article>
      </div>
    </div>
  );
}
