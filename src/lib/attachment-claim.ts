/**
 * How an attachment gets its id, its filename and its place in the store.
 *
 * These three were duplicated between `uploadAttachmentAction` and the
 * client-direct upload path, which is the shape a divergence takes: the
 * pathname a token is minted for and the pathname the fallback writes to
 * have to be composed the same way, or the two paths file the same board's
 * files in two different places.
 *
 * Pure and dependency-free on purpose. `safeFilename` is a boundary
 * control — it is the only thing between a filename a person typed and a
 * storage pathname — so it must be testable without a database, a store,
 * or `server-only` behind it.
 */

/**
 * The workspace-prefixed key an attachment's bytes live under, in both
 * backends: `<workspaceId>/<taskId>/<attachmentId>-<filename>`.
 *
 * The workspace id here must always be one the caller has PROVED, never
 * one it supplied. On the client-direct path this string is what the
 * upload token is locked to, so a wrong id would not merely mis-file the
 * bytes — it would authorize a browser to write into another board.
 */
export function claimPathname(
  workspaceId: string,
  taskId: string,
  attachmentId: string,
  filename: string,
): string {
  return `${workspaceId}/${taskId}/${attachmentId}-${filename}`;
}

/**
 * Strip path separators and anything outside [a-zA-Z0-9._-].
 *
 * Leading dots go too: a name that sanitizes to `..` or `.` is a traversal
 * segment, not a file. A name that sanitizes to nothing still has to be
 * something, or the pathname ends on its separator.
 */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  const trimmed = cleaned.replace(/^\.+/, "");
  return trimmed.length > 0 ? trimmed : "file.bin";
}

/** A fresh attachment id. Server-generated, never accepted from a caller. */
export function newAttachmentId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `att-${raw.replace(/-/g, "").slice(0, 8)}`;
}

/**
 * Read the attachment id back out of a storage pathname.
 *
 * The browser learns which claim its bytes landed in from the pathname the
 * store confirmed, rather than from state it kept — so a retried or
 * resumed upload finalizes the claim that actually holds the file.
 */
export function claimIdFromPathname(pathname: string): string {
  const last = pathname.split("/").pop() ?? "";
  const dash = last.indexOf("-");
  return dash > 0 ? last.slice(0, dash) : last;
}
