/** Move a column to the target's position. Unknown keys cannot change config. */
export function reorderColumn(keys: readonly string[], fromKey: string, toKey: string): string[] | null {
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...keys];
  const [key] = next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}
