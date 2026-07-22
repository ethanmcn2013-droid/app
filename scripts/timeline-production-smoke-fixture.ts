/**
 * Temporary production-smoke fixture for Timeline's unlisted artifact route.
 *
 * The bearer token is written once to an operator-chosen state file and is
 * never printed. Remote writes require an explicit acknowledgement plus an
 * existing database checkpoint. Read-only inspection needs neither.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";

const SCRIPT_VERSION = 1 as const;
const FIXTURE_PREFIX = "signal-timeline-release-smoke:v1:";
const FIXTURE_WORKSPACE = "signal-release-smoke";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const REQUIRED_TABLES = [
  "timeline_publications",
  "timeline_publication_items",
  "audience_shares",
  "audience_view_receipts",
] as const;

export type SmokeState = Readonly<{
  version: typeof SCRIPT_VERSION;
  runId: string;
  publicationId: string;
  sourceMarker: string;
  sourceDigest: string;
  rawToken: string;
  routePath: string;
  createdAt: string;
}>;

export type SmokeItem = Readonly<{
  publicId: string;
  title: string;
  calendarDate: string;
  state: "covered" | "now" | "next" | "later";
  sortOrder: number;
  sourceDigest: string;
}>;

export type SmokeFixture = Readonly<{
  state: SmokeState;
  tokenHash: string;
  primaryDate: string;
  nowEpoch: number;
  items: readonly SmokeItem[];
}>;

export type SmokeInspection = Readonly<{
  publicationId: string;
  publicationState: string;
  qualifiedViewCount: number;
  lastQualifiedViewAtEpoch: number | null;
  receiptCount: number;
  itemCount: number;
  activeShareCount: number;
  totalShareCount: number;
  totalShareVisits: number;
}>;

type WriteSafety = Readonly<{
  apply: boolean;
  acknowledgeRemoteWrite: boolean;
  checkpointPath: string | null;
}>;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function dateAtOffset(now: Date, days: number): string {
  const shifted = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
  return shifted.toISOString().slice(0, 10);
}

export function isRemoteTimelineUrl(value: string): boolean {
  return value.startsWith("libsql:") || /(^|\.)turso\.io(?:[/:]|$)/i.test(value);
}

/** Throws rather than exiting so the production guard is directly testable. */
export function assertWriteSafety(databaseUrl: string, safety: WriteSafety): void {
  if (!safety.apply || !isRemoteTimelineUrl(databaseUrl)) return;
  if (!safety.acknowledgeRemoteWrite) {
    throw new Error(
      "Remote write refused. Add --acknowledge-remote-write after reviewing the target.",
    );
  }
  if (!safety.checkpointPath || !existsSync(safety.checkpointPath)) {
    throw new Error(
      "Remote write refused. --checkpoint must name an existing pre-write snapshot.",
    );
  }
}

export function buildSmokeFixture(
  options: Readonly<{
    runId?: string;
    rawToken?: string;
    now?: Date;
  }> = {},
): SmokeFixture {
  const runId = options.runId ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(runId)) {
    throw new TypeError("Smoke run id must be a UUID");
  }
  const rawToken = options.rawToken ?? randomBytes(32).toString("base64url");
  if (!TOKEN_RE.test(rawToken)) {
    throw new TypeError("Smoke bearer token must be a 256-bit base64url value");
  }
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("Smoke time is invalid");

  const publicationId = `timeline-release-smoke-${runId}`;
  const sourceMarker = `${FIXTURE_PREFIX}${runId}`;
  const sourceDigest = sha256(sourceMarker);
  const itemSpecs = [
    ["We said yes", -170, "covered"],
    ["The Orchard reserved", -92, "covered"],
    ["Menu tasting at The Orchard", 10, "now"],
    ["Send the invitations", 24, "next"],
    ["Meet the photographer", 34, "next"],
    ["Finalise the flowers", 44, "later"],
    ["Confirm the guest list", 54, "later"],
    ["The final walk-through", 65, "later"],
    ["Wedding day", 73, "later"],
  ] as const;
  const items = itemSpecs.map(([title, offset, state], index) => ({
    publicId: `timeline-release-smoke-item-${runId}-${index + 1}`,
    title,
    calendarDate: dateAtOffset(now, offset),
    state,
    sortOrder: index,
    sourceDigest: sha256(`${sourceMarker}:item:${index + 1}`),
  }));

  return {
    state: {
      version: SCRIPT_VERSION,
      runId,
      publicationId,
      sourceMarker,
      sourceDigest,
      rawToken,
      routePath: `/s/${rawToken}`,
      createdAt: now.toISOString(),
    },
    tokenHash: sha256(rawToken),
    primaryDate: dateAtOffset(now, 73),
    nowEpoch: Math.floor(now.getTime() / 1_000),
    items,
  };
}

