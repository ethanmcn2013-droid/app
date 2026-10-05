"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import clsx from "clsx";
import { STAGES, type Task, type TeamSet } from "./data";
import { isOpen, lowerFirst, laneIdOf, openLoad, plural, type Lane, type Lens } from "./model";
import { Avatar, CapacityMeter, DueChip, LoadRing, type Handoff } from "./parts";
import { IconCheck, IconClock, IconHand, IconMoon } from "./icons";
import s from "./c2.module.css";

export function PhoneBoard({
  set,
  lens,
  lanes,
  tasks,
  slots,
  handoffs,
  suggestedIds,
  onHandOver,
}: {
  set: TeamSet;
  lens: Lens;
  lanes: Lane[];
  tasks: Task[];
  slots: number;
  handoffs: Record<string, Handoff>;
  suggestedIds: Set<string>;
  onHandOver: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const active = lanes.find((l) => l.id === picked) ?? lanes[0];
  const laneTasks = tasks.filter((t) => laneIdOf(t, lens) === active.id);
  const open = laneTasks.filter(isOpen);
  const done = laneTasks.length - open.length;
  const person = active.kind === "person" ? active.person : null;
  const projectById = new Map(set.projects.map((p) => [p.id, p]));
  const personById = new Map(set.people.map((p) => [p.id, p]));

  return (
    <div className={s.phone}>
      <div className={s.tabs} role="tablist" aria-label={lens === "person" ? "People" : "Projects"}>
        {lanes.map((lane) => {
          const on = lane.id === active.id;
          const n = tasks.filter((t) => laneIdOf(t, lens) === lane.id && isOpen(t)).length;
          let ring;
          let caption: string;
          let over = false;
          if (lane.kind === "person") {
            const l = openLoad(tasks, lane.person.id);
            over = l > lane.person.capacity;
            ring = (
              <LoadRing load={lane.person.away ? 0 : l} capacity={lane.person.capacity}>
                <Avatar person={lane.person} size={44} />
              </LoadRing>
            );
            caption = lane.person.away ? "Away" : `${l} of ${lane.person.capacity}`;
          } else if (lane.kind === "unassigned") {
            ring = (
              <LoadRing load={0} capacity={1} dashed>
                <Avatar person={null} size={44} />
                {n ? <span className={s.tabBadge}>{n}</span> : null}
              </LoadRing>
            );
            caption = n ? `${n} to claim` : "All claimed";
          } else {
            const all = tasks.filter((t) => t.project === lane.project.id);
            const d = all.length - n;
            ring = (
              <LoadRing load={d} capacity={Math.max(all.length, 1)}>
                <span className={s.projectTile} style={{ width: 44, height: 44, borderRadius: 999, background: `var(--v3-project-${lane.project.hue})`, fontSize: 15 }}>
                  {lane.project.short.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
                </span>
              </LoadRing>
            );
            caption = `${n} open`;
          }
          const name = lane.kind === "person" ? lane.person.first : lane.kind === "project" ? lane.project.short : "No owner";
          return (
            <button
              key={lane.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={clsx(s.tab, on && s.tabOn, lane.kind === "person" && lane.person.away && s.tabAway)}
              onClick={() => setPicked(lane.id)}
            >
              {ring}
              <span className={s.tabName}>{name}</span>
              <span className={clsx(s.tabCaption, over && s.meterOver)}>{caption}</span>
              {on ? <motion.span layoutId="c2-tab-mark" className={s.tabMark} /> : null}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={`${lens}-${active.id}`}
          className={s.phonePanel}
          role="tabpanel"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          <div className={clsx(s.phoneHead, active.kind === "unassigned" && s.phoneHeadNone, person?.away && s.laneAway)}>
            <div className={s.phoneHeadTop}>
              <div className={s.railWho}>
                <span className={s.phoneName}>
                  {active.kind === "person" ? active.person.name : active.kind === "project" ? active.project.name : "No owner yet"}
                </span>
                <span className={s.railRole}>
                  {person?.away ? (
                    <span className={s.awayNote}>
                      <IconMoon width={12} height={12} />
                      {person.away}
                    </span>
                  ) : person ? (
                    person.role
                  ) : active.kind === "project" ? (
                    active.project.note
                  ) : open.length ? (
                    "Unowned work is the easiest to lose. Hand each one to someone with room."
                  ) : (
                    "Every task has an owner"
                  )}
                </span>
              </div>
              {done ? (
                <span className={s.phoneDone}>
                  <IconCheck width={12} height={12} />
                  {done} done
                </span>
              ) : null}
            </div>
            {person ? <CapacityMeter load={openLoad(tasks, person.id)} capacity={person.capacity} slots={slots} away={!!person.away} /> : null}
          </div>

          {open.length === 0 ? (
            <div className={s.phoneEmpty}>
              {person ? (
                person.away ? (
                  <p>
                    <strong>{person.first} is {lowerFirst(person.away)}.</strong> Nothing is waiting on them.
                  </p>
                ) : (
                  <p>
                    <strong>Nothing on {person.first}&apos;s plate.</strong> Hand something over or leave room for {set.leaveRoomFor}.
                  </p>
                )
              ) : (
                <p>
                  <strong>Every task has an owner.</strong>
                </p>
              )}
            </div>
          ) : (
            STAGES.filter((st) => st.id !== "done").map((st) => {
              const list = open.filter((t) => t.stage === st.id);
              if (!list.length) return null;
              return (
                <div key={st.id} className={s.phoneSection}>
                  <h3 className={s.phoneSectionHead}>
                    <span className={s.stageMark} data-stage={st.id} aria-hidden />
                    {st.label}
                    <span className={s.colCount}>{list.length}</span>
                  </h3>
                  <ul className={s.phoneList}>
                    {list.map((t) => {
                      const project = projectById.get(t.project);
                      const owner = t.owner ? personById.get(t.owner) ?? null : null;
                      const h = handoffs[t.id];
                      return (
                        <motion.li key={t.id} layout className={clsx(s.phoneCard, suggestedIds.has(t.id) && s.cardSuggested)}>
                          <div className={s.phoneCardMain}>
                            <p className={s.cardTitle}>{t.title}</p>
                            <div className={s.cardFoot}>
                              <DueChip task={t} />
                              {t.stage === "waiting" && t.label ? (
                                <span className={clsx(s.chip, s.chipQuiet)}>
                                  <IconClock width={12} height={12} />
                                  {t.label}
                                </span>
                              ) : lens === "person" && project ? (
                                <span className={clsx(s.chip, s.chipQuiet)}>
                                  <span className={s.dot} style={{ background: `var(--v3-project-${project.hue})` }} />
                                  {project.short}
                                </span>
                              ) : (
                                <span className={clsx(s.chip, s.chipQuiet)}>
                                  <Avatar person={owner} size={16} />
                                  {owner?.first ?? "No owner"}
                                </span>
                              )}
                            </div>
                          </div>
                          <button type="button" className={clsx(s.phoneHand, h && s.phoneHandDone)} onClick={() => onHandOver(t.id)}>
                            {h ? <Avatar person={h.to} size={20} /> : <IconHand width={14} height={14} />}
                            {active.kind === "unassigned" ? "Give" : "Hand over"}
                          </button>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
          {active.kind === "unassigned" || lens === "project" ? null : (
            <p className={s.phoneFoot}>
              {plural(open.length, "open task")} with {person?.first}. Tap Hand over to pass one to someone with room.
            </p>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
