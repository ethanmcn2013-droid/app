"use client";

/**
 * Variant A · the Studio Bar anchor.
 *
 * The Project lives in the chrome, in the open centre run of the permanent
 * Studio Bar, after product identity and before Search (plan §7.1). One place,
 * the same place, on every product, at every moment — including the moments
 * when the canvas underneath is a skeleton, an error or an empty state.
 *
 * The whole argument for A is constancy: you never look for it. The cost is
 * that a 56px bar is the most expensive real estate in the app, and a Project
 * name is longer than anything else that has ever been asked to live there.
 *
 * Phone: the control reflows out of the bar into a sticky 48px context strip
 * beneath it and opens a safe-area-aware modal bottom sheet.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FixtureScenarioId } from "@/lib/project-truth-fixture";
import { useLabSession, type LabSession } from "./machine";
import type { LabRow } from "./model";
import type { LabStateId } from "./states";
import { useChooser, type Chooser } from "./use-chooser";
import { useLayer } from "./use-layer";
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

/**
 * The route entry. `LabShell` takes a render function, which a Server
 * Component cannot hand to a Client Component, so the pairing lives here on
 * the client side and each page stays a thin server file that owns metadata.
 */
export function ActiveProjectLabA() {
  return (
    <LabShell
      variant="a"
      title="A · Studio Bar anchor"
      idea="One control in the permanent bar, in the same place on every product."
    >
      {(context) => <VariantA {...context} />}
    </LabShell>
  );
}

export function VariantA({
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

  const close = useCallback(() => setOpen(false), []);
  // The guard is not only about refusing a second selection — it must also
  // stop offering one. Opening a chooser whose rows are then silently
  // ignored is a dead control, so the trigger will not open while a switch
  // or a failed save is still waiting on the person.
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
      // The guard closes the chooser on the one accepted selection and
      // refuses everything after it until the switch settles (plan §3.5).
      if (session.select(row)) close();
    },
    onOpenArchived: (row) => {
      session.openArchived(row);
      close();
    },
  });

  const condition = surfaceCondition(session);
  const empty = condition.kind === "no-projects";

  // The layer lives with the surface, not with the panel, so `open` really
  // transitions true → false and focus can return to the trigger.
  const layerRef = useLayer<HTMLDivElement>({
    open: open && !empty,
    onClose: close,
    modal: phone,
    triggerRef,
  });

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      <LiveRegion message={session.announcement || chooser.countMessage} />

      {/* ── The permanent Studio Bar ─────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 shrink-0 border-b border-hairline bg-paper"
        style={{ paddingTop: phone ? "var(--ap-safe-top)" : undefined }}
      >
        <div className="mx-auto flex h-[56px] max-w-[1240px] items-center gap-3 px-3 sm:px-5">
          <Wordmark phone={phone} />

          {!phone ? (
            <>
              <span aria-hidden="true" className="h-5 w-px bg-[color:var(--hairline)]" />
              <div className="relative min-w-0">
                <ProjectTrigger
                  ref={triggerRef}
                  session={session}
                  open={open}
                  onToggle={toggle}
                  empty={empty}
                />
                {open && !empty ? (
                  <Popover chooser={chooser} session={session} layerRef={layerRef} />
                ) : null}
              </div>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {/* Presentational: Search exists here to prove where the Project
                control sits relative to it. It is not part of this study. */}
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

      {/* ── Phone: the 48px context strip ────────────────────────────── */}
      {phone ? (
        <div className="sticky top-[56px] z-30 shrink-0 border-b border-hairline bg-paper">
          <ProjectTrigger
            ref={triggerRef}
            session={session}
            open={open}
            onToggle={toggle}
            empty={empty}
            strip
          />
        </div>
      ) : null}

      {/* ── Product canvas ───────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-5 sm:py-8">
          <ProductCanvas session={session} />
        </div>
      </div>

      {phone && open && !empty ? (
        <Sheet chooser={chooser} session={session} onClose={close} layerRef={layerRef} />
      ) : null}
    </div>
  );
}

// ── Chrome pieces ───────────────────────────────────────────────────────────

function Wordmark({ phone }: { phone: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-accent" />
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
        {phone ? "Tasks" : "Signal Studio"}
      </span>
      {!phone ? (
        <span className="text-[14px] text-ink-faint">Tasks</span>
      ) : null}
    </div>
  );
}

type SessionProp = { session: LabSession };

function ProjectTrigger({
  ref,
  session,
  open,
  onToggle,
  empty,
  strip = false,
}: SessionProp & {
  ref: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onToggle: () => void;
  empty: boolean;
  strip?: boolean;
}) {
  const pending = session.status.kind === "pending" ? session.status : null;
  const queued = session.status.kind === "queued" ? session.status : null;

  // Plan §7.4: a fixed-width skeleton, and no remembered name on screen before
  // the catalog verifies one.
  if (session.resolving) {
    return (
      <div
        className={strip ? "flex min-h-[48px] items-center px-4" : "flex items-center"}
        aria-live="off"
      >
        <span className={SR_ONLY}>Loading your projects.</span>
        <Skeleton className="h-[28px] w-[168px] rounded-lg" />
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={
          strip
            ? "flex min-h-[48px] items-center px-4 text-[13px] text-ink-faint"
            : "flex min-h-[44px] items-center text-[13px] text-ink-faint"
        }
      >
        No project yet
      </div>
    );
  }

  // With nothing committed the trigger says what is true: pick one when there
  // are others, and nothing at all when there are none.
  const fallback = session.catalog.rows.length === 0 ? "No project yet" : "Choose a project";
  const name = pending
    ? `Opening ${pending.target.name}…`
    : queued
      ? `Opening ${queued.target.name}…`
      : (session.committed?.name ?? fallback);

  return (
    <div className={strip ? "relative" : "relative"}>
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={session.busy || undefined}
        className={[
          "ap-r group flex w-full items-center gap-2.5 text-left transition-colors",
          strip
            ? "[--ap-r:0px] min-h-[48px] px-4"
            : "[--ap-r:10px] min-h-[44px] max-w-[380px] rounded-lg px-2.5 hover:bg-paper-deep",
          session.busy ? "cursor-progress" : "",
        ].join(" ")}
        style={{ transitionDuration: "var(--motion-fast)" }}
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          Project
        </span>
        <span
          className={[
            "min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.01em]",
            pending || queued ? "text-ink-soft" : "text-ink",
          ].join(" ")}
          title={session.committed?.name}
        >
          {name}
        </span>
        {session.committed?.archived ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
            <LockIcon size={10} />
            Read-only
          </span>
        ) : null}
        <ChevronIcon
          size={14}
          className={[
            "shrink-0 text-ink-faint transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
        <span className={SR_ONLY}>Change project</span>
      </button>

      {/* Past 300ms, a line that finishes. Never a spinner. */}
      {pending?.slow ? (
        <span
          aria-hidden="true"
          className="ap-progress absolute inset-x-2.5 bottom-0 h-[2px] overflow-hidden rounded-pill bg-[color:var(--accent-soft)]"
        />
      ) : null}
    </div>
  );
}

