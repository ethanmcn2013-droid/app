/**
 * hasOpenLayer — true while a dismissable layered surface is open.
 *
 * Escape-to-close containers (the task panel shell, the focus shell) register
 * their document keydown listener before any menu or popover inside them, so
 * they see Escape first and would dismiss themselves together with the layer.
 * They call this before closing: Radix menus portal into
 * [data-radix-popper-content-wrapper]; the field Popover renders a nested
 * [role="dialog"] inside the container.
 */
export function hasOpenLayer(container?: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-radix-popper-content-wrapper]")) return true;
  const scope = container ?? document.body;
  // The panel aside is itself role="dialog"; only NESTED dialogs (field
  // popovers) count as layers, so query within the container when given.
  const dialogs = scope.querySelectorAll('[role="dialog"]');
  for (const dialog of dialogs) {
    if (container && dialog === container) continue;
    if (!container && dialog.getAttribute("aria-modal") === "true") continue;
    return true;
  }
  return false;
}
