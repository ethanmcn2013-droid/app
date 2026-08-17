"use client";

/**
 * The Active Project control — WP6 Lane A, variant A (D-025).
 *
 * The Project lives in the chrome, in the open centre run of the permanent
 * Studio Bar, after product identity and before Search. One place, the same
 * place, on every product, at every moment — including the moments when the
 * canvas underneath is a skeleton, an error or an empty state. The whole
 * argument for A is constancy: you never look for it.
 *
 * ── What this component is allowed to paint ────────────────────────────────
 *
 * Nothing it decides for itself. `useActiveProject().chrome` is the authority:
 * `verified` may be painted as a Project, `pending` is A's name held on screen
 * and marked inert while B verifies, and `skeleton` is a fixed-width placeholder
 * that never guesses a name. A remembered cookie value is not a Project name and
 * is never rendered as one — that substitution is what this whole programme
 * exists to remove.
 *
 * ── Flag off ───────────────────────────────────────────────────────────────
 *
 * `ActiveProjectProvider` is not mounted when the flag is off, so the hook
 * returns null and this renders nothing at all. The bar keeps its existing
 * centre run byte for byte. Pinned in `active-project-contract.test.mjs`.
 *
 * ── Where the pieces sit ───────────────────────────────────────────────────
 *
 * Desktop: an anchored, nonmodal popover — the page behind it stays live.
 * Phone: the control reflows out of the bar into a sticky context strip and
 * opens a modal, focus-trapped, safe-area-aware bottom sheet. Exactly one of
 * the two mounts, chosen by a media subscription rather than by CSS, so the
 * catalog is fetched once and the chooser holds one piece of state.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH,
  useActiveProject,
  type ActiveProjectContextValue,
  type SelectProjectRefusal,
} from "@/components/app/active-project-provider";
import {
  archivedProjectUrl,
  switchDestinationFor,
  type ChooserCatalog,
  type ChooserRow,
} from "@/lib/projects/project-chooser";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";
import { useChooser, type Chooser } from "./use-chooser";
import { useLayer } from "./use-layer";
import styles from "./active-project.module.css";

const PHONE_QUERY = "(max-width: 767px)";

const SR_ONLY =
  "absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]";

/** Slow-switch threshold: past this, the trigger grows a line that finishes. */
const SLOW_SWITCH_MS = 300;

// ── Media ───────────────────────────────────────────────────────────────────

function usePhone(): boolean {
  return useSyncExternalStore(
    useCallback((listener: () => void) => {
      const media = window.matchMedia(PHONE_QUERY);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }, []),
    () => window.matchMedia(PHONE_QUERY).matches,
    // Server and first client paint agree on desktop; the strip appears after
    // hydration on a phone rather than the bar control flashing and vanishing.
    () => false,
  );
}

// ── Catalog loading ─────────────────────────────────────────────────────────

type CatalogState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; catalog: ChooserCatalog }>
  | Readonly<{ kind: "error" }>;

const EMPTY_CATALOG: ChooserCatalog = Object.freeze({
  groups: [],
  rows: [],
  activeCount: 0,
  archivedCount: 0,
  mode: "listbox" as const,
  truncated: false,
});

/**
 * Fetches on first open and keeps the result for the life of the mount.
 *
 * Not refetched on every open: a catalog that changes shape under a person who
 * opened the menu twice in five seconds is worse than one that is a few seconds
 * stale, and every selection is reauthorized server-side regardless — a stale
 * row cannot become an unauthorized switch.
 */
function useProjectCatalog(open: boolean): CatalogState & { retry: () => void } {
  const [state, setState] = useState<CatalogState>({ kind: "idle" });
  const inFlight = useRef(false);

  const load = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const result = await loadProjectCatalogAction();
        setState(
          result.ok ? { kind: "ready", catalog: result.catalog } : { kind: "error" },
        );
      } catch {
        setState({ kind: "error" });
      } finally {
        inFlight.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    if (state.kind === "idle") load();
  }, [open, state.kind, load]);

  const retry = useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  return { ...state, retry } as CatalogState & { retry: () => void };
}