// ── The anchored popover (desktop) ──────────────────────────────────────────

function Popover({
  chooser,
  session,
  layerRef,
}: SessionProp & {
  chooser: Chooser;
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={layerRef}
      role="dialog"
      aria-label="Choose a project"
      className="ap-pop absolute left-0 top-[calc(100%+8px)] z-50 flex w-[412px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-hairline bg-paper shadow-modal"
      style={
        {
          maxHeight: "min(60vh, 520px)",
          "--ap-origin": "top left",
        } as React.CSSProperties
      }
    >
      <ChooserHeader chooser={chooser} />
      <ChooserResults chooser={chooser} />
      <ChooserFooter chooser={chooser} session={session} />
    </div>
  );
}

// ── The modal bottom sheet (phone) ──────────────────────────────────────────

function Sheet({
  chooser,
  session,
  onClose,
  layerRef,
}: SessionProp & {
  chooser: Chooser;
  onClose: () => void;
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="absolute inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="ap-scrim absolute inset-0 bg-[color:var(--ink)]/35"
      />
      <div
        ref={layerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a project"
        className="ap-sheet absolute inset-x-0 bottom-0 flex max-h-[86%] flex-col overflow-hidden rounded-t-[20px] border-t border-hairline bg-paper shadow-modal"
        style={{ paddingBottom: "var(--ap-safe-bottom)" }}
      >
        <div className="shrink-0 pt-2.5">
          <span
            aria-hidden="true"
            className="mx-auto block h-1 w-9 rounded-pill bg-[color:var(--ink-ghost)]"
          />
        </div>
        <ChooserHeader chooser={chooser} sheet />
        <ChooserResults chooser={chooser} sheet />
        <ChooserFooter chooser={chooser} session={session} />
      </div>
    </div>
  );
}

// ── Chooser parts ───────────────────────────────────────────────────────────

function ChooserHeader({ chooser, sheet = false }: { chooser: Chooser; sheet?: boolean }) {
  // Focus lands where typing does: the input when there is one, the list when
  // there is not. A `useCallback` ref runs on attach only, so this cannot
  // re-steal focus on every render.
  const setInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  if (chooser.mode === "listbox") {
    return (
      <div
        className={[
          "shrink-0 border-b border-hairline-soft px-4 pb-3",
          sheet ? "pt-3" : "pt-3.5",
        ].join(" ")}
      >
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Your projects
        </h2>
      </div>
    );
  }

  return (
    <div
      className={[
        "shrink-0 border-b border-hairline-soft px-3",
        sheet ? "py-3" : "py-2.5",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-paper-soft px-3 focus-within:border-[color:var(--accent)]">
        <SearchIcon size={15} className="shrink-0 text-ink-faint" />
        <input
          ref={setInput}
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
    </div>
  );
}

function ChooserResults({ chooser, sheet = false }: { chooser: Chooser; sheet?: boolean }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxMode = chooser.mode === "listbox";

  // With no input there is nothing else for focus to land on, so the listbox
  // takes it — once, on mount, not on every render.
  useEffect(() => {
    if (listboxMode) listRef.current?.focus();
  }, [listboxMode]);

  const listbox = (
    <div
      ref={listRef}
      id={chooser.listboxId}
      role="listbox"
      aria-label="Projects"
      tabIndex={listboxMode ? 0 : -1}
      aria-activedescendant={
        listboxMode && chooser.activeRow ? chooser.optionId(chooser.activeRow.id) : undefined
      }
      onKeyDown={listboxMode ? chooser.onKeyDown : undefined}
      className="ap-r [--ap-r:8px]"
    >
      {chooser.groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
          No projects match that.
        </p>
      ) : null}

      {chooser.groups.map((group) => {
        if (group.kind === "archived" && !chooser.archivedOpen) return null;
        return (
          <div key={group.id} role="group" aria-labelledby={group.headingId}>
            {chooser.groups.length > 1 ? (
              <div
                id={group.headingId}
                className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
              >
                {group.label}
              </div>
            ) : (
              <span id={group.headingId} className={SR_ONLY}>
                {group.label}
              </span>
            )}
            {group.rows.map((row) => (
              <Row key={row.id} row={row} chooser={chooser} sheet={sheet} />
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
      {listbox}
      {chooser.hasArchived ? (
        <div className="px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={chooser.toggleArchived}
            aria-expanded={chooser.archivedOpen}
            className="ap-r [--ap-r:8px] flex min-h-[44px] w-full items-center gap-2 rounded-lg px-1.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-deep"
          >
            <ChevronIcon
              size={13}
              className={chooser.archivedOpen ? "text-ink-faint" : "-rotate-90 text-ink-faint"}
            />
            {chooser.archivedOpen ? "Hide archived" : `Archived · ${chooser.archivedCount}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  row,
  chooser,
  sheet,
}: {
  row: LabRow;
  chooser: Chooser;
  sheet: boolean;
}) {
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
        "relative flex cursor-pointer items-start gap-3 py-2 pl-4 pr-3",
        sheet ? "min-h-[52px]" : "min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]",
        active ? "bg-[color:var(--accent-tint)]" : "",
      ].join(" ")}
    >
      {/* Current is carried by a rail, a check and a word — never by colour
          on its own (plan §7.3). */}
      <span
        aria-hidden="true"
        className={[
          "absolute inset-y-1 left-0 w-[2px] rounded-pill",
          current ? "bg-accent" : "bg-transparent",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={[
              "line-clamp-2 text-[14px] leading-[1.35] tracking-[-0.01em]",
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
        <CheckIcon size={15} className="mt-0.5 shrink-0 text-accent" />
      ) : row.archived ? (
        <LockIcon size={14} className="mt-0.5 shrink-0 text-ink-faint" />
      ) : null}
    </div>
  );
}

function ChooserFooter({ chooser, session }: SessionProp & { chooser: Chooser }) {
  const canCreate = !session.writesDisabled;
  return (
    <div className="shrink-0 border-t border-hairline-soft bg-paper-soft px-4 py-3">
      <p className="text-[12px] leading-[1.45] text-ink-soft">{FOOTER_LINE}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canCreate}
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
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          {chooser.mode === "combobox" ? "Type to find" : "Type to jump"}
        </span>
      </div>
    </div>
  );
}
