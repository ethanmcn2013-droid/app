"use client";

/**
 * Tasks UI kit: buttons, Radix menus and an anchored popover, styled once
 * on v3 tokens so every menu and picker on the surface is the same object.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { TIcon } from "./icons";
import styles from "./ui.module.css";

/* ── Buttons ──────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
  iconOnly?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", icon, iconOnly, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[styles.button, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly ? "" : undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

/* ── Radix dropdown menu, styled ──────────────────────────────────── */

export const MenuRoot = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;
export const MenuGroup = Dropdown.Group;
export const MenuRadioGroup = Dropdown.RadioGroup;
export const MenuSub = Dropdown.Sub;

export function MenuContent({
  children,
  align = "start",
  side = "bottom",
  width,
  className,
  label,
}: {
  children: ReactNode;
  align?: "start" | "end" | "center";
  side?: "bottom" | "top" | "right" | "left";
  width?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        className={[styles.menu, className].filter(Boolean).join(" ")}
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={12}
        style={width ? ({ width } as CSSProperties) : undefined}
        aria-label={label}
        data-tasks-layer=""
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  hint,
  onSelect,
  danger,
  disabled,
  keepOpen,
}: {
  children: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
}) {
  return (
    <Dropdown.Item
      className={styles.menuItem}
      data-danger={danger ? "" : undefined}
      disabled={disabled}
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
        onSelect?.();
      }}
    >
      <span className={styles.menuIcon} aria-hidden="true">{icon}</span>
      <span className={styles.menuText}>{children}</span>
      {hint ? <span className={styles.menuHint}>{hint}</span> : null}
    </Dropdown.Item>
  );
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  icon,
  hint,
  keepOpen = true,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: ReactNode;
  hint?: ReactNode;
  keepOpen?: boolean;
}) {
  return (
    <Dropdown.CheckboxItem
      className={styles.menuItem}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
      }}
    >
      <span className={styles.menuIcon} aria-hidden="true">{icon}</span>
      <span className={styles.menuText}>{children}</span>
      {hint ? <span className={styles.menuHint}>{hint}</span> : null}
      <span className={styles.menuCheck} aria-hidden="true">
        <Dropdown.ItemIndicator>
          <TIcon.check size={14} />
        </Dropdown.ItemIndicator>
      </span>
    </Dropdown.CheckboxItem>
  );
}

