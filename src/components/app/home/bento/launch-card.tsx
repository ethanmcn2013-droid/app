"use client";

/**
 * The launch countdown: the soonest Project with a target date leads, the
 * rest follow by date through the pager. Done against a straight-line plan,
 * stages on the baseline in their real state, and a footnote when another
 * launch is behind.
 *
 * The pager stays mounted across pages so keyboard focus never drops; only
 * the body below it is replaced, with a short slide in the arrow's direction.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShellIcon } from "@/components/shell/shell-icons";
import { formatLongDay } from "@/lib/home/home-words";
import { launchAction, launchStatus, type LaunchView } from "@/lib/home/home-bento";
import { dayMonth, plural, prefersReducedMotion, rollNumber, shortDay, useHoverTips } from "./chart-kit";
import styles from "./home-bento.module.css";

type Props = Readonly<{
  launches: readonly LaunchView[];
  hasProjects: boolean;
  projectsHref: string;
  createProjectHref: string;
}>;

export function LaunchCard({ launches, hasProjects, projectsHref, createProjectHref }: Props) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLDivElement>(null);
  const prevLeft = useRef<number | null>(null);
  const focusTitle = useRef(false);
  const tipsRef = useHoverTips<HTMLElement>();
  const launch = launches[Math.min(index, launches.length - 1)];

  // Slide the new body in from the arrow's side, then settle the countdown.
  useEffect(() => {
    const body = bodyRef.current;
    if (dir !== 0 && body && !prefersReducedMotion()) {
      body.animate(
        [
          { opacity: 0, transform: `translateX(${14 * dir}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
    if (focusTitle.current) {
      focusTitle.current = false;
      body?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    }
    if (!launch || !bigRef.current) return;
    const from = prevLeft.current ?? launch.daysLeft + 9;
    prevLeft.current = launch.daysLeft;
    return rollNumber(bigRef.current, launch.daysLeft, from, dir === 0 ? 120 : 0, dir === 0 ? 480 : 320);
  }, [index, dir, launch]);

  const go = (to: number, step: number, moveFocus = false) => {
    focusTitle.current = moveFocus;
    setDir(step);
    setIndex((to + launches.length) % launches.length);
  };

  if (!launch) {
    return (
      <section className={`${styles.tile} ${styles.hero} ${styles.s7}`} aria-labelledby="home-launch-title">
        <div className={styles.rings} aria-hidden />
        <div className={styles.heroTop}>
          <span className={styles.eyebrow}>Next big day</span>
        </div>
        <div className={styles.empty}>
          <h2 id="home-launch-title">{hasProjects ? "No target dates yet" : "Start with one project"}</h2>
          <p>
            {hasProjects
              ? "Give a project a target date and Home counts down to it, and shows if you are on pace."
              : "Add a project with a target date and Home counts down to it, and shows if you are on pace."}
          </p>
          <div className={styles.actions}>
            {hasProjects ? (
              <Link className={`${styles.btn} ${styles.btnWhite}`} href={projectsHref}>
                Set a target date
              </Link>
            ) : (
              <Link className={`${styles.btn} ${styles.btnWhite}`} href={createProjectHref}>
                Set up your first project
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  const first = index === 0;
  const other = first ? launches.slice(1).find((l) => l.behind) ?? null : null;
  const end = launch.series[launch.series.length - 1] ?? [launch.todayX, 100];
  const line = launch.series.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const tx = launch.todayX;
  const planY = 100 - tx;
  const status = launchStatus(launch);
  const quick = dir !== 0;

  return (
    <section ref={tipsRef} className={`${styles.tile} ${styles.hero} ${styles.s7}`} aria-labelledby="home-launch-title">
      <div className={styles.rings} aria-hidden />
      <div className={styles.heroTop}>
        <span className={styles.eyebrow}>{first ? "Next big day" : "Coming up"}</span>
        {launches.length > 1 ? (
          <div className={styles.pager}>
            <button type="button" className={styles.pagerButton} aria-label="Previous launch" onClick={() => go(index - 1, -1)}>
              <ShellIcon.chevronLeft />
            </button>
            <span aria-live="polite">
              {index + 1} of {launches.length}
            </span>
            <button type="button" className={styles.pagerButton} aria-label="Next launch" onClick={() => go(index + 1, 1)}>
              <ShellIcon.chevronRight />
            </button>
          </div>
        ) : null}
      </div>

      <div ref={bodyRef} className={styles.heroBody} key={launch.id}>
        <h2 id="home-launch-title" className={styles.launchName} tabIndex={-1}>
          {launch.name}
        </h2>
        <div className={styles.count}>
          <div ref={bigRef} className={styles.big} aria-hidden>
            {launch.daysLeft}
          </div>
          <div className={styles.countMeta}>
            <p className={styles.when}>
              <span className={styles.sr}>{launch.daysLeft} </span>
              <span>{launch.daysLeft === 1 ? "day" : "days"} to go</span>
              <span>{formatLongDay(launch.target)}</span>
            </p>
            <span className={`${styles.pill} ${styles.pillMd} ${styles.status}`} data-behind={launch.behind ? "" : undefined}>
              <i aria-hidden />
              {status}
            </span>
          </div>
        </div>

        <div
          className={styles.chart}
          role="img"
          aria-label={`Burn-up chart: ${launch.done} of ${launch.total} tasks done by today; the plan for today was ${Math.round(launch.plan)}; due ${formatLongDay(launch.target)}; ${status}.`}
          aria-describedby="home-launch-stages"
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,.34)" vectorEffect="non-scaling-stroke" />
            <path d={`M0 100 L${tx} ${planY}`} stroke="rgba(255,255,255,.2)" strokeWidth="1.25" strokeDasharray="3 6" fill="none" vectorEffect="non-scaling-stroke" />
            <path d={`M${tx} ${planY} L100 0`} stroke="rgba(255,255,255,.58)" strokeWidth="1.5" strokeDasharray="3 6" fill="none" vectorEffect="non-scaling-stroke" />
            <line x1={tx} y1="0" x2={tx} y2="100" stroke="rgba(255,255,255,.4)" vectorEffect="non-scaling-stroke" />
            {launch.behind ? (
              <line className={styles.gap} x1={tx} y1={end[1]} x2={tx} y2={planY} stroke="#ffd27a" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          <div className={`${styles.draw} ${styles.drawIn}`} style={quick ? { animationDuration: "420ms", animationDelay: "40ms" } : undefined}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <path d={`${line} L${end[0]} 100 L0 100 Z`} fill="rgba(255,255,255,.17)" />
              <path d={line} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <span className={styles.planLabel} aria-hidden>
            Plan
          </span>
          <span className={styles.dot} style={{ left: `${end[0]}%`, top: `${end[1]}%`, animationDelay: quick ? "400ms" : undefined }} aria-hidden />
          <span
            className={styles.doneLabel}
            data-below={launch.diff < 0 ? "" : undefined}
            style={{ left: `${end[0]}%`, top: `${end[1]}%`, animationDelay: quick ? "450ms" : undefined }}
            aria-hidden
          >
            {launch.done} of {launch.total} tasks done
          </span>
          <span className={styles.axis} style={{ left: 0 }} aria-hidden>
            {dayMonth(launch.start)}
          </span>
          <span className={`${styles.axis} ${styles.axisToday}`} style={{ left: `${tx}%` }} aria-hidden>
            Today
          </span>
          <span className={`${styles.axis} ${styles.axisEnd}`} aria-hidden>
            {dayMonth(launch.target)}
          </span>
          {launch.stages
            .filter((s) => s.x < 99)
            .map((s) => (
              <span
                key={`${s.title}-${s.date}`}
                className={styles.stage}
                data-state={s.state}
                style={{ left: `${s.x}%` }}
                data-tip={
                  s.state === "done"
                    ? `${s.title} · done`
                    : s.state === "late"
                      ? `${s.title} · was due ${shortDay(s.date)}`
                      : s.state === "next"
                        ? `${s.title} · next · ${shortDay(s.date)}`
                        : `${s.title} · ${shortDay(s.date)}`
                }
                aria-hidden
              />
            ))}
        </div>
        <p className={styles.sr} id="home-launch-stages">
          {launch.stages.length
            ? `Stages: ${launch.stages.map((s) => `${s.title} ${shortDay(s.date)}${s.state === "done" ? ", done" : s.state === "late" ? ", late" : s.state === "next" ? ", next" : ""}`).join("; ")}.`
            : "No stages are set for this project."}
        </p>

        <div className={styles.actions}>
          <Link className={`${styles.btn} ${styles.btnWhite}`} href={launch.tasksHref}>
            {launchAction(launch)}
          </Link>
          <Link className={`${styles.btn} ${styles.btnGhost}`} href={launch.href}>
            Open timeline
          </Link>
          {launch.nextStage ? (
            <span className={styles.nextStage}>
              <i aria-hidden />
              <span>
                Next stage: <b>{launch.nextStage.title}</b> · {shortDay(launch.nextStage.date)}
              </span>
            </span>
          ) : null}
        </div>

        {other ? (
          <button type="button" className={styles.hint} onClick={() => go(launches.indexOf(other), 1, true)}>
            <span className={styles.warnDot} aria-hidden />
            <span>
              Needs a look: <b>{other.name}</b> is {plural(Math.round(-other.diff), "task")} behind · {plural(other.daysLeft, "day")} to go
            </span>
            <ShellIcon.arrowRight />
          </button>
        ) : null}
      </div>
    </section>
  );
}
