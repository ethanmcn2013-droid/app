"use client";

/**
 * The layer mechanics — ported from the WP5 lab.
 *
 * Desktop is an anchored NONMODAL popover; phone is a MODAL, focus-trapped
 * bottom sheet (plan §7.3). The difference is one flag, so both live here.
 *
 * Not `src/components/primitives/dialog.tsx`: that primitive is a full modal
 * with a scrim and a body scroll lock, which is right for a dialog and wrong
 * for a chrome popover that must leave the page behind it live and scrollable.
 * The nonmodal half is the majority case here, so the popover is not a dialog
 * with its modality removed.
 */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useLayer<T extends HTMLElement>({
  open,
  onClose,
  modal,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  modal: boolean;
  triggerRef: RefObject<HTMLElement | null>;
}): RefObject<T | null> {
  const layerRef = useRef<T | null>(null);
  const wasOpen = useRef(false);

  // Focus returns to the control that opened the layer, always, and only when
  // the layer was actually open — never on first mount.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    triggerRef.current?.focus();
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (layerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      // A modal sheet keeps Tab inside it. A nonmodal popover does not — the
      // page behind it is still the page.
      if (!modal || event.key !== "Tab") return;
      const layer = layerRef.current;
      if (!layer) return;
      const items = [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose, modal, triggerRef]);

  return layerRef;
}