export function parseSmokeState(value: unknown): SmokeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Smoke state must be an object");
  }
  const candidate = value as Record<string, unknown>;
  const keys = [
    "version",
    "runId",
    "publicationId",
    "sourceMarker",
    "sourceDigest",
    "rawToken",
    "routePath",
    "createdAt",
  ];
  if (
    Object.keys(candidate).length !== keys.length ||
    keys.some((key) => !(key in candidate))
  ) {
    throw new TypeError("Smoke state has an unexpected shape");
  }
  if (candidate.version !== SCRIPT_VERSION) {
    throw new TypeError("Smoke state version is unsupported");
  }
  if (keys.slice(1).some((key) => typeof candidate[key] !== "string")) {
    throw new TypeError("Smoke state contains an invalid field");
  }
  const runId = candidate.runId as string;
  const rawToken = candidate.rawToken as string;
  const expectedMarker = `${FIXTURE_PREFIX}${runId}`;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(runId)) {
    throw new TypeError("Smoke state run id is invalid");
  }
  if (!TOKEN_RE.test(rawToken)) throw new TypeError("Smoke state token is invalid");
  if (candidate.publicationId !== `timeline-release-smoke-${runId}`) {
    throw new TypeError("Smoke state publication id does not match its run id");
  }
  if (candidate.sourceMarker !== expectedMarker) {
    throw new TypeError("Smoke state source marker does not match its run id");
  }
  if (candidate.sourceDigest !== sha256(expectedMarker)) {
    throw new TypeError("Smoke state source digest is invalid");
  }
  if (candidate.routePath !== `/s/${rawToken}`) {
    throw new TypeError("Smoke state route does not match its bearer token");
  }
  if (!Number.isFinite(Date.parse(candidate.createdAt as string))) {
    throw new TypeError("Smoke state creation time is invalid");
  }
  return candidate as SmokeState;
}

export function readSmokeState(path: string): SmokeState {
  return parseSmokeState(JSON.parse(readFileSync(path, "utf8")));
}

export function writeSmokeState(path: string, state: SmokeState): void {
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

export async function assertTimelineSmokeSchema(client: Client): Promise<void> {
  const rows = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?)",
    args: [...REQUIRED_TABLES],
  });
  const names = new Set(rows.rows.map((row) => String(row.name)));
  const missing = REQUIRED_TABLES.filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`Timeline smoke schema is incomplete: missing ${missing.join(", ")}`);
  }
  const columns = await client.execute("PRAGMA table_info(timeline_publications)");
  const columnNames = new Set(columns.rows.map((row) => String(row.name)));
  for (const required of ["qualified_view_count", "last_qualified_view_at"]) {
    if (!columnNames.has(required)) {
      throw new Error(`Timeline smoke schema is missing ${required}`);
    }
  }
}