// ── The control ─────────────────────────────────────────────────────────────

export function ActiveProjectControl({ strip = false }: { strip?: boolean }) {
  const context = useActiveProject();
  // Flag off — the provider is not mounted and there is nothing to render.
  if (!context) return null;
  return <ActiveProjectControlInner context={context} strip={strip} />;
}

function ActiveProjectControlInner({
  context,
  strip,
}: {
  context: ActiveProjectContextValue;
  strip: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<ChooserRow | null>(null);
  const [, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const catalog = useProjectCatalog(open);
  const rows = catalog.kind === "ready" ? catalog.catalog : EMPTY_CATALOG;

  const close = useCallback(() => {
    setOpen(false);
    setBlocked(null);
  }, []);

  // The guard is not only about refusing a second selection — it must also stop
  // offering one. A chooser whose rows are silently ignored is a dead control,
  // so the trigger will not open while a switch is still in flight.
  const busy = context.pending !== null;
  const toggle = useCallback(() => {
    if (busy) return;
    setOpen((value) => !value);
  }, [busy]);

  const chooser = useChooser({
    catalog: rows,
    committedId: context.chrome.kind === "verified" ? context.chrome.project.id : null,
    open,
    onDismiss: close,
    onChoose: (row) => {
      const result = context.selectProject(
        { id: row.id, name: row.name },
        switchDestinationFor(pathname),
      );
      // Only a started switch closes the chooser. A refusal leaves it open so
      // the reason lands beside the rows it is about.
      if (result.kind === "started") close();
    },
    onOpenArchived: (row) => {
      close();
      startTransition(() => router.push(archivedProjectUrl(row.id)));
    },
    onBlocked: (row) => setBlocked(row),
  });

  const layerRef = useLayer<HTMLDivElement>({
    open,
    onClose: close,
    modal: strip,
    triggerRef,
  });

  // The unsaved-work refusal is shared state (WP6): the surface that tripped it
  // is not the one that renders it. Showing it means the switch never started,
  // so the chooser closes and the question takes the screen.
  // Only the unsaved-work refusal reaches shared state; `switch-pending` stays
  // a silent rejection, per the provider and the lab machine. Narrowed here so
  // the panel below cannot be handed a refusal it has no copy for.
  const refusal = context.refusal?.kind === "unsaved-work" ? context.refusal : null;

  // A refusal means the switch never started, so the question takes the screen
  // and the chooser goes away. Adjusted during render against a previous-value
  // sentinel rather than in an effect — the same sanctioned shape `useChooser`
  // uses, and what this repo's hooks rule requires instead of a synchronous
  // setState inside an effect. Dismissing does not reopen the chooser: the
  // person asked to stay where they are.
  const [seenRefusal, setSeenRefusal] = useState(refusal);
  if (refusal !== seenRefusal) {
    setSeenRefusal(refusal);
    if (refusal) setOpen(false);
  }

  return (
    <div className={strip ? "relative w-full" : "relative min-w-0"}>
      <LiveRegion message={chooser.countMessage} />

      <ProjectTrigger
        ref={triggerRef}
        context={context}
        open={open}
        onToggle={toggle}
        strip={strip}
      />

      {open && !strip ? (
        <Popover
          chooser={chooser}
          catalog={catalog}
          blocked={blocked}
          layerRef={layerRef}
        />
      ) : null}

      {open && strip ? (
        <Sheet
          chooser={chooser}
          catalog={catalog}
          blocked={blocked}
          onClose={close}
          layerRef={layerRef}
        />
      ) : null}

      {refusal ? (
        <UnsavedWorkNotice
          refusal={refusal}
          onDismiss={context.dismissRefusal}
          strip={strip}
        />
      ) : null}

      {context.lastError ? (
        <SwitchError message={context.lastError} strip={strip} />
      ) : null}
    </div>
  );
}

// ── The trigger ─────────────────────────────────────────────────────────────

function ProjectTrigger({
  ref,
  context,
  open,
  onToggle,
  strip,
}: {
  ref: React.RefObject<HTMLButtonElement | null>;
  context: ActiveProjectContextValue;
  open: boolean;
  onToggle: () => void;
  strip: boolean;
}) {
  const { chrome, pending } = context;
  const slow = useSlowSwitch(pending !== null);
  const settled = useSettled(chrome.kind === "skeleton" && pending === null);

  // Plan §7.4: a fixed-width skeleton, and no remembered name on screen before
  // the server verifies one.
  //
  // Bounded in time, because "unverified" and "nothing will ever verify this"
  // look identical from here. Only the Tasks runtime publishes a snapshot
  // today; Notes and Home resolve no Project at all (surface map §4.3), so on
  // those surfaces the wait never ends and an indefinite grey bar in permanent
  // chrome reads as a broken app. Once the wait is over the trigger says what
  // is true — it offers the choice without naming a current Project, and the
  // chooser and the switch both work normally. It still never guesses a name.
  if (chrome.kind === "skeleton" && !pending && !settled) {
    return (
      <div
        className={strip ? "flex min-h-[48px] items-center px-4" : "flex items-center"}
        aria-live="off"
      >
        <span className={SR_ONLY}>Loading your project.</span>
        <span
          aria-hidden="true"
          className="h-[26px] animate-pulse rounded-lg bg-white/[0.08]"
          style={{ width: ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH }}
        />
      </div>
    );
  }

  // `pending` is A held on screen under B's URL — the same Project, named
  // differently by the projection precisely so this component cannot paint it
  // as verified.
  const showing =
    chrome.kind === "verified"
      ? chrome.project
      : chrome.kind === "pending"
        ? chrome.showing
        : null;
  const inert = chrome.kind === "pending";
  const name = pending ? pending.label : (showing?.name ?? "Choose a project");
  const archived = showing?.archivedAt != null;

  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={pending !== null || undefined}
        data-slot="active-project-trigger"
        className={[
          styles.ring,
          "group flex items-center gap-2.5 text-left outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-[var(--x-studio-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--x-studio-chrome)]",
          strip
            ? "[--ap-r:0px] min-h-[48px] w-full px-4"
            : "[--ap-r:10px] h-[44px] max-w-[340px] rounded-lg px-2.5 hover:bg-white/[0.06] md:h-[34px] md:pointer-coarse:h-[44px]",
          pending ? "cursor-progress" : "",
        ].join(" ")}
      >
        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--x-studio-ink-quiet)] lg:inline">
          Project
        </span>
        <span
          className={[
            "min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em]",
            pending || inert
              ? "text-[var(--x-studio-ink-soft)]"
              : "text-[var(--x-studio-ink)]",
          ].join(" ")}
          title={showing?.name}
        >
          {name}
        </span>
        {archived && !pending ? (
          <span className="inline-flex shrink-0 items-center rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--x-studio-ink-soft)]">
            Read-only
          </span>
        ) : null}
        <ChevronIcon
          className={[
            "shrink-0 text-[var(--x-studio-ink-quiet)] transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
        <span className={SR_ONLY}>Change project</span>
      </button>

      {/* Past 300ms, a line that finishes. Never a spinner. */}
      {slow ? (
        <span
          aria-hidden="true"
          className={[
            styles.progress,
            "absolute inset-x-2.5 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/[0.14]",
          ].join(" ")}
        />
      ) : null}
    </div>
  );
}

/**
 * How long the trigger holds its skeleton before giving up on a snapshot.
 *
 * Long enough that a Tasks surface publishing after hydration is never seen to
 * flicker through the unnamed state, short enough that a surface which will
 * never publish does not sit grey in the chrome.
 */
const SNAPSHOT_WAIT_MS = 1200;

function useSettled(waiting: boolean): boolean {
  const [settled, setSettled] = useState(false);

  const [wasWaiting, setWasWaiting] = useState(waiting);
  if (waiting !== wasWaiting) {
    setWasWaiting(waiting);
    if (!waiting) setSettled(false);
  }

  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setSettled(true), SNAPSHOT_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);

  return settled;
}

