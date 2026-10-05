"use client";

/**
 * The Tasks header, the same on the board, the list and the calendar: the
 * title and the project, one summary line counted from the whole project,
 * one sentence about stuck work that ends in the thing to do, then the
 * team, Stuck, Share and the overflow pinned top right.
 *
 * There is no create button here. A screen has one, the top bar's New, and
 * the C key opens the same composer (add-task-context.tsx). The actions
 * group carries data-new-task-anchor so the composer still opens from the
 * top right of the page.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useActiveWorkspace, useColumnConfig, useDomain, useWorkspaceMembers } from "@/lib/domain-context";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useRoomTools, type RoomDueFilter } from "@/components/app/room/room-tools-context";
import { AvatarStack, type PresenceMember } from "@/components/app/presence/avatar-stack";
import { ShareButton } from "@/components/app/share/share-button";
import { useToast } from "@/components/primitives/toast";
import { formatTasksAsCsv, formatTasksAsMarkdown } from "@/lib/exports";
import { publicBoardColumns } from "@/lib/public-board-lanes";
import { PROJECT_APP_PATH } from "@/lib/product-urls";
import { parseProjectId } from "@/lib/projects/project-ref";
import { withActiveProject } from "@/lib/projects/project-url";
import { floorProjectName } from "@/lib/projects/floor-project-name";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useSurface } from "./surface";
import { STUCK_AFTER_DAYS, dayWords, donePercent } from "./tasks-pulse";
import { identityHue } from "./identity-hue";
import { TIcon } from "./icons";
import { Kbd } from "./atoms";
import { Button, MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger, Popover } from "./ui";
import styles from "./workspace.module.css";

export function useProjectIdentity() {
  const domain = useDomain();
  const workspace = useActiveWorkspace();
  const name = floorProjectName({
    boardName: domain.boardName,
    workspaceName: domain.workspaceName,
    domainExample: domain.workspaceTitle,
  });
  const projectId = parseProjectId(workspace?.id);
  return {
    id: workspace?.id ?? "project",
    projectId,
    name,
    /** The same colour the sidebar gives this project: identity, never status. */
    colour: identityHue(workspace?.id ?? name),
    href: projectId ? withActiveProject(PROJECT_APP_PATH, projectId) : PROJECT_APP_PATH,
  };
}

export function TasksHeader() {
  const surface = useSurface();
  const project = useProjectIdentity();
  return (
    <header className={styles.header} data-floor-head="">
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Tasks</h1>
        <Link href={project.href} className={styles.projectPill} title={`Open ${project.name}`}>
          <span className={styles.projectDot} style={{ background: project.colour }} aria-hidden="true" />
          <span className={styles.projectName}>{project.name}</span>
        </Link>
        {surface.readOnly ? (
          <span className={styles.viewOnly} title="You can see this project but not change it. Ask an owner for edit access.">
            View only
          </span>
        ) : null}
      </div>
      <div className={styles.headerActions} data-new-task-anchor="">
        <TaskCollaborators />
        <StuckButton />
        <span className={styles.shareSlot}>
          <ShareButton view={surface.view} variant="band" />
        </span>
        <OverflowMenu />
      </div>
      <SummaryLine />
      <StuckSentence />
    </header>
  );
}

/* ── Collaborators ────────────────────────────────────────────────── */

