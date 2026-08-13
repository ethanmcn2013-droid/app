"use client";

/**
 * Variant W · the deck. The wildcard — the register goes out the window.
 *
 * ── The observation it is built on ──────────────────────────────────────────
 *
 * Five of the fourteen Projects in the truth fixture end in the word
 * "weddings": Harbour House, Saltmarsh Barn, Riverside Rooms, Glenveagh Lodge,
 * Cliff Walk Hotel. A/B/C all ask you to READ your way to the right one, every
 * time, in a list where the last word is always the same. That is the actual
 * job, and a menu is a mediocre tool for it.
 *
 * So W spends everything on recognition instead. Each Project owns a colour
 * from a designed palette and a two-letter monogram. The colour lives on a
 * permanent spine down the edge of the app, so "which project am I in" is
 * answered before you read a word — and being in the wrong one FEELS wrong.
 * Choosing is not a menu: the deck slides out and the Projects are cards, big
 * enough to recognise at a glance and to hit with a thumb.
 *
 * ── Rules it deliberately breaks ────────────────────────────────────────────
 *
 *  1. The indigo anchor. Indigo becomes one of twelve peers, handed to whichever
 *     Project happens to sit in that slot. The suite colour stops being the
 *     constant and the Project's colour takes over.
 *  2. The light register. The deck and the spine are near-black.
 *  3. Motion limits (§7.5: 140ms in, 100ms out, no slide, ≤220ms crossfade).
 *     The deck slides, over ~420ms, on a spring-shaped curve, with a stagger.
 *  4. The selector anatomy (§7.3: anchored popover / bottom sheet). The deck
 *     is neither — it is a full-height panel, and on phone it lives at the
 *     BOTTOM of the screen, in the thumb, not in a top bar.
 *  5. Row anatomy. Rows are 92px cards with a colour tile, a monogram and the
 *     open-task count set as a large numeral, not 48px name-then-subtitle.
 *  6. Typography. Display sizes and tight tracking inside a control.
 *
 * ── The floor it does NOT break ─────────────────────────────────────────────
 *
 * Real fixture, real catalog, real guarded transition, every §7.4 state. The
 * combobox threshold still counts Projects. Copy stays in voice. Colour is
 * never the only signal: the check, the rail, the word "Current" and the
 * monogram all carry it too. Keyboard is complete, focus returns, targets are
 * 44px or more, and reduced motion removes every transform.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FixtureScenarioId } from "@/lib/project-truth-fixture";
import { useLabSession, type LabSession } from "./machine";
import { contentFor, type LabRow } from "./model";
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

// ── Colour, generated from identity ─────────────────────────────────────────

/**
 * A DESIGNED palette, assigned deterministically — not a hash mapped straight
 * onto the colour wheel.
 *
 * The first build did hash the id into `hsl(h 52% 30%)`. Every value cleared
 * 4.5:1 for white text, and it still looked wrong: the reference Project drew
 * hue 57 and the whole spine went olive. Contrast is a floor, not a palette.
 * So the twelve below are chosen — deep, editorial, distinguishable from each
 * other at a glance.
 *
 * Indigo is in the set exactly once, as a peer. That is the rule W is here to
 * break: the suite colour stops being the anchor and becomes one option in
 * twelve.
 *
 * Colour is additive throughout. The monogram, the name, the rail, the check
 * and the word "Current" all carry the same information without it.
 */
const DECK_PALETTE: readonly { deep: string; light: string }[] = Object.freeze([
  { deep: "#3730a3", light: "#a5b4fc" }, // indigo, a peer and nothing more
  { deep: "#115e59", light: "#5eead4" }, // teal
  { deep: "#6b21a8", light: "#d8b4fe" }, // plum
  { deep: "#9a3412", light: "#fdba74" }, // clay
  { deep: "#3f6212", light: "#bef264" }, // moss
  { deep: "#334155", light: "#cbd5e1" }, // slate
  { deep: "#9f1239", light: "#fda4af" }, // wine
  { deep: "#075985", light: "#7dd3fc" }, // ocean
  { deep: "#854d0e", light: "#fcd34d" }, // bronze
  { deep: "#5b21b6", light: "#c4b5fd" }, // violet
  { deep: "#14532d", light: "#86efac" }, // pine
  { deep: "#1e3a8a", light: "#93c5fd" }, // navy
]);

