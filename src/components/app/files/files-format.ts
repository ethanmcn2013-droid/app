/** Pure formatting for the Files page; shared by the server view and the client browser. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "16 Jul" style, computed in UTC so server and client agree. */
export function formatAddedDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