function TaskCollaborators() {
  const surface = useSurface();
  const members = useWorkspaceMembers();
  const workspace = useActiveWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const people = useMemo<PresenceMember[]>(
    () => members.map((member) => ({ id: member.id, name: member.name, initials: member.initials })),
    [members],
  );
  if (people.length === 0) return null;
  const settingsHref = parseProjectId(workspace?.id)
    ? withActiveProject("/app/settings", parseProjectId(workspace?.id)!)
    : "/app/settings";
  return (
    <>
      <span className={styles.collaborators} ref={wrap}>
        <AvatarStack
          members={people}
          max={3}
          size="md"
          showCount={people.length > 1}
          label={`Project members: ${people.map((p) => p.name).join(", ")}`}
          pressed={Boolean(anchor)}
          onClick={() => setAnchor((current) => (current ? null : wrap.current))}
        />
      </span>
      <Popover open={Boolean(anchor)} anchor={anchor} onClose={() => setAnchor(null)} label="Project members" width={300} align="end">
        <div className={styles.membersPanel}>
          <p className={styles.membersTitle}>
            {people.length} {people.length === 1 ? "person" : "people"} in this project
          </p>
          <ul className={styles.membersList}>
            {members.map((member) => (
              <li key={member.id} className={styles.memberRow}>
                <AvatarStack members={[{ id: member.id, name: member.name, initials: member.initials }]} size="sm" max={1} label={member.name} />
                <span className={styles.memberName}>{member.name}</span>
                <span className={styles.memberRole}>{member.role === "owner" ? "Owner" : "Member"}</span>
              </li>
            ))}
          </ul>
          {surface.canManage ? (
            <Link href={settingsHref} className={styles.inviteLink} onClick={() => setAnchor(null)}>
              <span className={styles.inviteIcon} aria-hidden="true"><TIcon.plus size={14} /></span>
              Invite people
            </Link>
          ) : null}
        </div>
      </Popover>
    </>
  );
}

/* ── Overflow: print, export, subscribe, shortcuts ────────────────── */