/**
 * Assignment is by the catalog's own stable position, NOT by hashing the id.
 *
 * Hashing was the obvious answer and it is the wrong one. Thirteen Projects
 * hashed into twelve slots collide the way birthdays collide: measured, it
 * produced eight distinct colours for thirteen Projects, with five sharing.
 * A recognition-first design cannot afford that — the whole claim is that you
 * know the Project before you read it.
 *
 * Catalog order is already deterministic (period start, then position, then
 * name, then id), so the first twelve Projects are guaranteed twelve different
 * colours. The cost is real and worth stating: adding or reordering a Project
 * earlier in the list shifts the colours after it. Recognition beats
 * permanence here, but a production version would want to store the chosen
 * colour on the Project rather than derive it.
 */
type DeckColours = { deep: (id: string) => string; light: (id: string) => string };

function makeDeckColours(orderedIds: readonly string[]): DeckColours {
  const slot = new Map(orderedIds.map((id, index) => [id, index % DECK_PALETTE.length]));
  const at = (id: string) => DECK_PALETTE[slot.get(id) ?? 0];
  return { deep: (id) => at(id).deep, light: (id) => at(id).light };
}

const DECK_INK = "#0b0b0e";

// ── Entry ───────────────────────────────────────────────────────────────────

export function ActiveProjectLabW() {
  return (
    <LabShell
      variant="w"
      title="W · The deck"
      idea="Every project owns a colour and a monogram. You recognise where you are before you read it."
    >
      {(context) => <VariantW {...context} />}
    </LabShell>
  );
}

export function VariantW({
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

  const row = session.committed;
  const colours = useMemo(
    () => makeDeckColours(session.catalog.rows.map((entry) => entry.id)),
    [session.catalog],
  );
  const hue = row ? colours.deep(row.id) : "var(--ink)";

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <WildcardStyles />
      <LiveRegion message={session.announcement || chooser.countMessage} />

      {/* ── The spine · desktop ─────────────────────────────────────── */}
      {!phone ? (
        <Spine
          ref={triggerRef}
          colours={colours}
          session={session}
          empty={empty}
          open={open}
          colour={hue}
          onOpen={() => { if (!session.busy) setOpen(true); }}
        />
      ) : null}

      <div className={phone ? "flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-1 flex-col pl-[68px]"}>
        <header
          className="shrink-0 border-b border-hairline bg-paper"
          style={{ paddingTop: phone ? "var(--ap-safe-top)" : undefined }}
        >
          <div className="flex h-[56px] items-center gap-3 px-4 sm:px-6">
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              Tasks
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div
                aria-hidden="true"
                className="hidden h-[36px] w-[160px] items-center gap-2 rounded-lg border border-hairline bg-paper-soft px-3 text-[13px] text-ink-faint md:flex"
              >
                <SearchIcon size={14} />
                Search
              </div>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-pill bg-paper-deep text-[11px] font-semibold text-ink-soft"
              >
                O
              </span>
            </div>
          </div>
        </header>

        {/* The canvas carries the Project's colour too, so the identity is
            not confined to a control you have to go and look at. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!empty && row && !session.resolving ? (
            <div
              className="flex items-center gap-4 border-b border-hairline px-4 py-5 sm:px-6"
              style={{
                background: `linear-gradient(180deg, ${colours.deep(row.id)}14, transparent)`,
              }}
            >
              <Monogram row={row} size={48} colours={colours} />
              <div className="min-w-0">
                <h1 className="truncate text-[clamp(1.25rem,1rem+1.2vw,1.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
                  {row.name}
                </h1>
                <p className="mt-1 text-[12px] text-ink-faint">{row.subtitle}</p>
              </div>
            </div>
          ) : null}

          <div className="px-4 py-6 sm:px-6">
            <ProductCanvas session={session} />
          </div>
        </div>
      </div>

      {/* ── The spine · phone, at the bottom where the thumb is ─────── */}
      {phone ? (
        <Spine
          ref={triggerRef}
          colours={colours}
          session={session}
          empty={empty}
          open={open}
          colour={hue}
          phone
          onOpen={() => { if (!session.busy) setOpen(true); }}
        />
      ) : null}

      {open && !empty ? (
        <Deck
          chooser={chooser}
          colours={colours}
          session={session}
          layerRef={layerRef}
          onClose={close}
          phone={phone}
        />
      ) : null}
    </div>
  );
}

