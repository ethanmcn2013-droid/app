"use client";

/**
 * Variant B · the product canvas band. **The one taken further than felt safe.**
 *
 * The premise is an information-architecture argument, not a styling one: the
 * Project is not chrome. It is the subject of the page. So the chrome carries
 * no Project control at all, and every product canvas opens with a masthead
 * that states the Project at display size — the way a document states its own
 * title rather than delegating that to the window frame.
 *
 * Where A opens a menu, B opens a ROOM. The masthead expands in place, the
 * canvas beneath goes quiet and inert, and choosing a Project is briefly the
 * only thing on screen. That is the deliberate overreach (register amendment
 * A1: reach further than feels safe in exploration). It buys recognition and
 * a sense of place; it spends vertical room on every page and turns a frequent
 * action into a large gesture. Both halves of that trade are real, and the
 * lab exists to find out which one Ethan wants to live with.
 *
 * Everything locked by the plan is unchanged: same catalog, same guarded
 * transition, same listbox/combobox threshold, same announcements.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FixtureScenarioId } from "@/lib/project-truth-fixture";
import { useLabSession, type LabSession } from "./machine";
import type { LabRow } from "./model";
import type { LabStateId } from "./states";
import { useChooser, type Chooser } from "./use-chooser";
import {
  CheckIcon,
  ChevronIcon,
  FOOTER_LINE,
  LiveRegion,
  LockIcon,
  PlusIcon,
  ProductCanvas,
  SR_ONLY,
  SearchIcon,
  Skeleton,
  surfaceCondition,
} from "./ui";
import { LabShell, type LabDevice } from "./lab-shell";

export function ActiveProjectLabB() {
  return (
    <LabShell
      variant="b"
      title="B · Product canvas band"
      idea="The project belongs to the content, not the frame. Choosing one opens a room."
    >
      {(context) => <VariantB {...context} />}
    </LabShell>
  );
}

export function VariantB({
  stateId,
  scenario,
  device,
}: {
  stateId: LabStateId;
  scenario: FixtureScenarioId;
  device: LabDevice;
}) {
  const session = useLabSession(stateId, scenario);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const phone = device === "phone";

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Refusing a second selection is not enough; the room must stop offering one
  // while a switch is still settling.
  const toggle = useCallback(() => {
    if (session.busy) return;
    setOpen((value) => !value);
  }, [session.busy]);

  const chooser = useChooser({
    catalog: session.catalog,
    committedId: session.committed?.id ?? null,
    open,
    onDismiss: close,
    onChoose: (row) => {
      if (session.select(row)) close();
    },
    onOpenArchived: (row) => {
      session.openArchived(row);
      close();
    },
  });

  const condition = surfaceCondition(session);
  const empty = condition.kind === "no-projects";
  const roomId = "ap-b-room";

  return (
    <div className="flex h-full flex-col bg-paper">
      <LiveRegion message={session.announcement || chooser.countMessage} />

      {/* Chrome with no Project in it. That absence is B's whole argument. */}
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-hairline bg-paper/90 backdrop-blur"
        style={{ paddingTop: phone ? "var(--ap-safe-top)" : undefined }}
      >
        <div className="mx-auto flex h-[56px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {phone ? "Tasks" : "Signal Studio"}
          </span>
          {!phone ? <span className="text-[14px] text-ink-faint">Tasks</span> : null}
          <div className="ml-auto flex items-center gap-2">
            <div
              aria-hidden="true"
              className="hidden h-[36px] w-[180px] items-center gap-2 rounded-lg border border-hairline bg-paper-soft px-3 text-[13px] text-ink-faint md:flex"
            >
              <SearchIcon size={14} />
              Search
            </div>
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-pill bg-[color:var(--accent-tint)] text-[11px] font-semibold text-accent"
            >
              O
            </span>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Band
          session={session}
          chooser={chooser}
          open={open}
          empty={empty}
          phone={phone}
          roomId={roomId}
          triggerRef={triggerRef}
          onToggle={toggle}
          onClose={close}
        />

        {/* While the room is open the page beneath is quiet and untouchable.
            It is still the committed Project's page — never relabelled. */}
        <div
          inert={open}
          className="ap-band mx-auto max-w-[1240px] px-4 py-7 sm:px-6"
          style={{
            opacity: open ? 0.28 : 1,
            transition: "opacity var(--motion-base) var(--ease-out)",
          }}
        >
          <ProductCanvas session={session} />
        </div>
      </div>
    </div>
  );
}

// ── The band ────────────────────────────────────────────────────────────────

