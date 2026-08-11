"use client";

/**
 * ContextActions — Phase 3.3 context-action system foundation.
 *
 * One action registry drives both surfaces:
 *   - A Radix DropdownMenu bound to a visible ••• trigger (always-accessible)
 *   - A Radix ContextMenu on right-click of the wrapped target
 *
 * Groups render in fixed order: open → workflow → organisation → destructive.
 * Destructive items are rose-toned and separated last (RESEARCH Principle 9).
 * Editable text targets (input/textarea/contenteditable) keep the native
 * browser context menu — the ContextMenu trigger is asChild on the non-editable
 * wrapper only, and onOpenAutoFocus is suppressed on pointer events into fields
 * (RESEARCH Principle 11).
 *
 * Radix supplies: roles, focus, arrow-key nav, Escape, typeahead. We do not
 * fight those primitives — only style and group them.
 *
 * D-005: @radix-ui/react-dropdown-menu and @radix-ui/react-context-menu are
 * the ONLY Radix deps permitted in this programme.
 */

import {
  type ReactElement,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  Fragment,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ContextMenu from "@radix-ui/react-context-menu";
import styles from "./context-actions.module.css";

// ─── Action registry types ────────────────────────────────────────────────────

export type ActionGroup = "open" | "workflow" | "organisation" | "destructive";

export type ActionItem = {
  id: string;
  label: string;
  /** Optional icon element (16×16 SVG or similar). */
  icon?: ReactNode;
  /** Keyboard shortcut hint shown right-aligned in 10.5px mono. */
  shortcutHint?: string;
  group: ActionGroup;
  disabled?: boolean;
  /** Shown as native tooltip on the disabled item. */
  disabledReason?: string;
  onSelect: () => void;
  submenu?: ActionItem[];
};

// ─── Group ordering ───────────────────────────────────────────────────────────

const GROUP_ORDER: ActionGroup[] = ["open", "workflow", "organisation", "destructive"];

function groupItems(items: ActionItem[]): Map<ActionGroup, ActionItem[]> {
  const map = new Map<ActionGroup, ActionItem[]>();
  for (const g of GROUP_ORDER) map.set(g, []);
  for (const item of items) {
    map.get(item.group)?.push(item);
  }
  return map;
}

/** Returns the groups that actually have items, in canonical order. */
function populatedGroups(map: Map<ActionGroup, ActionItem[]>): ActionGroup[] {
  return GROUP_ORDER.filter((g) => (map.get(g)?.length ?? 0) > 0);
}

// ─── Dropdown (••• trigger) ───────────────────────────────────────────────────

type DropdownItemProps = {
  item: ActionItem;
  onClose?: () => void;
};

function DropdownItemRenderer({ item, onClose }: DropdownItemProps) {
  if (item.submenu && item.submenu.length > 0) {
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger
          className={styles.item}
          data-destructive={item.group === "destructive" || undefined}
          disabled={item.disabled}
          title={item.disabled ? item.disabledReason : undefined}
        >
          {item.icon ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
          <span className={styles.label}>{item.label}</span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className={styles.content} sideOffset={2} alignOffset={-4}>
            {item.submenu.map((sub) => (
              <DropdownMenu.Item
                key={sub.id}
                className={styles.item}
                data-destructive={sub.group === "destructive" || undefined}
                disabled={sub.disabled}
                title={sub.disabled ? sub.disabledReason : undefined}
                onSelect={() => { sub.onSelect(); onClose?.(); }}
              >
                {sub.icon ? <span className={styles.icon} aria-hidden="true">{sub.icon}</span> : null}
                <span className={styles.label}>{sub.label}</span>
                {sub.shortcutHint ? <span className={styles.shortcut}>{sub.shortcutHint}</span> : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  }

  return (
    <DropdownMenu.Item
      className={styles.item}
      data-destructive={item.group === "destructive" || undefined}
      disabled={item.disabled}
      title={item.disabled ? item.disabledReason : undefined}
      onSelect={() => { item.onSelect(); onClose?.(); }}
    >
      {item.icon ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
      <span className={styles.label}>{item.label}</span>
      {item.shortcutHint ? <span className={styles.shortcut}>{item.shortcutHint}</span> : null}
    </DropdownMenu.Item>
  );
}

// ─── ContextMenu (right-click) item renderer ─────────────────────────────────

type ContextItemProps = {
  item: ActionItem;
};

function ContextItemRenderer({ item }: ContextItemProps) {
  if (item.submenu && item.submenu.length > 0) {
    return (
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger
          className={styles.item}
          data-destructive={item.group === "destructive" || undefined}
          disabled={item.disabled}
          title={item.disabled ? item.disabledReason : undefined}
        >
          {item.icon ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
          <span className={styles.label}>{item.label}</span>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </ContextMenu.SubTrigger>
        <ContextMenu.Portal>
          <ContextMenu.SubContent className={styles.content} sideOffset={2} alignOffset={-4}>
            {item.submenu.map((sub) => (
              <ContextMenu.Item
                key={sub.id}
                className={styles.item}
                data-destructive={sub.group === "destructive" || undefined}
                disabled={sub.disabled}
                title={sub.disabled ? sub.disabledReason : undefined}
                onSelect={sub.onSelect}
              >
                {sub.icon ? <span className={styles.icon} aria-hidden="true">{sub.icon}</span> : null}
                <span className={styles.label}>{sub.label}</span>
                {sub.shortcutHint ? <span className={styles.shortcut}>{sub.shortcutHint}</span> : null}
              </ContextMenu.Item>
            ))}
          </ContextMenu.SubContent>
        </ContextMenu.Portal>
      </ContextMenu.Sub>
    );
  }

  return (
    <ContextMenu.Item
      className={styles.item}
      data-destructive={item.group === "destructive" || undefined}
      disabled={item.disabled}
      title={item.disabled ? item.disabledReason : undefined}
      onSelect={item.onSelect}
    >
      {item.icon ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
      <span className={styles.label}>{item.label}</span>
      {item.shortcutHint ? <span className={styles.shortcut}>{item.shortcutHint}</span> : null}
    </ContextMenu.Item>
  );
}

// ─── Shared group renderer helpers ───────────────────────────────────────────

function renderDropdownGroups(items: ActionItem[], onClose?: () => void) {
  const grouped = groupItems(items);
  const groups = populatedGroups(grouped);
  return groups.map((group, gIdx) => (
    <Fragment key={group}>
      {gIdx > 0 ? <DropdownMenu.Separator className={styles.separator} /> : null}
      {grouped.get(group)!.map((item) => (
        <DropdownItemRenderer key={item.id} item={item} onClose={onClose} />
      ))}
    </Fragment>
  ));
}

function renderContextGroups(items: ActionItem[]) {
  const grouped = groupItems(items);
  const groups = populatedGroups(grouped);
  return groups.map((group, gIdx) => (
    <Fragment key={group}>
      {gIdx > 0 ? <ContextMenu.Separator className={styles.separator} /> : null}
      {grouped.get(group)!.map((item) => (
        <ContextItemRenderer key={item.id} item={item} />
      ))}
    </Fragment>
  ));
}

// ─── Public component ─────────────────────────────────────────────────────────

export type ContextActionsProps = {
  /** The action registry. One list drives both right-click and ••• menus. */
  items: ActionItem[];
  /**
   * The interactive card/surface that receives the right-click context menu.
   * MUST render exactly one element (Radix attaches its handlers via asChild —
   * a fragment or multiple roots throws at runtime). Must NOT be an
   * input/textarea/contenteditable — the ContextMenu trigger is placed on the
   * outer non-editable wrapper so native menus in text fields are preserved
   * (Principle 11, D-005).
   */
  target: ReactElement;
};

export type ActionsDropdownProps = {
  /** The same registry the surrounding ContextActions uses. */
  items: ActionItem[];
  /** The visible ••• trigger content. */
  trigger: ReactNode;
  /** Accessible label for the ••• trigger button. */
  triggerLabel: string;
  /** Additional className applied to the ••• trigger button. */
  triggerClassName?: string;
  /**
   * Tab-order participation for the ••• trigger. Defaults to the browser's
   * (a normal tab stop). Pass -1 when the trigger sits inside a composite
   * widget that owns its own roving focus — the board's cards do this, so
   * thirteen cards cost one Tab stop between them instead of thirteen. The
   * trigger stays clickable, stays in the accessibility tree, and the same
   * registry is still reachable from the keyboard via the context menu.
   */
  triggerTabIndex?: number;
};

/**
 * ContextActions provides the right-click (Radix ContextMenu) surface for a
 * card. The visible ••• route is a separate `ActionsDropdown` mounted INSIDE
 * the card (so the button lives in the card's own geometry) — both are driven
 * by the same `items` registry (Principle 1, D-005). The right-click menu is
 * never the only route: callers must also mount `ActionsDropdown`.
 */
export function ContextActions({ items, target }: ContextActionsProps) {
  return (
    <ContextMenu.Root>
      {/* asChild attaches the context-menu handling to the single element in
          `target`. Editable descendants keep the native browser menu. */}
      <ContextMenu.Trigger asChild>{target}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={styles.content}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            // Return focus to the element that received the right-click so
            // keyboard users stay oriented (Radix default; keep it).
            event.preventDefault();
          }}
        >
          {renderContextGroups(items)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/**
 * The visible ••• trigger — always accessible without right-click.
 * Mount inside the card where the actions button belongs.
 */
export function ActionsDropdown({
  items,
  trigger,
  triggerLabel,
  triggerClassName,
  triggerTabIndex,
}: ActionsDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={triggerLabel}
          className={triggerClassName}
          tabIndex={triggerTabIndex}
          type="button"
          // Stop the click from bubbling to the card's onClick (which
          // handles selection) so opening the menu doesn't toggle selection.
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
            // Stop Space/Enter from bubbling to card keyboard handlers
            // so the menu opens cleanly without the card acting on it.
            if (event.key === " " || event.key === "Enter") event.stopPropagation();
          }}
        >
          {trigger}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          align="end"
          collisionPadding={8}
          sideOffset={4}
        >
          {renderDropdownGroups(items)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