async function assertFixtureOwnership(
  client: Client,
  state: SmokeState,
): Promise<void> {
  const publication = await client.execute({
    sql: `SELECT id, workspace_slug, source_object_id, source_digest
          FROM timeline_publications WHERE id = ?`,
    args: [state.publicationId],
  });
  if (publication.rows.length !== 1) {
    throw new Error("Synthetic Timeline publication was not found");
  }
  const row = publication.rows[0];
  if (
    row?.workspace_slug !== FIXTURE_WORKSPACE ||
    row?.source_object_id !== state.sourceMarker ||
    row?.source_digest !== state.sourceDigest
  ) {
    throw new Error("Cleanup refused: publication does not carry the exact smoke marker");
  }
  const shares = await client.execute({
    sql: `SELECT COUNT(*) AS count FROM audience_shares
          WHERE publication_id = ? AND token_hash = ?`,
    args: [state.publicationId, sha256(state.rawToken)],
  });
  if (Number(shares.rows[0]?.count ?? 0) !== 1) {
    throw new Error("Cleanup refused: smoke bearer digest does not match exactly one share");
  }
}

export async function createSmokeFixture(
  client: Client,
  fixture: SmokeFixture,
  apply: boolean,
): Promise<void> {
  await assertTimelineSmokeSchema(client);
  const existing = await client.execute({
    sql: `SELECT COUNT(*) AS count FROM timeline_publications
          WHERE id = ? OR source_object_id = ?`,
    args: [fixture.state.publicationId, fixture.state.sourceMarker],
  });
  if (Number(existing.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Smoke fixture already exists; inspect or clean it before retrying");
  }
  if (!apply) return;

  const publication = {
    sql: `INSERT INTO timeline_publications (
            id, workspace_slug, source_workspace_id, source_object_id,
            source_revision, source_digest, label, primary_date_label,
            primary_date, audience_kind, timezone, owner_display_label,
            state, last_updated_at, created_at, updated_at, published_at,
            qualified_view_count
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 0)`,
    args: [
      fixture.state.publicationId,
      FIXTURE_WORKSPACE,
      fixture.state.sourceMarker,
      fixture.state.sourceMarker,
      fixture.state.sourceDigest,
      "Mara & Finn",
      "Wedding day",
      fixture.primaryDate,
      "couple",
      "Europe/London",
      "Shared by Mara & Finn",
      fixture.nowEpoch,
      fixture.nowEpoch,
      fixture.nowEpoch,
      fixture.nowEpoch,
    ],
  };
  const itemStatements = fixture.items.map((item) => ({
    sql: `INSERT INTO timeline_publication_items (
            public_id, publication_id, title, calendar_date, state, sort_order,
            source_relation, source_digest, copied_at, published_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      item.publicId,
      fixture.state.publicationId,
      item.title,
      item.calendarDate,
      item.state,
      item.sortOrder,
      fixture.state.sourceMarker,
      item.sourceDigest,
      fixture.nowEpoch,
      fixture.nowEpoch,
      fixture.nowEpoch,
    ],
  }));
  const share = {
    sql: `INSERT INTO audience_shares (
            id, publication_id, token_hash, state, version, created_at, visit_count
          ) VALUES (?, ?, ?, 'active', 1, ?, 0)`,
    args: [
      `timeline-release-smoke-share-${fixture.state.runId}`,
      fixture.state.publicationId,
      fixture.tokenHash,
      fixture.nowEpoch,
    ],
  };
  await client.batch([publication, ...itemStatements, share], "write");
}

export async function inspectSmokeFixture(
  client: Client,
  state: SmokeState,
): Promise<SmokeInspection> {
  await assertTimelineSmokeSchema(client);
  await assertFixtureOwnership(client, state);
  const result = await client.execute({
    sql: `SELECT
            p.id AS publication_id,
            p.state AS publication_state,
            p.qualified_view_count,
            p.last_qualified_view_at,
            (SELECT COUNT(*) FROM audience_view_receipts r
              WHERE r.publication_id = p.id) AS receipt_count,
            (SELECT COUNT(*) FROM timeline_publication_items i
              WHERE i.publication_id = p.id) AS item_count,
            (SELECT COUNT(*) FROM audience_shares s
              WHERE s.publication_id = p.id AND s.state = 'active') AS active_share_count,
            (SELECT COUNT(*) FROM audience_shares s
              WHERE s.publication_id = p.id) AS total_share_count,
            (SELECT COALESCE(SUM(s.visit_count), 0) FROM audience_shares s
              WHERE s.publication_id = p.id) AS total_share_visits
          FROM timeline_publications p WHERE p.id = ?`,
    args: [state.publicationId],
  });
  const row = result.rows[0];
  if (!row) throw new Error("Synthetic Timeline publication disappeared during inspection");
  return {
    publicationId: String(row.publication_id),
    publicationState: String(row.publication_state),
    qualifiedViewCount: Number(row.qualified_view_count),
    lastQualifiedViewAtEpoch:
      row.last_qualified_view_at === null
        ? null
        : Number(row.last_qualified_view_at),
    receiptCount: Number(row.receipt_count),
    itemCount: Number(row.item_count),
    activeShareCount: Number(row.active_share_count),
    totalShareCount: Number(row.total_share_count),
    totalShareVisits: Number(row.total_share_visits),
  };
}

export async function revokeSmokeFixture(
  client: Client,
  state: SmokeState,
  apply: boolean,
): Promise<void> {
  await assertTimelineSmokeSchema(client);
  await assertFixtureOwnership(client, state);
  if (!apply) return;
  const nowEpoch = Math.floor(Date.now() / 1_000);
  await client.execute({
    sql: `UPDATE audience_shares SET state = 'revoked', revoked_at = ?
          WHERE publication_id = ? AND token_hash = ? AND state = 'active'`,
    args: [nowEpoch, state.publicationId, sha256(state.rawToken)],
  });
}

export async function cleanupSmokeFixture(
  client: Client,
  state: SmokeState,
  apply: boolean,
): Promise<void> {
  await assertTimelineSmokeSchema(client);
  await assertFixtureOwnership(client, state);
  if (!apply) return;
  await client.batch(
    [
      {
        sql: "DELETE FROM audience_view_receipts WHERE publication_id = ?",
        args: [state.publicationId],
      },
      {
        sql: "DELETE FROM audience_shares WHERE publication_id = ?",
        args: [state.publicationId],
      },
      {
        sql: "DELETE FROM timeline_publication_items WHERE publication_id = ?",
        args: [state.publicationId],
      },
      {
        sql: `DELETE FROM timeline_publications
              WHERE id = ? AND workspace_slug = ? AND source_object_id = ? AND source_digest = ?`,
        args: [
          state.publicationId,
          FIXTURE_WORKSPACE,
          state.sourceMarker,
          state.sourceDigest,
        ],
      },
    ],
    "write",
  );
  const remaining = await client.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM timeline_publications WHERE id = ?) +
            (SELECT COUNT(*) FROM timeline_publication_items WHERE publication_id = ?) +
            (SELECT COUNT(*) FROM audience_shares WHERE publication_id = ?) +
            (SELECT COUNT(*) FROM audience_view_receipts WHERE publication_id = ?) AS count`,
    args: Array(4).fill(state.publicationId),
  });
  if (Number(remaining.rows[0]?.count ?? 0) !== 0) {
    throw new Error("Smoke cleanup verification failed; dependent rows remain");
  }
}

export function redactSmokeSecrets(message: string, secrets: readonly string[]): string {
  let redacted = message;
  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, "[REDACTED]");
  }
  return redacted.replace(/[A-Za-z0-9_-]{43}/g, "[REDACTED_43_CHAR_VALUE]");
}