function Band({
  session,
  chooser,
  open,
  empty,
  phone,
  roomId,
  triggerRef,
  onToggle,
  onClose,
}: {
  session: LabSession;
  chooser: Chooser;
  open: boolean;
  empty: boolean;
  phone: boolean;
  roomId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pending = session.status.kind === "pending" ? session.status : null;
  const queued = session.status.kind === "queued" ? session.status : null;
  const row = session.committed;

  const eyebrow = session.resolving
    ? null
    : empty
      ? "No project yet"
      : row?.archived
        ? "Archived · read-only"
        : row?.role === "member"
          ? "Shared with you"
          : row?.role === "owner"
            ? "Shared with you · you are a co-owner"
            : (row?.summary.planningPeriod?.name ?? "Not in a season");

  return (
    <section
      aria-label="Project"
      className="relative overflow-hidden border-b border-hairline bg-gradient-to-b from-[color:var(--accent-tint)] to-paper"
    >
      {/* A single quiet light behind the name. Not a texture, not a pattern. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-40 h-[280px] w-[380px] rounded-pill opacity-70 blur-3xl"
        style={{ background: "var(--accent-soft)" }}
      />

      <div className="relative mx-auto max-w-[1240px] px-4 pb-6 pt-7 sm:px-6 sm:pb-7 sm:pt-9">
        {session.resolving ? (
          <div aria-busy="true" className="space-y-3">
            <span className={SR_ONLY}>Loading your projects.</span>
            <Skeleton className="h-3.5 w-[140px] rounded-md" />
            <Skeleton className="h-[38px] w-[min(460px,80%)] rounded-lg" />
            <Skeleton className="h-3.5 w-[180px] rounded-md" />
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  {row?.archived ? <LockIcon size={12} /> : null}
                  {eyebrow}
                </p>
              ) : null}
              <h1
                className="mt-2.5 max-w-[20ch] text-[clamp(1.75rem,1.15rem+2.2vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-ink"
                style={{
                  opacity: pending || queued ? 0.5 : 1,
                  transition: "opacity var(--motion-base) var(--ease-out)",
                }}
              >
                {empty ? "No project yet" : (row?.name ?? "")}
              </h1>
              <p className="mt-3 text-[13px] leading-[1.5] text-ink-soft">
                {empty
                  ? "Make one and everything below fills in."
                  : pending
                    ? `Opening ${pending.target.name}…`
                    : queued
                      ? `Opening ${queued.target.name}…`
                      : row?.subtitle}
              </p>
            </div>

            {!empty ? (
              <div className="relative shrink-0">
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={onToggle}
                  aria-expanded={open}
                  aria-controls={roomId}
                  aria-busy={session.busy || undefined}
                  className="ap-r [--ap-r:999px] inline-flex min-h-[44px] items-center gap-2.5 rounded-pill border border-hairline bg-paper px-4 text-left shadow-float transition-colors hover:bg-paper-soft"
                  style={{ transitionDuration: "var(--motion-fast)" }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    Project
                  </span>
                  <span className="text-[13px] font-medium text-ink">
                    {open ? "Close" : "Switch"}
                  </span>
                  <ChevronIcon
                    size={14}
                    className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {pending?.slow ? (
                  <span
                    aria-hidden="true"
                    className="ap-progress absolute inset-x-4 -bottom-1.5 h-[2px] overflow-hidden rounded-pill bg-[color:var(--accent-soft)]"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {open && !empty ? (
        <Room
          id={roomId}
          chooser={chooser}
          session={session}
          phone={phone}
          onClose={onClose}
        />
      ) : null}
    </section>
  );
}

// ── The room ────────────────────────────────────────────────────────────────

/**
 * Not a dialog. An inline disclosure that happens to be large — so there is no
 * focus trap, no scrim, and the page it belongs to is never hidden from a
 * screen reader. The size is the composition, not a modality claim.
 */
function Room({
  id,
  chooser,
  session,
  phone,
  onClose,
}: {
  id: string;
  chooser: Chooser;
  session: LabSession;
  phone: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chooser.mode === "combobox") inputRef.current?.focus();
    else listRef.current?.focus();
  }, [chooser.mode]);

  const jumpTo = (groupId: string) => {
    const first = chooser.groups.find((group) => group.id === groupId)?.rows[0];
    if (!first) return;
    const index = chooser.rows.findIndex((entry) => entry.id === first.id);
    if (index >= 0) chooser.setActiveIndex(index);
  };

  const showRail = !phone && chooser.groups.length > 2;

  return (
    <div
      id={id}
      className="ap-band relative border-t border-hairline bg-paper/85 backdrop-blur"
      style={{ animation: "ap-sheet-in var(--motion-base) var(--ease-out) both" }}
    >
      <div className="mx-auto max-w-[1240px] px-4 pb-5 pt-4 sm:px-6">
        {chooser.mode === "combobox" ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-hairline bg-paper px-3 focus-within:border-[color:var(--accent)]">
            <SearchIcon size={15} className="shrink-0 text-ink-faint" />
            <input
              ref={inputRef}
              id={chooser.inputId}
              type="text"
              role="combobox"
              autoComplete="off"
              spellCheck={false}
              aria-expanded="true"
              aria-controls={chooser.listboxId}
              aria-autocomplete="list"
              aria-label="Find a project"
              aria-activedescendant={
                chooser.activeRow ? chooser.optionId(chooser.activeRow.id) : undefined
              }
              value={chooser.query}
              onChange={(event) => chooser.setQuery(event.target.value)}
              onKeyDown={chooser.onKeyDown}
              placeholder="Find a project"
              className="min-h-[44px] w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
        ) : null}

        <div className="flex gap-6">
          {showRail ? (
            <nav
              aria-label="Jump to a group"
              className="w-[168px] shrink-0 border-r border-hairline-soft pr-4 pt-1"
            >
              {chooser.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => jumpTo(group.id)}
                  className="ap-r [--ap-r:6px] block w-full min-h-[36px] rounded-md px-2 py-1.5 text-left text-[12px] leading-[1.35] text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  {group.label}
                  <span className="ml-1.5 text-ink-faint">{group.rows.length}</span>
                </button>
              ))}
            </nav>
          ) : null}

          <div
            ref={scrollerRef}
            className="min-w-0 flex-1 overflow-y-auto overscroll-contain"
            style={{ maxHeight: phone ? "52vh" : "min(46vh, 420px)" }}
          >
            <div
              ref={listRef}
              id={chooser.listboxId}
              role="listbox"
              aria-label="Projects"
              tabIndex={chooser.mode === "listbox" ? 0 : -1}
              aria-activedescendant={
                chooser.mode === "listbox" && chooser.activeRow
                  ? chooser.optionId(chooser.activeRow.id)
                  : undefined
              }
              onKeyDown={chooser.mode === "listbox" ? chooser.onKeyDown : undefined}
              className="ap-r [--ap-r:8px]"
            >
              {chooser.groups.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-ink-faint">
                  No projects match that.
                </p>
              ) : null}

              {chooser.groups.map((group) => {
                if (group.kind === "archived" && !chooser.archivedOpen) return null;
                return (
                  <div
                    key={group.id}
                    role="group"
                    aria-labelledby={group.headingId}
                    className="pb-1"
                  >
                    <div
                      id={group.headingId}
                      className="pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                    >
                      {group.label}
                    </div>
                    {group.rows.map((row) => (
                      <RoomRow key={row.id} row={row} chooser={chooser} />
                    ))}
                  </div>
                );
              })}
            </div>

            {chooser.hasArchived ? (
              <button
                type="button"
                onClick={chooser.toggleArchived}
                aria-expanded={chooser.archivedOpen}
                className="ap-r [--ap-r:8px] mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-deep"
              >
                <ChevronIcon
                  size={13}
                  className={chooser.archivedOpen ? "" : "-rotate-90"}
                />
                {chooser.archivedOpen
                  ? "Hide archived"
                  : `Archived · ${chooser.archivedCount}`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-soft pt-3">
          <p className="text-[12px] leading-[1.45] text-ink-soft">{FOOTER_LINE}</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={session.writesDisabled}
              className="ap-r [--ap-r:8px] inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-paper px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-paper-deep disabled:opacity-45"
            >
              <PlusIcon size={13} />
              New project
            </button>
            <button
              type="button"
              className="ap-r [--ap-r:8px] inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-paper-deep"
            >
              Manage projects
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ap-r [--ap-r:8px] inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-paper-deep"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomRow({ row, chooser }: { row: LabRow; chooser: Chooser }) {
  const current = chooser.isCommitted(row);
  const active = chooser.activeRow?.id === row.id;

  return (
    <div
      role="option"
      id={chooser.optionId(row.id)}
      aria-selected={current}
      ref={(node) => chooser.registerRow(row.id, node)}
      onClick={() => chooser.choose(row)}
      onPointerMove={() => {
        const index = chooser.rows.findIndex((entry) => entry.id === row.id);
        if (index >= 0 && index !== chooser.activeIndex) chooser.setActiveIndex(index);
      }}
      className={[
        "relative flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg py-2 pl-3 pr-3",
        active ? "bg-[color:var(--accent-tint)]" : "",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute inset-y-1.5 left-0 w-[2px] rounded-pill",
          current ? "bg-accent" : "bg-transparent",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={[
              "line-clamp-2 text-[15px] leading-[1.3] tracking-[-0.015em]",
              current ? "font-semibold text-ink" : "font-medium text-ink",
            ].join(" ")}
          >
            {row.name}
          </span>
          {current ? (
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
              Current
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-[1.4] text-ink-faint">
          {row.subtitle}
        </span>
      </span>
      {current ? (
        <CheckIcon size={16} className="shrink-0 text-accent" />
      ) : row.archived ? (
        <LockIcon size={14} className="shrink-0 text-ink-faint" />
      ) : null}
    </div>
  );
}
