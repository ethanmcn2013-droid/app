"use client";

import { motion } from "motion/react";
import { useState } from "react";
import s from "./ledger.module.css";
import {
  KIND_LABEL,
  PEOPLE,
  daysFromToday,
  fmtAgo,
  fmtDate,
  fmtRelative,
  isPastDue,
  nextMilestone,
  statusLooksStale,
  sum,
  type Project,
} from "./data";
import { Avatar, AvatarStack, Icon, Kbd, MilestoneWhen, OpenTrend, Progress, StatusPill, Swatch } from "./parts";
import { ActivityList, LinkList, MilestoneList, StatusHistory, TaskList } from "./sections";
import type { EditKind } from "./table";

type Tab = "overview" | "milestones" | "updates";

export function Hub({
  project: p,
  onBack,
  onEdit,
  onToggleMilestone,
  onPost,
}: {
  project: Project;
  onBack: () => void;
  onEdit: (kind: EditKind, el: Element) => void;
  onToggleMilestone: (msId: string) => void;
  onPost: (text: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState("");
  const n = daysFromToday(p.date);
  const m = nextMilestone(p);
  const msDone = p.milestones.filter((x) => x.done).length;
  const statusUpdates = p.activity.filter((a) => a.kind === "status" || a.kind === "note");
  const lastPost = statusUpdates[0];
  const lastChange = p.history[p.history.length - 1];
  const latest = lastPost
    ? { who: lastPost.who, when: fmtAgo(lastPost.minsAgo), text: lastPost.text }
    : { who: lastChange?.by ?? p.owner, when: fmtDate(lastChange?.date ?? p.start), text: p.statusReason };

  return (
    <motion.div
      className={s.hub}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <nav className={s.crumbs} aria-label="Breadcrumb">
        <button type="button" className={s.crumbBack} onClick={onBack}>
          <Icon.back size={14} /> Projects
        </button>
        <span aria-hidden="true">/</span>
        <span className={s.crumbHere}>{p.name}</span>
        <span className={s.crumbHint}>
          <Kbd>esc</Kbd> back to the ledger
        </span>
      </nav>

      <article className={s.doc}>
        <Swatch tone={p.tone} name={p.name} size={44} />
        <h1 className={s.docTitle}>{p.name}</h1>
        <p className={s.docPurpose}>{p.purpose}</p>

        <dl className={s.props}>
          <div className={s.prop}>
            <dt>Status</dt>
            <dd>
              <button type="button" className={s.propBtn} onClick={(e) => onEdit("status", e.currentTarget)}>
                <StatusPill status={p.status} past={isPastDue(p)} stale={statusLooksStale(p)} />
              </button>
            </dd>
          </div>
          <div className={s.prop}>
            <dt>Owner</dt>
            <dd>
              <button type="button" className={s.propBtn} onClick={(e) => onEdit("owner", e.currentTarget)}>
                <Avatar who={p.owner} size={20} /> {PEOPLE[p.owner].name}
              </button>
            </dd>
          </div>
          <div className={s.prop}>
            <dt>Date</dt>
            <dd>
              <button type="button" className={s.propBtn} onClick={(e) => onEdit("date", e.currentTarget)}>
                <Icon.calendar size={14} />
                <span data-tone={isPastDue(p) ? "late" : n >= 0 && n <= 14 ? "soon" : undefined} className={s.propDate}>
                  {fmtDate(p.date, true)}
                </span>
                <span className={s.propSub}>{n < 0 ? `ended ${-n} days ago` : fmtRelative(p.date).toLowerCase()}</span>
              </button>
            </dd>
          </div>
          <div className={s.prop}>
            <dt>Kind</dt>
            <dd className={s.propStatic}>
              <span className={s.kindDot} data-kind={p.kind} /> {KIND_LABEL[p.kind]}
            </dd>
          </div>
          <div className={s.prop}>
            <dt>People</dt>
            <dd className={s.propStatic}>
              <AvatarStack people={p.people} max={5} size={20} />
              <span className={s.propSub}>{p.people.map((x) => PEOPLE[x].short).join(", ")}</span>
            </dd>
          </div>
          <div className={s.prop}>
            <dt>Progress</dt>
            <dd className={s.propStatic}>
              <Progress done={p.done} total={p.total} width={120} late={p.overdue} />
            </dd>
          </div>
          <div className={s.prop}>
            <dt>Open tasks</dt>
            <dd className={s.propStatic}>
              <OpenTrend p={p} width={72} height={20} />
              <span className={s.propSub}>
                over 14 days: {sum(p.sparkDone)} done, {sum(p.sparkAdded)} added
              </span>
            </dd>
          </div>
        </dl>

        <div className={s.tabs} role="tablist" aria-label="Project sections">
          {(
            [
              ["overview", "Overview"],
              ["milestones", `Milestones ${msDone}/${p.milestones.length}`],
              ["updates", "Updates"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={s.tab} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className={s.docBody}>
            <div className={s.latest} data-status={p.status}>
              <div className={s.latestHead}>
                <Avatar who={latest.who} size={20} />
                <span>
                  Latest update from {PEOPLE[latest.who].short}, {latest.when}
                </span>
              </div>
              <p className={s.latestText}>{latest.text}</p>
            </div>
            <div className={s.docCols}>
              <section>
                <h2 className={s.docH}>Next up</h2>
                <TaskList tasks={p.tasks} />
              </section>
              <section>
                <h2 className={s.docH}>{m && daysFromToday(m.date) < 0 ? "Late milestone" : "Next milestone"}</h2>
                {m ? (
                  <div className={s.nextMs}>
                    <Icon.flag size={14} />
                    <div>
                      <div className={s.nextMsName}>{m.name}</div>
                      <div className={s.propSub}>
                        <MilestoneWhen m={m} />
                        {daysFromToday(m.date) >= 0 && `, ${fmtRelative(m.date).toLowerCase()}`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={s.muted}>All milestones done.</p>
                )}
                <h2 className={s.docH}>Key links</h2>
                <LinkList links={p.links} />
              </section>
            </div>
            <section>
              <h2 className={s.docH}>Latest activity</h2>
              <ActivityList activity={p.activity} limit={5} />
            </section>
          </div>
        )}

        {tab === "milestones" && (
          <div className={s.docBody}>
            <p className={s.docLede}>
              {msDone} of {p.milestones.length} done. Tick one off and the ledger updates straight away.
            </p>
            <MilestoneList milestones={p.milestones} onToggle={onToggleMilestone} />
          </div>
        )}

        {tab === "updates" && (
          <div className={s.docBody}>
            <form
              className={s.composer}
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                onPost(draft.trim());
                setDraft("");
              }}
            >
              <Avatar who="orla" size={24} />
              <input
                className={s.composerInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write an update for the team"
                aria-label="Write an update"
              />
              <button type="submit" className={s.btnPrimarySm} disabled={!draft.trim()}>
                Post
              </button>
            </form>
            <div className={s.docCols}>
              <section>
                <h2 className={s.docH}>Updates</h2>
                {statusUpdates.length ? <ActivityList activity={statusUpdates} limit={8} /> : <p className={s.muted}>No updates yet.</p>}
              </section>
              <section>
                <h2 className={s.docH}>Status history</h2>
                <StatusHistory history={p.history} />
              </section>
            </div>
          </div>
        )}
      </article>
    </motion.div>
  );
}
