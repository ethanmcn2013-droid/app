/** The digest is a rolling window, not the viewer's calendar day. */
export function digestWindow(now: Date): { previousStart: Date; nextEnd: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    previousStart: new Date(now.getTime() - dayMs),
    nextEnd: new Date(now.getTime() + dayMs),
  };
}