// ── The spine ───────────────────────────────────────────────────────────────

function Spine({
  ref,
  session,
  empty,
  open,
  colour,
  colours,
  phone = false,
  onOpen,
}: {
  ref: React.RefObject<HTMLButtonElement | null>;
  session: LabSession;
  empty: boolean;
  open: boolean;
  colour: string;
  colours: DeckColours;
  phone?: boolean;
  onOpen: () => void;
}) {
  const pending = session.status.kind === "pending" ? session.status : null;
  const queued = session.status.kind === "queued" ? session.status : null;
  const row = session.committed;
  const opening = pending ?? queued;

  if (session.resolving) {
    return phone ? (
      <div
        className="shrink-0 border-t border-hairline bg-paper-deep px-4 py-3"
        style={{ paddingBottom: "calc(var(--ap-safe-bottom) + 12px)" }}
      >
        <span className={SR_ONLY}>Loading your projects.</span>
        <Skeleton className="h-[28px] w-[160px] rounded-lg" />
      </div>
    ) : (
      <div className="absolute inset-y-0 left-0 z-30 w-[68px] bg-paper-deep">
        <span className={SR_ONLY}>Loading your projects.</span>
      </div>
    );
  }

  const label = empty
    ? "No project yet"
    : opening
      ? `Opening ${opening.target.name}…`
      : (row?.name ?? "");

  if (phone) {
    return (
      <div
        className="relative z-30 shrink-0 border-t border-hairline"
        style={{
          background: DECK_INK,
          paddingBottom: "var(--ap-safe-bottom)",
        }}
      >
        <button
          ref={ref}
          type="button"
          disabled={empty}
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-busy={session.busy || undefined}
          className="ap-r [--ap-r:0px] flex min-h-[56px] w-full items-center gap-3 px-4 text-left disabled:opacity-50"
        >
          {row ? <Monogram row={row} size={36} colours={colours} /> : null}
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
              Project
            </span>
            <span className="block truncate text-[14px] font-medium text-white">
              {label}
            </span>
          </span>
          {row?.archived ? <LockIcon size={13} className="shrink-0 text-white/55" /> : null}
          <ChevronIcon size={15} className="shrink-0 -rotate-180 text-white/55" />
          <span className={SR_ONLY}>Change project</span>
        </button>
        {pending?.slow ? (
          <span
            aria-hidden="true"
            className="ap-progress absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-white/15"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-y-0 left-0 z-30 w-[68px] border-r border-black/10"
      style={{ background: empty ? "var(--paper-deep)" : colour }}
    >
      <button
        ref={ref}
        type="button"
        disabled={empty}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={session.busy || undefined}
        className="ap-r [--ap-r:0px] flex h-full w-full flex-col items-center justify-between py-5 disabled:opacity-50"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
          {empty ? "" : "Pro"}
        </span>

        {/* The name, set down the spine. Reading it is the fallback; the
            colour and the monogram are the point. */}
        <span className="flex min-h-0 flex-1 items-center justify-center py-4">
          <span
            className="ap-spine-name truncate text-[13px] font-medium tracking-[0.02em] text-white/90"
            style={{ opacity: opening ? 0.5 : 1 }}
          >
            {label}
          </span>
        </span>

        <span className="flex flex-col items-center gap-2.5">
          {row?.archived ? <LockIcon size={14} className="text-white/70" /> : null}
          {row ? <Monogram row={row} size={40} colours={colours} onDark /> : null}
          <ChevronIcon size={15} className="-rotate-90 text-white/70" />
        </span>
        <span className={SR_ONLY}>
          {empty ? "No project yet" : `Project: ${label}. Change project`}
        </span>
      </button>
      {pending?.slow ? (
        <span
          aria-hidden="true"
          className="ap-progress absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-black/20"
        />
      ) : null}
    </div>
  );
}

function Monogram({
  row,
  size,
  colours,
  onDark = false,
}: {
  row: LabRow;
  size: number;
  colours: DeckColours;
  onDark?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-[-0.02em] text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: onDark ? "rgba(0,0,0,0.28)" : colours.deep(row.id),
        border: onDark ? "1px solid rgba(255,255,255,0.28)" : "none",
      }}
    >
      {row.monogram}
    </span>
  );
}

// ── The deck ────────────────────────────────────────────────────────────────

function Deck({
  chooser,
  session,
  colours,
  layerRef,
  onClose,
  phone,
}: {
  chooser: Chooser;
  session: LabSession;
  colours: DeckColours;
  layerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  phone: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chooser.mode === "combobox") inputRef.current?.focus();
    else listRef.current?.focus();
  }, [chooser.mode]);

  return (
    <div className="absolute inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="ap-scrim absolute inset-0 bg-black/55"
      />
      <div
        ref={layerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a project"
        className={[
          "absolute flex flex-col overflow-hidden text-white",
          phone
            ? "ap-deck-up inset-x-0 bottom-0 top-[8%] rounded-t-[24px]"
            : "ap-deck-in inset-y-0 left-0 w-[min(440px,86%)]",
        ].join(" ")}
        style={{
          background: DECK_INK,
          paddingBottom: phone ? "var(--ap-safe-bottom)" : undefined,
        }}
      >
        <div className="shrink-0 px-5 pb-3 pt-5">
          {phone ? (
            <span
              aria-hidden="true"
              className="mx-auto mb-4 block h-1 w-9 rounded-pill bg-white/25"
            />
          ) : null}
          <h2 className="text-[26px] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
            Your projects
          </h2>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-white/50">
            {chooser.rows.length === 1
              ? "1 project"
              : `${chooser.rows.length} projects`}
          </p>

          {chooser.mode === "combobox" ? (
            <div className="ap-r [--ap-r:12px] mt-4 flex items-center gap-2.5 rounded-[12px] border border-white/15 bg-white/[0.06] px-3 focus-within:border-white/40">
              <SearchIcon size={16} className="shrink-0 text-white/45" />
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
                className="min-h-[48px] w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
              />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
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
            className="ap-r [--ap-r:12px]"
          >
            {chooser.groups.length === 0 ? (
              <p className="px-2 py-10 text-center text-[13px] text-white/45">
                No projects match that.
              </p>
            ) : null}

            {chooser.groups.map((group, groupIndex) => {
              if (group.kind === "archived" && !chooser.archivedOpen) return null;
              return (
                <div key={group.id} role="group" aria-labelledby={group.headingId}>
                  <div
                    id={group.headingId}
                    className="px-2 pb-1.5 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35"
                  >
                    {group.label}
                  </div>
                  {group.rows.map((row, rowIndex) => (
                    <Card
                      key={row.id}
                      row={row}
                      chooser={chooser}
                      colours={colours}
                      delayIndex={groupIndex * 2 + rowIndex}
                    />
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
              className="ap-r [--ap-r:10px] mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] text-white/55 transition-colors hover:bg-white/5"
            >
              <ChevronIcon size={13} className={chooser.archivedOpen ? "" : "-rotate-90"} />
              {chooser.archivedOpen ? "Hide archived" : `Archived · ${chooser.archivedCount}`}
            </button>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3.5">
          <p className="text-[12px] leading-[1.45] text-white/55">{FOOTER_LINE}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={session.writesDisabled}
              className="ap-r [--ap-r:10px] inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-white/20 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              <PlusIcon size={14} />
              New project
            </button>
            <button
              type="button"
              className="ap-r [--ap-r:10px] inline-flex min-h-[44px] items-center rounded-[10px] px-3 text-[13px] font-medium text-white/65 transition-colors hover:bg-white/10"
            >
              Manage projects
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ap-r [--ap-r:10px] ml-auto inline-flex min-h-[44px] items-center rounded-[10px] px-3 text-[13px] font-medium text-white/65 transition-colors hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  row,
  chooser,
  colours,
  delayIndex,
}: {
  row: LabRow;
  chooser: Chooser;
  colours: DeckColours;
  delayIndex: number;
}) {
  const current = chooser.isCommitted(row);
  const active = chooser.activeRow?.id === row.id;
  const glow = colours.light(row.id);

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
      className="ap-deck-card relative flex min-h-[92px] cursor-pointer items-center gap-3.5 overflow-hidden rounded-[14px] px-3 py-3"
      style={{
        // Deliberately past the register's limits: a stagger, and travel.
        animationDelay: `${Math.min(delayIndex, 8) * 26}ms`,
        background: active ? "rgba(255,255,255,0.09)" : "transparent",
        boxShadow: current ? `inset 3px 0 0 0 ${glow}` : "none",
      }}
    >
      <Monogram row={row} size={52} colours={colours} />

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={[
              "line-clamp-2 text-[16px] leading-[1.25] tracking-[-0.02em]",
              current ? "font-semibold text-white" : "font-medium text-white/90",
            ].join(" ")}
          >
            {row.name}
          </span>
          {current ? (
            <span
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em]"
              style={{ color: glow }}
            >
              Current
            </span>
          ) : null}
        </span>
        <span className="mt-1 block truncate text-[12px] leading-[1.4] text-white/45">
          {row.subtitle}
        </span>
        <span className="mt-1 block truncate text-[11px] leading-[1.4] text-white/30">
          {contentFor(row.id).distinctWord}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5 pr-1">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.04em] text-white/85 tabular-nums">
          {row.activeRootTaskCount}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
          open
        </span>
        {current ? <CheckIcon size={15} style={{ color: glow }} /> : null}
        {row.archived ? <LockIcon size={14} className="text-white/40" /> : null}
      </span>
    </div>
  );
}

// ── W's own motion, kept where the rule-breaking is visible ─────────────────

function WildcardStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.ap-deck-in { animation: ap-deck-in 420ms cubic-bezier(.16,1,.3,1) both; }
@keyframes ap-deck-in {
  from { transform: translateX(-101%); }
  to { transform: translateX(0); }
}
.ap-deck-up { animation: ap-deck-up 420ms cubic-bezier(.16,1,.3,1) both; }
@keyframes ap-deck-up {
  from { transform: translateY(101%); }
  to { transform: translateY(0); }
}
.ap-deck-card {
  animation: ap-card-in 380ms cubic-bezier(.16,1,.3,1) both;
  transition: background-color 160ms var(--ease-out);
}
@keyframes ap-card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
.ap-spine-name {
  writing-mode: vertical-rl;
  max-height: 100%;
}

/* The floor holds: every transform goes, nothing is left mid-travel. */
@media (prefers-reduced-motion: reduce) {
  .ap-deck-in, .ap-deck-up, .ap-deck-card { animation: ap-fade-in 1ms linear both; }
}
[data-ap-motion="reduced"] .ap-deck-in,
[data-ap-motion="reduced"] .ap-deck-up,
[data-ap-motion="reduced"] .ap-deck-card { animation: ap-fade-in 1ms linear both; }
`,
      }}
    />
  );
}
