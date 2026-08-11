"use client";

/**
 * FieldMenu — the house control for "this row's value is one of these".
 *
 * The list view used native `<select>`s for status and priority, on desktop
 * and on a phone. A native select is the operating system's widget: its
 * arrow, its type ramp, its popup, its focus ring — none of which the rest
 * of this surface speaks. Six of them down a column is the single loudest
 * "unfinished template" tell the view had.
 *
 * This is not a new primitive. It is the repo's existing action-menu
 * primitive (ActionsDropdown → Radix DropdownMenu, the ONE dropdown dep
 * D-005 permits) with a value-shaped trigger in front of it, so the menu
 * keeps everything Radix already guarantees: roving focus, arrow keys,
 * Home/End, typeahead, Escape, focus return to the trigger, and the
 * button/menu/menuitem roles.
 *
 * Label semantics: the trigger's accessible name states the field AND its
 * current value ("Status for Book the band, In flight"), which is what the
 * old `aria-label` + selected `<option>` pairing announced together. A
 * read-only workspace renders the value as plain text rather than a
 * disabled button — nothing to tab to that cannot be used.
 */

import { ActionsDropdown, type ActionItem } from "@/components/primitives/context-actions";
import { Icon } from "./icons";
import styles from "../options/a/option-a.module.css";

export type FieldMenuOption = {
  value: string;
  /** Plain English — this is what the trigger shows and the menu lists. */
  label: string;
};

export function FieldMenu({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  /** Field name for the accessible label, e.g. `Status for Book the band`. */
  label: string;
  onChange: (value: string) => void;
  options: readonly FieldMenuOption[];
  value: string;
}) {
  const current = options.find((option) => option.value === value);
  const shown = current?.label ?? "Not set";

  if (disabled) {
    return <span className={styles.fieldMenuStatic}>{shown}</span>;
  }

  const items: ActionItem[] = options.map((option) => ({
    id: option.value,
    label: option.label,
    // The current value is marked, not merely absent from the choices —
    // a menu that hides where you already are makes you guess.
    icon: option.value === value ? <Icon name="check" size={14} /> : undefined,
    group: "workflow",
    onSelect: () => onChange(option.value),
  }));

  return (
    <ActionsDropdown
      items={items}
      trigger={
        <>
          <span>{shown}</span>
          <Icon name="chevron-down" size={12} />
        </>
      }
      triggerClassName={styles.fieldMenuTrigger}
      triggerLabel={`${label}, ${shown}`}
    />
  );
}