type CliAction = "create" | "inspect" | "revoke" | "cleanup";

type CliArgs = Readonly<{
  action: CliAction;
  stateFile: string;
  apply: boolean;
  acknowledgeRemoteWrite: boolean;
  checkpointPath: string | null;
}>;

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) throw new TypeError(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
  const actions: CliAction[] = ["create", "inspect", "revoke", "cleanup"].filter(
    (action) => flags.has(action) || (action === "inspect" && flags.has("query")),
  ) as CliAction[];
  if (actions.length !== 1) {
    throw new TypeError("Choose exactly one action: --create, --inspect, --revoke, or --cleanup");
  }
  const suppliedStateFile = values.get("state-file");
  if (!suppliedStateFile || !isAbsolute(suppliedStateFile)) {
    throw new TypeError("--state-file must be an absolute path");
  }
  return {
    action: actions[0]!,
    stateFile: resolve(suppliedStateFile),
    apply: flags.has("apply"),
    acknowledgeRemoteWrite: flags.has("acknowledge-remote-write"),
    checkpointPath: values.get("checkpoint") ?? null,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.TIMELINE_DATABASE_URL ?? "file:roadmap.db";
  const authToken = process.env.TIMELINE_AUTH_TOKEN;
  if (isRemoteTimelineUrl(databaseUrl) && !authToken) {
    throw new Error("TIMELINE_AUTH_TOKEN is required for the remote Timeline database");
  }
  if (args.action !== "inspect") {
    assertWriteSafety(databaseUrl, {
      apply: args.apply,
      acknowledgeRemoteWrite: args.acknowledgeRemoteWrite,
      checkpointPath: args.checkpointPath,
    });
  }
  const client = createClient({ url: databaseUrl, authToken });
  let state: SmokeState | null = null;
  try {
    if (args.action === "create") {
      if (existsSync(args.stateFile)) {
        throw new Error("Create refused: the state file already exists");
      }
      const fixture = buildSmokeFixture();
      state = fixture.state;
      await createSmokeFixture(client, fixture, args.apply);
      if (!args.apply) {
        console.log("[dry-run] Timeline smoke fixture passed schema and collision checks; no rows or token file were written.");
        return;
      }
      try {
        writeSmokeState(args.stateFile, state);
      } catch (error) {
        await cleanupSmokeFixture(client, state, true);
        throw new Error(
          `State-file write failed; inserted smoke rows were rolled back: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      console.log(`Created synthetic Timeline publication ${state.publicationId}.`);
      console.log(`Bearer material was written only to ${args.stateFile}.`);
      return;
    }

    state = readSmokeState(args.stateFile);
    if (args.action === "inspect") {
      console.log(JSON.stringify(await inspectSmokeFixture(client, state), null, 2));
      return;
    }
    if (args.action === "revoke") {
      await revokeSmokeFixture(client, state, args.apply);
      console.log(
        args.apply
          ? `Revoked the synthetic link for ${state.publicationId}.`
          : `[dry-run] Verified exact ownership for ${state.publicationId}; no share was revoked.`,
      );
      return;
    }
    await cleanupSmokeFixture(client, state, args.apply);
    if (!args.apply) {
      console.log(`[dry-run] Verified exact ownership for ${state.publicationId}; no rows were deleted.`);
      return;
    }
    unlinkSync(args.stateFile);
    console.log("Deleted the synthetic publication and its dependent rows.");
    console.log(`Removed the local bearer state file ${args.stateFile}.`);
  } catch (error) {
    const secrets = [authToken ?? "", state?.rawToken ?? ""];
    throw new Error(
      redactSmokeSecrets(error instanceof Error ? error.message : String(error), secrets),
    );
  } finally {
    client.close();
  }
}

const isEntryPoint =
  typeof process.argv[1] === "string" &&
  (() => {
    try {
      return fileURLToPath(import.meta.url) === resolve(process.argv[1]!);
    } catch {
      return false;
    }
  })();

if (isEntryPoint) {
  main().catch((error: unknown) => {
    const authToken = process.env.TIMELINE_AUTH_TOKEN ?? "";
    const message = error instanceof Error ? error.message : String(error);
    console.error(`timeline-production-smoke-fixture: ${redactSmokeSecrets(message, [authToken])}`);
    process.exitCode = 1;
  });
}