export function MenuRadioItem({
  children,
  value,
  icon,
  hint,
  keepOpen,
}: {
  children: ReactNode;
  value: string;
  icon?: ReactNode;
  hint?: ReactNode;
  keepOpen?: boolean;
}) {
  return (
    <Dropdown.RadioItem
      className={styles.menuItem}
      value={value}
      onSelect={(event) => {
        if (keepOpen) event.preventDefault();
      }}
    >
      <span className={styles.menuIcon} aria-hidden="true">{icon}</span>
      <span className={styles.menuText}>{children}</span>
      {hint ? <span className={styles.menuHint}>{hint}</span> : null}
      <span className={styles.menuCheck} aria-hidden="true">
        <Dropdown.ItemIndicator>
          <TIcon.check size={14} />
        </Dropdown.ItemIndicator>
      </span>
    </Dropdown.RadioItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <Dropdown.Label className={styles.menuLabel}>{children}</Dropdown.Label>;
}

export function MenuSeparator() {
  return <Dropdown.Separator className={styles.menuSeparator} />;
}

export function MenuSubTrigger({ children, icon, hint }: { children: ReactNode; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <Dropdown.SubTrigger className={styles.menuItem}>
      <span className={styles.menuIcon} aria-hidden="true">{icon}</span>
      <span className={styles.menuText}>{children}</span>
      {hint ? <span className={styles.menuHint}>{hint}</span> : null}
      <span className={styles.menuChevron} aria-hidden="true"><TIcon.chevronRight size={14} /></span>
    </Dropdown.SubTrigger>
  );
}

export function MenuSubContent({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <Dropdown.Portal>
      <Dropdown.SubContent
        className={styles.menu}
        sideOffset={4}
        alignOffset={-5}
        collisionPadding={12}
        style={width ? ({ width } as CSSProperties) : undefined}
        data-tasks-layer=""
      >
        {children}
      </Dropdown.SubContent>
    </Dropdown.Portal>
  );
}

/* ── Anchored popover ─────────────────────────────────────────────── */

type Anchor = HTMLElement | { x: number; y: number } | null;

/**
 * A light anchored layer for pickers and small forms. Opens beside its
 * anchor, flips above when there is no room below, closes on Escape or an
 * outside press, and hands focus back to the anchor. On phones it becomes a
 * bottom sheet over a scrim.
 */
export function Popover({
  open,
  anchor,
  onClose,
  children,
  width = 280,
  label,
  align = "start",
  returnFocus = true,
  sheetOnPhone = true,
  className,
}: {
  open: boolean;
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  label: string;
  align?: "start" | "end" | "center";
  returnFocus?: boolean;
  sheetOnPhone?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; origin: string } | null>(null);
  const [phone, setPhone] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    opener.current = anchor instanceof HTMLElement ? anchor : (document.activeElement as HTMLElement | null);
    const place = () => {
      const narrow = sheetOnPhone && window.matchMedia("(max-width: 767px)").matches;
      setPhone(narrow);
      if (narrow) return;
      const node = ref.current;
      const height = node?.offsetHeight ?? 240;
      const rect =
        anchor instanceof HTMLElement
          ? anchor.getBoundingClientRect()
          : anchor
            ? new DOMRect(anchor.x, anchor.y, 0, 0)
            : new DOMRect(window.innerWidth / 2 - width / 2, 120, width, 0);
      let left = align === "end" ? rect.right - width : align === "center" ? rect.left + rect.width / 2 - width / 2 : rect.left;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      const below = rect.bottom + 6;
      const fitsBelow = below + height < window.innerHeight - 12;
      const top = fitsBelow ? below : Math.max(12, rect.top - 6 - height);
      setPosition({ left, top, origin: `${align === "end" ? "right" : "left"} ${fitsBelow ? "top" : "bottom"}` });
    };
    // Placed on the next frame, once the layer has a measurable height.
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, width, align, sheetOnPhone]);

  const close = useCallback(() => {
    onClose();
    if (returnFocus) {
      const target = opener.current;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    }
  }, [onClose, returnFocus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onPointer = (event: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      const target = event.target as Node;
      if (node.contains(target)) return;
      if (anchor instanceof HTMLElement && anchor.contains(target)) return;
      if ((target as Element).closest?.("[data-radix-popper-content-wrapper]")) return;
      close();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, close, anchor]);

  // Move focus in once the layer is placed.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const node = ref.current;
      if (!node || node.contains(document.activeElement)) return;
      const first = node.querySelector<HTMLElement>("[data-autofocus], input, textarea, button:not([disabled]), [tabindex='0']");
      first?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      {phone ? <div className={styles.scrim} onPointerDown={close} aria-hidden="true" /> : null}
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        data-tasks-layer=""
        data-phone={phone ? "" : undefined}
        className={[styles.popover, className].filter(Boolean).join(" ")}
        style={
          phone
            ? undefined
            : ({
                width,
                left: position?.left ?? -9999,
                top: position?.top ?? -9999,
                transformOrigin: position?.origin,
              } as CSSProperties)
        }
      >
        {phone ? <span className={styles.grabber} aria-hidden="true" /> : null}
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ── Picker list inside a popover ─────────────────────────────────── */

export type PickerOption = {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  selected?: boolean;
  keywords?: string;
};

/**
 * A filterable option list: type to narrow, arrows to move, Enter to pick.
 * Multi-select keeps the list open; single select closes on pick.
 */
export function PickerList({
  options,
  onPick,
  placeholder = "Filter",
  multi = false,
  empty = "Nothing matches.",
  footer,
}: {
  options: PickerOption[];
  onPick: (id: string) => void;
  placeholder?: string;
  multi?: boolean;
  empty?: string;
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const q = query.trim().toLocaleLowerCase("en-GB");
  const shown = q
    ? options.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLocaleLowerCase("en-GB").includes(q))
    : options;
  const clamped = Math.min(active, Math.max(0, shown.length - 1));

  return (
    <div className={styles.picker}>
      {options.length > 5 ? (
        <input
          className={styles.pickerInput}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          data-autofocus=""
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, shown.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const option = shown[clamped];
              if (option) onPick(option.id);
            }
          }}
        />
      ) : null}
      <div className={styles.pickerList} role="listbox" aria-multiselectable={multi || undefined} ref={listRef}>
        {shown.length === 0 ? <p className={styles.pickerEmpty}>{empty}</p> : null}
        {shown.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={Boolean(option.selected)}
            className={styles.pickerOption}
            data-active={index === clamped ? "" : undefined}
            data-autofocus={options.length <= 5 && index === 0 ? "" : undefined}
            onMouseEnter={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
                const at = items.indexOf(event.currentTarget);
                const next = items[event.key === "ArrowDown" ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0)];
                next?.focus();
              }
            }}
            onClick={() => onPick(option.id)}
          >
            <span className={styles.pickerIcon} aria-hidden="true">{option.icon}</span>
            <span className={styles.pickerLabel}>{option.label}</span>
            {option.hint ? <span className={styles.pickerHint}>{option.hint}</span> : null}
            <span className={styles.pickerCheck} aria-hidden="true">{option.selected ? <TIcon.check size={14} /> : null}</span>
          </button>
        ))}
      </div>
      {footer ? <div className={styles.pickerFooter}>{footer}</div> : null}
    </div>
  );
}

export const ui = styles;
