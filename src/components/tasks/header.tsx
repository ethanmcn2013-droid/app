"use client";

/**
 * The Tasks header: where you are, who is here, how far along the work is,
 * and the three facts a person opens the board to answer (overdue, due
 * today, needs a date). Each fact is a filter you can press.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useActiveWorkspace, useColumnConfig, useDomain, useWorkspaceMembers } from "@/lib/domain-context";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
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
import { useSurface } from "./surface";
import { timeOf } from "./time";
import { TIcon } from "./icons";
import { Kbd } from "./atoms";
import { Button, MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger, Popover } from "./ui";
import styles from "./workspace.module.css";

/** A stable identity tile tone from the project id. */
function projectTone(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return (hash % 8) + 1;
}

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
    initial: (name.trim()[0] ?? "P").toUpperCase(),
    tone: projectTone(workspace?.id ?? name),
    href: projectId ? withActiveProject(PROJECT_APP_PATH, projectId) : PROJECT_APP_PATH,
  };
}

export function TasksHeader({ onNewTask }: { onNewTask: (anchor: HTMLElement | null) => void }) {
  const surface = useSurface();
  const project = useProjectIdentity();
  return (
    <header className={styles.header} data-floor-head="">
      <div className={styles.contextRow}>
        <Link href={project.href} className={styles.project} title={project.name}>
          <span className={styles.projectTile} style={{ background: `var(--v3-project-${project.tone})` }} aria-hidden="true">
            {project.initial}
          </span>
          <span className={styles.projectName}>{project.name}</span>
        </Link>
        <div className={styles.headerActions}>
          <TaskCollaborators />
          <span className={styles.shareSlot}>
            <ShareButton view={surface.view} variant="band" />
          </span>
          <OverflowMenu />
          {surface.readOnly ? null : (
            <Button
              variant="primary"
              className={styles.newTask}
              icon={<TIcon.plus />}
              data-new-task-anchor=""
              aria-keyshortcuts="C"
              onClick={(event) => onNewTask(event.currentTarget)}
            >
              New task
              <Kbd>C</Kbd>
            </Button>
          )}
        </div>
      </div>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Tasks</h1>
        {surface.readOnly ? (
          <span className={styles.viewOnly} title="You can see this project but not change it. Ask an owner for edit access.">
            View only
          </span>
        ) : null}
      </div>
      <ProgressFacts />
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

/* ── Progress and facts ───────────────────────────────────────────── */

function ProgressFacts() {
  const surface = useSurface();
  const calendar = useCalendarFrame();
  const { due, setDue } = useRoomTools();
  const facts = useMemo(() => {
    let done = 0;
    let overdue = 0;
    let today = 0;
    let undated = 0;
    for (const task of surface.all) {
      const finished = surface.isDone(task);
      if (finished) done += 1;
      const time = timeOf(task, finished, calendar);
      if (time.kind === "overdue") overdue += 1;
      if (time.kind === "today") today += 1;
      if (!finished && task.schedule.kind === "unscheduled") undated += 1;
    }
    return { total: surface.all.length, done, overdue, today, undated };
  }, [calendar, surface]);

  if (facts.total === 0) return null;
  const ratio = facts.total ? facts.done / facts.total : 0;
  const allDone = facts.done === facts.total;

  const toggle = (value: RoomDueFilter) => setDue(due === value ? "all" : value);

  return (
    <div className={styles.progressRow}>
      <div className={styles.progress}>
        {allDone ? (
          <span className={styles.allDone}>
            <TIcon.check size={14} /> All {facts.total} done
          </span>
        ) : (
          <span className={styles.progressText}>
            <b>{facts.done}</b> of {facts.total} done
          </span>
        )}
        <span
          className={styles.meter}
          role="progressbar"
          aria-label="Tasks done"
          aria-valuemin={0}
          aria-valuemax={facts.total}
          aria-valuenow={facts.done}
          aria-valuetext={`${facts.done} of ${facts.total} done`}
        >
          <span className={styles.meterFill} style={{ transform: `scaleX(${ratio})` }} />
        </span>
      </div>
      {allDone ? null : (
        <div className={styles.facts} role="group" aria-label="Quick filters">
          <FactToggle
            tone="danger"
            icon={<TIcon.alert size={14} />}
            count={facts.overdue}
            label="overdue"
            pressed={due === "overdue"}
            onPress={() => toggle("overdue")}
            tip="Show only overdue tasks. Press again to show everything."
          />
          <FactToggle
            tone="accent"
            icon={<TIcon.sun size={14} />}
            count={facts.today}
            label="due today"
            pressed={due === "today"}
            onPress={() => toggle("today")}
            tip="Show only tasks due today. Press again to show everything."
          />
          <FactToggle
            tone="neutral"
            icon={<TIcon.noDate size={14} />}
            count={facts.undated}
            label={facts.undated === 1 ? "needs a date" : "need a date"}
            pressed={due === "unscheduled"}
            onPress={() => toggle("unscheduled")}
            tip="Show only open tasks without a date. Press again to show everything."
          />
        </div>
      )}
    </div>
  );
}

function FactToggle({
  tone,
  icon,
  count,
  label,
  pressed,
  onPress,
  tip,
}: {
  tone: "danger" | "accent" | "neutral";
  icon: React.ReactNode;
  count: number;
  label: string;
  pressed: boolean;
  onPress: () => void;
  tip: string;
}) {
  return (
    <button
      type="button"
      className={styles.fact}
      data-tone={tone}
      data-zero={count === 0 ? "" : undefined}
      aria-pressed={pressed}
      disabled={count === 0 && !pressed}
      title={tip}
      onClick={onPress}
    >
      {icon}
      <span className={styles.factCount}>{count}</span>
      <span>{label}</span>
      {pressed ? <TIcon.close size={12} /> : null}
    </button>
  );
}
