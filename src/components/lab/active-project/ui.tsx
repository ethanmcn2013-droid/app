"use client";

/**
 * WP5 lab · shared pieces every variant needs and none of them should invent:
 * the icon set, the live region, the surface condition, the footer line, and
 * the product canvas that proves a wrong-Project render is impossible.
 *
 * Presentation lives in the variants. What is here is either a decision the
 * plan already made (the footer wording, which state wins) or a primitive the
 * repo has no shared version of (there is no Button and no icon library —
 * these are copied into the lab rather than reaching into production).
 */

import type { CSSProperties, ReactNode } from "react";
import { contentFor, type LabRow } from "./model";
import type { LabSession } from "./machine";

/** Plan §7.3, verbatim. */
export const FOOTER_LINE = "This project stays active in Notes, Tasks and Timeline.";

// ── Icons ───────────────────────────────────────────────────────────────────

type IconProps = { className?: string; size?: number; style?: CSSProperties };

function svg(path: ReactNode, { className, size = 16, style }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {path}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => svg(<path d="M3 8.5 6.5 12 13 4.5" />, p);
export const ChevronIcon = (p: IconProps) => svg(<path d="M4 6l4 4 4-4" />, p);
export const SearchIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4 13.5 13.5" />
    </>,
    p,
  );
export const AlertIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.6M8 11h.01" />
    </>,
    p,
  );
export const OfflineIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M2 2l12 12" />
      <path d="M8 12.5h.01" />
      <path d="M4.6 9.4a5 5 0 0 1 2-1.2M11.4 9.4a5 5 0 0 0-2.6-1.3M2.2 6.6A9 9 0 0 1 5 5m8.8 1.6a9 9 0 0 0-3.4-2" />
    </>,
    p,
  );
export const PlusIcon = (p: IconProps) => svg(<path d="M8 3.5v9M3.5 8h9" />, p);
export const LockIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.4" />
      <path d="M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7" />
    </>,
    p,
  );

// ── Live region ─────────────────────────────────────────────────────────────

/**
 * One polite region per surface. Every switch, failure and result count is
 * announced through this and nothing else, so an announcement cannot be lost
 * to a component unmounting mid-transition.
 */
export function LiveRegion({ message }: { message: string }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

/** Visually hidden without leaving the accessibility tree. */
export const SR_ONLY =
  "absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]";

// ── Surface condition ───────────────────────────────────────────────────────

export type SurfaceCondition =
  | { kind: "resolving" }
  | { kind: "no-projects" }
  | { kind: "access-lost" }
  | { kind: "offline" }
  | { kind: "archived"; row: LabRow }
  | { kind: "ready"; row: LabRow };

/**
 * Which state owns the surface, decided once. The order is the order of
 * severity in plan §7.4: an unresolved catalog outranks an offline shell,
 * which outranks lost access, which outranks anything readable.
 */
export function surfaceCondition(session: LabSession): SurfaceCondition {
  if (session.resolving) return { kind: "resolving" };
  if (session.offline) return { kind: "offline" };
  if (session.accessLost) return { kind: "access-lost" };
  if (!session.committed) return { kind: "no-projects" };
  if (session.committed.archived) return { kind: "archived", row: session.committed };
  return { kind: "ready", row: session.committed };
}

// ── Small shared parts ──────────────────────────────────────────────────────

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`ap-skeleton block ${className}`} />;
}