function useSlowSwitch(active: boolean): boolean {
  const [slow, setSlow] = useState(false);

  // Clearing on the falling edge is a render-time adjustment, not an effect:
  // a synchronous setState inside an effect costs an extra render pass and is
  // what this repo's hooks rule refuses. Only the *arming* is an effect,
  // because a timer is a real subscription.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setSlow(false);
  }

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_SWITCH_MS);
    return () => window.clearTimeout(id);
  }, [active]);

  return slow;
}

// ── Layers ──────────────────────────────────────────────────────────────────

type PanelProps = {
  chooser: Chooser;
  catalog: CatalogState & { retry: () => void };
  blocked: ChooserRow | null;
};

function Popover({
  chooser,
  catalog,
  blocked,
  layerRef,
}: PanelProps & { layerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={layerRef}
      role="dialog"
      aria-label="Choose a project"
      className={[
        styles.pop,
        "absolute left-0 top-[calc(100%+8px)] z-50 flex w-[412px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--paper)] shadow-2xl",
      ].join(" ")}
      style={{ maxHeight: "min(60vh, 520px)" }}
    >
      <ChooserBody chooser={chooser} catalog={catalog} blocked={blocked} />
    </div>
  );
}

/**
 * Portalled to the document body, which is not decoration.
 *
 * The strip that owns the trigger is `sticky` with a `z-index`, and that makes
 * it a stacking context: a sheet rendered inside it is trapped beneath the
 * context's own level however high its own z-index goes. Rendered in place, the
 * sheet painted *under* the mobile suite nav and the development banner — the
 * bottom third of the chooser was unreachable. Same treatment, and the same
 * reason, as the command palette.
 */
