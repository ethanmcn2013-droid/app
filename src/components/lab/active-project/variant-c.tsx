"use client";

/**
 * Variant C · the command-led hybrid.
 *
 * Two halves that do different jobs. A compact, quiet RECEIPT in the bar says
 * which Project you are in and never asks for attention. Cmd/Ctrl+K does the
 * switching, fast, from anywhere, without the hand leaving the keyboard — and
 * carries the destination actions the plan wants in the palette (§8.6):
 * switch to a Project, or open it directly in Timeline.
 *
 * C is deliberately the variant the plan argues against. §7.3 says "use a
 * labelled selection surface, not a command menu". Building it anyway is the
 * point of a lab: it measures what that refusal actually costs in speed, and
 * gives Ethan the option to overrule it with the evidence in front of him.
 *
 * Two rules it does NOT bend, because they are what a palette usually gets
 * wrong: results are never reordered by recent use (spatial memory is the
 * whole reason a frequent switcher is learnable), and the listbox/combobox
 * threshold is still by count, so a one-Project account gets no search field.
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
  ProductCanvas,
  SR_ONLY,
  SearchIcon,
  Skeleton,
  surfaceCondition,
} from "./ui";
import { LabShell, type LabDevice } from "./lab-shell";

export function ActiveProjectLabC() {
  return (
    <LabShell
      variant="c"
      title="C · Command-led hybrid"
      idea="A quiet receipt you never click, and Cmd/Ctrl+K for everything else."
    >
      {(context) => <VariantC {...context} />}
    </LabShell>
  );
}

export function VariantC({
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

  const condition = surfaceCondition(session);
  const empty = condition.kind === "no-projects";

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

  const layerRef = useLayer<HTMLDivElement>({
    open: open && !empty,
    onClose: close,
    modal: true,
    triggerRef,
  });

  // The shortcut is the product here, so it is bound at the surface and not
  // inside the palette — it has to work when nothing is focused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (empty) return;
      event.preventDefault();
      // The shortcut obeys the same guard as the receipt: a switch that is
      // still settling does not get a second instruction.
      if (session.busy) return;
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [empty, session.busy]);

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      <LiveRegion message={session.announcement || chooser.countMessage} />

      <header
        className="sticky top-0 z-40 shrink-0 border-b border-hairline bg-paper"
        style={{ paddingTop: phone ? "var(--ap-safe-top)" : undefined }}
      >
        <div className="mx-auto flex h-[56px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-pill bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {phone ? "Tasks" : "Signal Studio"}
          </span>
          {!phone ? <span className="text-[14px] text-ink-faint">Tasks</span> : null}

          <span aria-hidden="true" className="h-5 w-px bg-[color:var(--hairline)]" />

          <Receipt
            ref={triggerRef}
            session={session}
            empty={empty}
            open={open}
            phone={phone}
            onOpen={() => { if (!session.busy) setOpen(true); }}
          />

          <div className="ml-auto flex items-center gap-2">
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
        <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
          <ProductCanvas session={session} />
        </div>
      </div>

      {open && !empty ? (
        <Palette
          chooser={chooser}
          session={session}
          layerRef={layerRef}
          onClose={close}
          phone={phone}
        />
      ) : null}
    </div>
  );
}

// ── The receipt ─────────────────────────────────────────────────────────────

function Receipt({
  ref,
  session,
  empty,
  open,
  phone,
  onOpen,
}: {
  ref: React.RefObject<HTMLButtonElement | null>;
  session: LabSession;
  empty: boolean;
  open: boolean;
  phone: boolean;
  onOpen: () => void;
}) {
  const pending = session.status.kind === "pending" ? session.status : null;
  const queued = session.status.kind === "queued" ? session.status : null;

  if (session.resolving) {
    return (
      <div className="flex min-h-[44px] items-center">
        <span className={SR_ONLY}>Loading your projects.</span>
        <Skeleton className="h-[22px] w-[150px] rounded-md" />
      </div>
    );
  }

  if (empty) {
    return (
      <span className="flex min-h-[44px] items-center text-[13px] text-ink-faint">
        No project yet
      </span>
    );
  }

  const name = pending
    ? `Opening ${pending.target.name}…`
    : queued
      ? `Opening ${queued.target.name}…`
      : (session.committed?.name ?? "");

  return (
    <div className="relative min-w-0">
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={session.busy || undefined}
        className="ap-r [--ap-r:8px] group flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-paper-deep"
        style={{ transitionDuration: "var(--motion-fast)" }}
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          Project
        </span>
        <span
          className={[
            "min-w-0 truncate text-[14px] font-medium tracking-[-0.01em]",
            pending || queued ? "text-ink-soft" : "text-ink",
          ].join(" ")}
          title={session.committed?.name}
        >
          {name}
        </span>
        {session.committed?.archived ? (
          <LockIcon size={12} className="shrink-0 text-ink-faint" />
        ) : null}
        <ChevronIcon size={13} className="shrink-0 text-ink-faint" />
        {!phone ? (
          <kbd
            aria-hidden="true"
            className="ml-1 hidden shrink-0 rounded-md border border-hairline bg-paper-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-faint group-hover:border-[color:var(--accent)] group-hover:text-accent sm:block"
          >
            ⌘K
          </kbd>
        ) : null}
        <span className={SR_ONLY}>
          Change project. Keyboard shortcut, Command or Control plus K.
        </span>
      </button>
      {pending?.slow ? (
        <span
          aria-hidden="true"
          className="ap-progress absolute inset-x-2 bottom-0 h-[2px] overflow-hidden rounded-pill bg-[color:var(--accent-soft)]"
        />
      ) : null}
    </div>
  );
}

// ── The palette ─────────────────────────────────────────────────────────────

function Palette({
  chooser,
  session,
  layerRef,
  onClose,
  phone,
}: {
  chooser: Chooser;
  session: LabSession;
  layerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  phone: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [timelineNote, setTimelineNote] = useState<string>("");

  useEffect(() => {
    if (chooser.mode === "combobox") inputRef.current?.focus();
    else listRef.current?.focus();
  }, [chooser.mode]);

  // Cmd/Ctrl+Enter takes the row's second action instead of its first.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      const row = chooser.activeRow;
      if (!row) return;
      event.preventDefault();
      setTimelineNote(`Open ${row.name} in Timeline`);
      if (!row.archived && session.select(row)) onClose();
      return;
    }
    chooser.onKeyDown(event);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="ap-scrim absolute inset-0 bg-[color:var(--ink)]/40"
      />
      <div
        ref={layerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Switch project"
        className="ap-pop relative mx-4 flex w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-hairline bg-paper shadow-modal"
        style={
          {
            marginTop: phone ? "calc(var(--ap-safe-top) + 16px)" : "10vh",
            maxHeight: "min(60vh, 520px)",
            "--ap-origin": "top center",
          } as React.CSSProperties
        }
      >
        {chooser.mode === "combobox" ? (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-hairline-soft px-4">
            <SearchIcon size={16} className="shrink-0 text-ink-faint" />
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
              onKeyDown={onKeyDown}
              placeholder="Switch project"
              className="min-h-[52px] w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <kbd
              aria-hidden="true"
              className="shrink-0 rounded-md border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink-faint"
            >
              esc
            </kbd>
          </div>
        ) : (
          <div className="shrink-0 border-b border-hairline-soft px-4 py-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Switch project
            </h2>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
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
            onKeyDown={chooser.mode === "listbox" ? onKeyDown : undefined}
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
                  <div
                    id={group.headingId}
                    className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
                  >
                    {group.label}
                  </div>
                  {group.rows.map((row) => (
                    <PaletteRow key={row.id} row={row} chooser={chooser} />
                  ))}
                </div>
              );
            })}
          </div>

          {chooser.hasArchived ? (
            <div className="px-3 py-1">
              <button
                type="button"
                onClick={chooser.toggleArchived}
                aria-expanded={chooser.archivedOpen}
                className="ap-r [--ap-r:8px] flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-deep"
              >
                <ChevronIcon size={13} className={chooser.archivedOpen ? "" : "-rotate-90"} />
                {chooser.archivedOpen ? "Hide archived" : `Archived · ${chooser.archivedCount}`}
              </button>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-hairline-soft bg-paper-soft px-4 py-2.5">
          <p className="text-[12px] leading-[1.45] text-ink-soft">{FOOTER_LINE}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <span>↑↓ move</span>
            <span>↵ switch</span>
            <span>⌘↵ open in timeline</span>
            <span>esc close</span>
            {timelineNote ? (
              <span className="text-accent normal-case tracking-normal">{timelineNote}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaletteRow({ row, chooser }: { row: LabRow; chooser: Chooser }) {
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
        "relative flex min-h-[48px] cursor-pointer items-center gap-3 py-1.5 pl-4 pr-3",
        "[@media(pointer:coarse)]:min-h-[52px]",
        active ? "bg-[color:var(--accent-tint)]" : "",
      ].join(" ")}
    >
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
      {current ? <CheckIcon size={15} className="shrink-0 text-accent" /> : null}
      {active && !current ? (
        <span
          aria-hidden="true"
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
        >
          ↵
        </span>
      ) : null}
      {row.archived ? <LockIcon size={14} className="shrink-0 text-ink-faint" /> : null}
    </div>
  );
}