export function Notice({
  tone = "quiet",
  icon,
  title,
  children,
  action,
}: {
  tone?: "quiet" | "warn";
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const warn = tone === "warn";
  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4",
        warn
          ? "border-[color:var(--status-blocked)]/25 bg-[color:var(--status-blocked-bg)]/45"
          : "border-hairline bg-paper-soft",
      ].join(" ")}
    >
      {icon ? (
        <span
          className={warn ? "mt-px text-[color:var(--status-blocked)]" : "mt-px text-ink-faint"}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-[1.4] text-ink">{title}</p>
        {children ? (
          <div className="mt-1 text-[13px] leading-[1.5] text-ink-soft">{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function LabButton({
  children,
  onClick,
  variant = "quiet",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "quiet" | "solid";
  disabled?: boolean;
  title?: string;
}) {
  const solid = variant === "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "ap-r [--ap-r:8px] inline-flex min-h-[36px] items-center justify-center",
        "rounded-lg px-3 text-[13px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        solid
          ? "bg-accent text-[color:var(--x-on-accent)] hover:bg-accent-hover"
          : "border border-hairline bg-paper text-ink hover:bg-paper-deep",
      ].join(" ")}
      style={{ transitionDuration: "var(--motion-fast)" }}
    >
      {children}
    </button>
  );
}

// ── The product canvas ──────────────────────────────────────────────────────

/**
 * The proof surface. Its whole job is to make a wrong-Project render a visible
 * failure: the heading, the story line and every task title come from
 * `PROJECT_TRUTH_CONTENT`, where each Project carries a word no other Project
 * uses. "Harbour" under a heading saying Saltmarsh Barn is not a judgement
 * call, it is a wrong word on screen.
 */
export function ProductCanvas({
  session,
  onCreateFirst,
}: {
  session: LabSession;
  onCreateFirst?: () => void;
}) {
  const condition = surfaceCondition(session);
  const pending = session.status.kind === "pending" ? session.status : null;

  if (condition.kind === "resolving") {
    return (
      <div className="space-y-4" aria-busy="true">
        <p className={SR_ONLY}>Loading your projects.</p>
        <Skeleton className="h-8 w-[min(360px,70%)] rounded-lg" />
        <Skeleton className="h-4 w-[min(460px,88%)] rounded-md" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-[52px] w-full rounded-lg" />
          <Skeleton className="h-[52px] w-full rounded-lg" />
          <Skeleton className="h-[52px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (condition.kind === "offline") {
    return (
      <div className="rounded-lg border border-hairline bg-paper-deep px-5 py-10 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-pill bg-paper text-ink-faint">
          <OfflineIcon size={18} />
        </span>
        <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-ink">
          You are offline
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-[1.55] text-ink-soft">
          Project work is covered rather than kept on this device. Switching
          projects and saving changes come back with the connection.
        </p>
      </div>
    );
  }

  if (condition.kind === "access-lost") {
    return (
      <div className="rounded-lg border border-hairline bg-paper px-5 py-10 text-center">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          This project is not available
        </h2>
        <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-[1.55] text-ink-soft">
          Nothing has been opened in its place. Choose one of your other
          projects to carry on.
        </p>
      </div>
    );
  }

  if (condition.kind === "no-projects") {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-paper px-5 py-10 text-center">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          Start your first project
        </h2>
        <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-[1.55] text-ink-soft">
          A project holds one piece of work — a wedding, a season, an event.
          Notes keeps capturing on its own until you make one.
        </p>
        <div className="mt-5">
          <LabButton variant="solid" onClick={onCreateFirst}>
            New project
          </LabButton>
        </div>
      </div>
    );
  }

  const row = condition.row;
  const content = contentFor(row.id);
  const archived = condition.kind === "archived";
  // Plan §7.4: committed A stays explicitly A and inert until B verifies.
  // Not a skeleton, not relabelled — the same data, held still.
  const held = pending !== null;

  return (
    <div className="space-y-5">
      {archived ? (
        <Notice
          icon={<LockIcon size={16} />}
          title="Archived · read-only"
          action={
            row.capabilities.deleteOrTransferOwnership ? (
              <LabButton>Restore project</LabButton>
            ) : null
          }
        >
          You can read everything here and revoke old share links. Nothing new
          can be added or published.
        </Notice>
      ) : null}

      {session.destinationFailed ? (
        <Notice
          tone="warn"
          icon={<AlertIcon size={16} />}
          title={`${row.name} is selected. Timeline is unavailable.`}
          action={<LabButton onClick={session.retry}>Try again</LabButton>}
        >
          The project did open. Only its timeline failed to load, and nothing
          from your previous project is showing here.
        </Notice>
      ) : null}

      {session.status.kind === "failed" ? (
        <Notice
          tone="warn"
          icon={<AlertIcon size={16} />}
          title={`Couldn't open ${session.status.target.name}. You're still in ${row.name}.`}
          action={<LabButton onClick={session.retry}>Try again</LabButton>}
        >
          Nothing changed. The link, the heading and everything you save still
          belong to {row.name}.
        </Notice>
      ) : null}

      {session.status.kind === "save-failed" ? (
        <Notice
          tone="warn"
          icon={<AlertIcon size={16} />}
          title="Your changes did not save"
          action={
            <div className="flex flex-wrap gap-2">
              <LabButton onClick={session.stay}>Stay here</LabButton>
              <LabButton variant="solid" onClick={session.retry}>
                Try again
              </LabButton>
              <LabButton onClick={session.discardAndSwitch}>
                Discard and switch
              </LabButton>
            </div>
          }
        >
          {session.status.target.name} has not opened. Your work is still on
          screen and still belongs to {row.name}.
        </Notice>
      ) : null}

      {session.state.id === "permission-downgrade" && row.role === "member" ? (
        <Notice
          icon={<AlertIcon size={16} />}
          title="You are now a member of this project"
          action={<LabButton disabled>Project settings</LabButton>}
        >
          You can still read everything and work on tasks. Renaming, archiving
          and publishing left with the change.
        </Notice>
      ) : null}

      {session.draftFiledTo ? (
        <div className="rounded-lg border border-hairline bg-paper-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">
              Note draft
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-paper px-2 py-1 text-[11px] font-medium text-ink-soft">
              Filing to {session.draftFiledTo.name}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-[1.55] text-ink">
            Ring the {contentFor(session.draftFiledTo.id).distinctWord} florist
            about the arch.
          </p>
          <p className="mt-2 text-[12px] leading-[1.5] text-ink-faint">
            Filed the moment you started typing. Switching projects does not
            move it.
          </p>
        </div>
      ) : null}

      <div
        inert={held}
        aria-busy={held}
        className="ap-held space-y-4"
        data-held={held ? "true" : undefined}
      >
        <div>
          <h2 className="text-[clamp(1.25rem,1.05rem+0.8vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
            {row.name}
          </h2>
          <p className="mt-2 max-w-[56ch] text-[14px] leading-[1.6] text-ink-soft">
            {content.headline}
          </p>
        </div>

        {content.rootTaskTitles.length > 0 ? (
          <ul className="divide-y divide-[color:var(--hairline-soft)] overflow-hidden rounded-lg border border-hairline bg-paper">
            {content.rootTaskTitles.map((title) => (
              <li
                key={title}
                className="flex min-h-[52px] items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-pill border border-[color:var(--ink-ghost)]"
                />
                <span className="text-[14px] leading-[1.4] text-ink">{title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-ink-faint">
            Nothing open in this project yet.
          </p>
        )}

        <p className="text-[12px] text-ink-faint">
          {row.subtitle}
          {row.role !== "member" && !archived ? " · You own this project" : ""}
        </p>
      </div>

      {held ? (
        <p className="text-[12px] text-ink-faint">
          Held while {pending.target.name} opens. Nothing above has changed yet.
        </p>
      ) : null}
    </div>
  );
}