function Sheet({
  chooser,
  catalog,
  blocked,
  onClose,
  layerRef,
}: PanelProps & {
  onClose: () => void;
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const sheet = (
    <div className="fixed inset-0 z-[90]">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[styles.scrim, "absolute inset-0 bg-black/40"].join(" ")}
      />
      <div
        ref={layerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a project"
        className={[
          styles.sheet,
          "absolute inset-x-0 bottom-0 flex max-h-[86%] flex-col overflow-hidden rounded-t-[20px] border-t border-[var(--hairline)] bg-[var(--paper)] shadow-2xl",
        ].join(" ")}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="shrink-0 pt-2.5">
          <span
            aria-hidden="true"
            className="mx-auto block h-1 w-9 rounded-full bg-[var(--ink-ghost)]"
          />
        </div>
        <ChooserBody chooser={chooser} catalog={catalog} blocked={blocked} sheet />
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

// ── Chooser body ────────────────────────────────────────────────────────────

function ChooserBody({
  chooser,
  catalog,
  blocked,
  sheet = false,
}: PanelProps & { sheet?: boolean }) {
  if (catalog.kind === "loading" || catalog.kind === "idle") {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-[var(--ink-faint)]">
        <span className={SR_ONLY}>Loading your projects.</span>
        Loading your projects…
      </div>
    );
  }

  if (catalog.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-8">
        <p className="text-[13px] leading-[1.5] text-[var(--ink-soft)]">
          We couldn&rsquo;t load your projects. Nothing has changed — you&rsquo;re still in
          the project you had open.
        </p>
        <button
          type="button"
          onClick={catalog.retry}
          className="inline-flex min-h-[36px] items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (catalog.catalog.rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[13px] text-[var(--ink-faint)]">
        No projects yet.
      </div>
    );
  }

  return (
    <>
      <ChooserHeader chooser={chooser} sheet={sheet} />
      <ChooserResults chooser={chooser} sheet={sheet} />
      {blocked ? <BlockedNotice row={blocked} /> : null}
      <ChooserFooter chooser={chooser} truncated={catalog.catalog.truncated} />
    </>
  );
}

function ChooserHeader({ chooser, sheet }: { chooser: Chooser; sheet: boolean }) {
  // Focus lands where typing does: the input when there is one, the list when
  // there is not. A callback ref runs on attach only, so this cannot re-steal
  // focus on every render.
  const setInput = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  if (chooser.mode === "listbox") {
    return (
      <div
        className={[
          "shrink-0 border-b border-[var(--hairline-soft)] px-4 pb-3",
          sheet ? "pt-3" : "pt-3.5",
        ].join(" ")}
      >
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          Your projects
        </h2>
      </div>
    );
  }

  return (
    <div
      className={[
        "shrink-0 border-b border-[var(--hairline-soft)] px-3",
        sheet ? "py-3" : "py-2.5",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--paper-soft)] px-3 focus-within:border-[var(--accent)]">
        <SearchIcon className="shrink-0 text-[var(--ink-faint)]" />
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
          className="min-h-[44px] w-full bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
      </div>
    </div>
  );
}

function ChooserResults({ chooser, sheet }: { chooser: Chooser; sheet: boolean }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const listboxMode = chooser.mode === "listbox";

  // With no input there is nothing else for focus to land on, so the listbox
  // takes it — once, on mount, not on every render.
  useEffect(() => {
    if (listboxMode) listRef.current?.focus();
  }, [listboxMode]);

  const headings = chooser.groups.length > 1;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
      <div
        ref={listRef}
        id={chooser.listboxId}
        role="listbox"
        aria-label="Projects"
        tabIndex={listboxMode ? 0 : -1}
        aria-activedescendant={
          listboxMode && chooser.activeRow
            ? chooser.optionId(chooser.activeRow.id)
            : undefined
        }
        onKeyDown={listboxMode ? chooser.onKeyDown : undefined}
        className={[styles.ring, "[--ap-r:8px] outline-none"].join(" ")}
      >
        {chooser.groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-faint)]">
            No projects match that.
          </p>
        ) : null}

        {chooser.groups.map((group) => {
          if (group.kind === "archived" && !chooser.archivedOpen) return null;
          return (
            <div key={group.id} role="group" aria-labelledby={group.headingId}>
              {headings ? (
                <div
                  id={group.headingId}
                  className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-faint)]"
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

      {chooser.hasArchived ? (
        <div className="px-3 pb-2 pt-1">
          <button
            type="button"
            onClick={chooser.toggleArchived}
            aria-expanded={chooser.archivedOpen}
            className={[
              styles.ring,
              "[--ap-r:8px] flex min-h-[44px] w-full items-center gap-2 rounded-lg px-1.5 text-left text-[12px] text-[var(--ink-soft)] transition-colors hover:bg-[var(--paper-deep)]",
            ].join(" ")}
          >
            <ChevronIcon
              className={
                chooser.archivedOpen
                  ? "text-[var(--ink-faint)]"
                  : "-rotate-90 text-[var(--ink-faint)]"
              }
            />
            {chooser.archivedOpen
              ? "Hide archived"
              : `Archived · ${chooser.archivedCount}`}
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
  row: ChooserRow;
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
      aria-disabled={row.selectable ? undefined : true}
      aria-label={row.accessibleName}
      ref={(node) => chooser.registerRow(row.id, node)}
      onClick={() => chooser.choose(row)}
      onPointerMove={() => {
        const index = chooser.rows.findIndex((entry) => entry.id === row.id);
        if (index >= 0 && index !== chooser.activeIndex) chooser.setActiveIndex(index);
      }}
      className={[
        "relative flex items-start gap-3 py-2 pl-4 pr-3",
        row.selectable ? "cursor-pointer" : "cursor-not-allowed",
        sheet ? "min-h-[52px]" : "min-h-[48px] pointer-coarse:min-h-[52px]",
        active ? "bg-[var(--accent-tint)]" : "",
      ].join(" ")}
    >
      {/* Current is carried by a rail, a check and a word — never by colour on
          its own. */}
      <span
        aria-hidden="true"
        className={[
          "absolute inset-y-1 left-0 w-[2px] rounded-full",
          current ? "bg-[var(--accent)]" : "bg-transparent",
        ].join(" ")}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={[
              "line-clamp-2 text-[14px] leading-[1.35] tracking-[-0.01em]",
              current ? "font-semibold" : "font-medium",
              row.selectable ? "text-[var(--ink)]" : "text-[var(--ink-faint)]",
            ].join(" ")}
          >
            {row.name}
          </span>
          {current ? (
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--accent)]">
              Current
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-[1.4] text-[var(--ink-faint)]">
          {row.subtitle}
        </span>
      </span>
      {current ? <CheckIcon className="mt-0.5 shrink-0 text-[var(--accent)]" /> : null}
    </div>
  );
}

function BlockedNotice({ row }: { row: ChooserRow }) {
  return (
    <p
      role="status"
      className="shrink-0 border-t border-[var(--hairline-soft)] bg-[var(--paper-soft)] px-4 py-3 text-[12px] leading-[1.5] text-[var(--ink-soft)]"
    >
      {row.blockedReason}
    </p>
  );
}

function ChooserFooter({
  chooser,
  truncated,
}: {
  chooser: Chooser;
  truncated: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-[var(--hairline-soft)] bg-[var(--paper-soft)] px-4 py-3">
      {truncated ? (
        <p className="mb-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          You&rsquo;re in more projects than fit this list. Search to find one that
          isn&rsquo;t here.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-faint)]">
          {chooser.mode === "combobox" ? "Type to find" : "Type to jump"}
        </span>
      </div>
    </div>
  );
}

// ── The two things that can come back from a refused switch ─────────────────

/**
 * The unsaved-work hold (WP6 Lane C). The claims carry the copy; resolving the
 * work itself stays with the surface that owns it, so the only action offered
 * here is the one this component can honestly complete: stay put.
 */
function UnsavedWorkNotice({
  refusal,
  onDismiss,
  strip,
}: {
  refusal: Extract<SelectProjectRefusal, { kind: "unsaved-work" }>;
  onDismiss: () => void;
  strip: boolean;
}) {
  const headingId = useId();
  return (
    <div
      role="alertdialog"
      aria-labelledby={headingId}
      className={[
        styles.pop,
        "absolute z-50 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-4 shadow-2xl",
        strip ? "left-4 right-4 top-[calc(100%+8px)] w-auto" : "left-0 top-[calc(100%+8px)]",
      ].join(" ")}
    >
      <h2 id={headingId} className="text-[14px] font-semibold text-[var(--ink)]">
        You have unsaved work
      </h2>
      <ul className="flex list-none flex-col gap-1.5 p-0 text-[13px] leading-[1.5] text-[var(--ink-soft)]">
        {refusal.claims.map((claim) => (
          <li key={claim.source}>{claim.description}</li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          autoFocus
          className={[
            styles.ring,
            "[--ap-r:8px] inline-flex min-h-[36px] items-center rounded-lg bg-[var(--ink)] px-3 text-[12px] font-medium text-[var(--paper)] transition-opacity hover:opacity-90",
          ].join(" ")}
        >
          Stay here
        </button>
      </div>
    </div>
  );
}

function SwitchError({ message, strip }: { message: string; strip: boolean }) {
  return (
    <p
      role="status"
      className={[
        "absolute z-50 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--ink-soft)] shadow-lg",
        strip ? "left-4 right-4 top-[calc(100%+8px)]" : "left-0 top-[calc(100%+8px)] w-[320px]",
      ].join(" ")}
    >
      {message}
    </p>
  );
}

// ── Live region ─────────────────────────────────────────────────────────────

function LiveRegion({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" className={SR_ONLY}>
      {message}
    </span>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// ── Mount helpers ───────────────────────────────────────────────────────────

/**
 * The bar half. Renders nothing on a phone, where the strip below the bar owns
 * the control — exactly one of the two ever mounts, so the catalog is fetched
 * once and there is one piece of chooser state.
 */
export function ActiveProjectBarCell() {
  const phone = usePhone();
  if (phone) return null;
  return <ActiveProjectControl />;
}

/**
 * The phone half: a sticky context strip beneath the bar. New UI — there has
 * never been a mobile context strip, and `MobileSuiteNav` hides itself on
 * Tasks, so without this the phone would have the control only inside a
 * board-embedded drawer.
 */
export function ActiveProjectMobileStrip() {
  const phone = usePhone();
  const context = useActiveProject();
  if (!phone || !context) return null;
  return (
    <div className="sticky top-0 z-30 flex-none border-b border-[var(--hairline)] bg-[var(--paper)] md:hidden">
      <ActiveProjectControl strip />
    </div>
  );
}