function OverflowMenu() {
  const surface = useSurface();
  const { toast } = useToast();
  const { tasks } = useTasksState();
  const columnConfig = useColumnConfig();
  const project = useProjectIdentity();
  const workspace = useActiveWorkspace();
  const printPath = project.projectId
    ? withActiveProject(`/print/${surface.view}`, project.projectId)
    : `/print/${surface.view}`;

  const copy = async (text: string, title: string, body: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(title, { tone: "success", body });
    } catch {
      toast("Couldn't copy", { tone: "error", body: "Your browser blocked the clipboard. Try again." });
    }
  };

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="ghost" iconOnly aria-label="More actions" icon={<TIcon.more />} />
      </MenuTrigger>
      <MenuContent align="end" width={248} label="More actions">
        <MenuItem icon={<TIcon.print />} onSelect={() => window.open(printPath, "_blank", "noopener,noreferrer")}>
          Print this view
        </MenuItem>
        <MenuItem
          icon={<TIcon.sheet />}
          onSelect={() => void copy(formatTasksAsCsv(tasks, publicBoardColumns(columnConfig, tasks)), "Copied as CSV", "Paste it into Google Sheets, Excel or Numbers.")}
        >
          Copy as CSV
        </MenuItem>
        <MenuItem
          icon={<TIcon.copy />}
          onSelect={() => void copy(formatTasksAsMarkdown(tasks, project.name, publicBoardColumns(columnConfig, tasks)), "Copied as Markdown", "Paste it into Google Docs, Notion or any notes app.")}
        >
          Copy as Markdown
        </MenuItem>
        {workspace ? (
          <MenuItem
            icon={<TIcon.calendar />}
            onSelect={() =>
              void copy(
                `${window.location.origin.replace(/^https?/, "webcal")}/api/calendar/${workspace.id}`,
                "Calendar link copied",
                "Paste it where your calendar app asks to add a subscription.",
              )
            }
          >
            Subscribe in a calendar
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<TIcon.keyboard />} hint={<Kbd>?</Kbd>} onSelect={() => surface.setShortcutsOpen(true)}>
          Keyboard shortcuts
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

/* ── Summary line ─────────────────────────────────────────────────── */

/**
 * "5 done this week · 8 open · 1 late": counted from the whole project, so
 * the figures never shrink to a filtered subset. Late, due today and no date
 * are filters you can press; press again to show everything.
 */
function SummaryLine() {
  const surface = useSurface();
  const { due, setDue } = useRoomTools();
  const pulse = surface.pulse;
  if (pulse.total === 0) return null;
  const toggle = (value: RoomDueFilter) => setDue(due === value ? "all" : value);
  const allDone = pulse.done === pulse.total;
  return (
    <p className={styles.summary}>
      <span
        className={styles.ring}
        style={{ "--p": `${donePercent(pulse)}%` } as React.CSSProperties}
        role="img"
        aria-label={`${pulse.done} of ${pulse.total} tasks done`}
        title={`${pulse.done} of ${pulse.total} tasks done`}
      />
      {allDone ? (
        <span>
          All <strong className={styles.strong}>{pulse.total}</strong> done
        </span>
      ) : (
        <>
          <span>
            <strong className={styles.strong}>{pulse.doneThisWeek}</strong> done this week
          </span>
          <span className={styles.factGroup}>
            <Sep />
            <span>
              <strong className={styles.strong}>{pulse.open}</strong> open
            </span>
          </span>
          <Fact count={pulse.late} label="late" tone="danger" pressed={due === "overdue"} onPress={() => toggle("overdue")} tip="Show only late tasks" />
          <Fact count={pulse.dueToday} label="due today" pressed={due === "today"} onPress={() => toggle("today")} tip="Show only tasks due today" />
          <Fact count={pulse.undated} label="with no date" pressed={due === "unscheduled"} onPress={() => toggle("unscheduled")} tip="Show only open tasks with no date" />
        </>
      )}
    </p>
  );
}

function Sep() {
  return (
    <span className={styles.sep} aria-hidden="true">
      ·
    </span>
  );
}

function Fact({
  count,
  label,
  tone,
  pressed,
  onPress,
  tip,
}: {
  count: number;
  label: string;
  tone?: "danger";
  pressed: boolean;
  onPress: () => void;
  tip: string;
}) {
  if (count === 0 && !pressed) return null;
  // The dot travels with its fact, so a wrapped line never ends on a dot.
  return (
    <span className={styles.factGroup}>
      <Sep />
      <button type="button" className={styles.fact} data-tone={tone} aria-pressed={pressed} title={pressed ? "Show everything" : tip} onClick={onPress}>
        {count} {label}
      </button>
    </span>
  );
}

/* ── Stuck ────────────────────────────────────────────────────────── */

const hourglass = (
  <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 2.5h7M4.5 13.5h7M5.25 2.5c0 3 5.5 3.25 5.5 5.5s-5.5 2.5-5.5 5.5M10.75 2.5c0 3-5.5 3.25-5.5 5.5s5.5 2.5 5.5 5.5" />
  </svg>
);

function StuckButton() {
  const surface = useSurface();
  const count = surface.pulse.stuck.length;
  if (count === 0) return null;
  return (
    <button
      type="button"
      className={styles.stuckChip}
      aria-pressed={surface.stuckOnly}
      title={surface.stuckOnly ? "Show everything" : `Show only started work that has not changed in ${STUCK_AFTER_DAYS} days or more`}
      onClick={() => surface.setStuckOnly(!surface.stuckOnly)}
    >
      {hourglass}
      Stuck
      <span className={styles.stuckCount}>{count}</span>
    </button>
  );
}

/**
 * One sentence about the work that ends in the thing to do: the task that
 * has sat longest, a way to open it, and how many more are stuck.
 */
function StuckSentence() {
  const surface = useSurface();
  const { openTask } = useTaskPanel();
  const [first, ...rest] = surface.pulse.stuck;
  if (!first) return null;
  return (
    <p className={styles.health}>
      {hourglass}
      <span>
        <strong>{first.title}</strong> has not changed in {dayWords(first.days)}.{" "}
        <span className={styles.inlineTail}>
          <button type="button" className={styles.inlineAction} onClick={() => openTask(first.id)}>
            Open it
          </button>
          {rest.length ? (
            <>
              <span className={styles.inlineSep} aria-hidden="true">
                ·
              </span>
              <button type="button" className={styles.inlineQuiet} aria-pressed={surface.stuckOnly} onClick={() => surface.setStuckOnly(!surface.stuckOnly)}>
                {surface.stuckOnly ? "Show everything" : `${rest.length} more stuck`}
              </button>
            </>
          ) : null}
        </span>
      </span>
    </p>
  );
}
