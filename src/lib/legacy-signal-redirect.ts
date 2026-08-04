/**
 * Legacy /app/signal → /app/home/briefing forwarding.
 *
 * Signal left the product line, not the product: the brief lives on as
 * the Full Briefing inside Home. These helpers keep old links, bookmarks
 * and notification deep-links working with their query state (scope,
 * evidence, planning-period params) intact.
 */
export function legacySignalTarget(
  target: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }
  const qs = query.toString();
  return qs ? `${target}?${qs}` : target;
}
