import { and, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { shareLinks, workspaces } from "./schema";
import * as schema from "./schema";
import {
  hashShareToken,
  isResolvableShareToken,
  shareHashesEqual,
} from "@/server/share-token";

/**
 * The share-link credential check, alone in its own file.
 *
 * It lives here rather than in `queries.ts` for two reasons. It is a security
 * control and should be readable end to end without scrolling past a thousand
 * lines of board queries. And `queries.ts` is `server-only`, which makes it
 * unimportable from the test runner — a security control nobody can test
 * directly is a security control nobody has tested.
 *
 * That second reason is why this module imports NO server-only code, not even
 * transitively: it takes its database as an argument. The same seam shape as
 * `recordQualifiedViewWith` in the Timeline module, and for the same reason.
 * An earlier draft imported `db` from `./index`, which re-introduced
 * `server-only` through the back door and made the whole suite unloadable.
 * Keep this file free of `./index`.
 */

/** What a resolved share row exposes. `publicId` is the non-secret row key
 *  (`share_links.token`); the guest's secret is deliberately absent. */
export type ResolvedShareLinkRow = {
  publicId: string;
  view: "board" | "list" | "timeline" | "calendar";
  revokedAt: Date | null;
  expiresAt: Date | null;
  workspaceId: string;
  activeDomain: string | null;
  scheme: "plaintext" | "sha256";
};

export type ShareLinkDatabase = Pick<
  LibSQLDatabase<typeof schema>,
  "select"
>;

/**
 * Resolve a guest secret to its share row, or null.
 *
 * E08.06 / R-033. The secret is hashed before it touches the database, so
 * `share_links` never stores a value that grants access. Two branches, and
 * the order matters:
 *
 *   1. **Current.** Match `token_hash` — a unique index, so at most one row
 *      can ever come back — then re-compare the digests in constant time.
 *      The second compare is not redundant: it is the same pairing Timeline's
 *      `qualified-view-store.ts` already uses, and it is what stops a future
 *      change to the lookup (a LIKE, a prefix index, a cache) from silently
 *      becoming a partial match.
 *   2. **Legacy, during cutover only.** Rows minted before migration 0027
 *      still hold the secret in `token` and read `token_scheme = 'plaintext'`.
 *      They are matched by equality because there is nothing else to match
 *      on. This branch is what keeps every live link working while the
 *      backfill runs, and it is the reason the plaintext exposure is reduced
 *      rather than closed until
 *      `scripts/db/backfill-share-link-token-hashes.mjs` reports zero
 *      plaintext rows. Delete this branch then, and not before.
 *
 * The INNER JOIN is deliberate in both branches: a share row never revives an
 * absent Workspace, and archived work is private until restored.
 *
 * The database handle is injected so this can be exercised against a real
 * SQLite file rather than asserted about. Same seam shape as
 * `recordQualifiedViewWith` in the Timeline module.
 */
export async function resolveShareLinkRowWith(
  database: ShareLinkDatabase,
  secret: string,
): Promise<ResolvedShareLinkRow | null> {
  if (!isResolvableShareToken(secret)) return null;
  const wanted = hashShareToken(secret);

  const columns = {
    publicId: shareLinks.token,
    tokenHash: shareLinks.tokenHash,
    scheme: shareLinks.tokenScheme,
    view: shareLinks.view,
    revokedAt: shareLinks.revokedAt,
    expiresAt: shareLinks.expiresAt,
    workspaceId: workspaces.id,
    activeDomain: workspaces.activeDomain,
  };

  const [hashed] = await database
    .select(columns)
    .from(shareLinks)
    .innerJoin(workspaces, eq(workspaces.id, shareLinks.workspaceId))
    .where(and(eq(shareLinks.tokenHash, wanted), isNull(workspaces.archivedAt)));

  if (hashed) {
    if (!hashed.tokenHash || !shareHashesEqual(hashed.tokenHash, wanted)) {
      return null;
    }
    return {
      publicId: hashed.publicId,
      view: hashed.view,
      revokedAt: hashed.revokedAt,
      expiresAt: hashed.expiresAt,
      workspaceId: hashed.workspaceId,
      activeDomain: hashed.activeDomain,
      scheme: hashed.scheme,
    };
  }

  const [legacy] = await database
    .select(columns)
    .from(shareLinks)
    .innerJoin(workspaces, eq(workspaces.id, shareLinks.workspaceId))
    .where(
      and(
        eq(shareLinks.token, secret),
        eq(shareLinks.tokenScheme, "plaintext"),
        isNull(workspaces.archivedAt),
      ),
    );
  if (!legacy) return null;
  return {
    publicId: legacy.publicId,
    view: legacy.view,
    revokedAt: legacy.revokedAt,
    expiresAt: legacy.expiresAt,
    workspaceId: legacy.workspaceId,
    activeDomain: legacy.activeDomain,
    scheme: legacy.scheme,
  };
}
