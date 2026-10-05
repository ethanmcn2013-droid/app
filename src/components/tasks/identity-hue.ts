/**
 * A steady colour for a project, a person or a label, from its id: identity,
 * never status. The hues and the hash are the sidebar's own rule for
 * projects (`projectColor` in src/components/shell/app-sidebar.tsx), so the
 * project pill here matches the sidebar; they are restated rather than
 * imported so the Tasks views do not pull the sidebar into their bundle.
 * Amber (5), orange (6), red (7) and pink (8) are left out so an assigned
 * colour never reads as a warning or as late work.
 */
const HUES = [1, 2, 3, 4, 9];

export function identityHue(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return `var(--v3-project-${HUES[hash % HUES.length]})`;
}
