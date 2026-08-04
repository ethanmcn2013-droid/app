/**
 * E06.01 / E06.02 / E06.06 — the couple's public artifact content model,
 * proven on a serialised DTO rather than on the constants that are supposed
 * to produce one.
 *
 * Three things are pinned here:
 *
 *   E06.01  what may cross the boundary, and the one free-text identity
 *           string on it — `ownerDisplayLabel` — held to a name shape.
 *   E06.02  a milestone left out of the selection is never copied, a hidden
 *           milestone is refused at selection, and a milestone published
 *           without a date carries no `date` key at all.
 *   E06.06  the couple can take the main date off an already published page,
 *           and the key genuinely disappears from the payload.
 *
 * Behavioural, like `unpublished-timeline-boundary.test.ts`: the real
 * `createAudiencePublication` and `resolveAudienceTimeline` run against a real
 * libSQL database created from the committed Timeline baseline migration. Env
 * is set before the dynamic import because the Timeline client builds its
 * connection at module load.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/modules/timeline/server/couple-artifact-boundary.test.ts
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

/**
 * A file-backed database, not `:memory:`. The libSQL sqlite3 client drops its
 * connection when a transaction opens and reopens on next use, and a reopened
 * `:memory:` database is a different, empty one — so every publish, which is
 * transactional, would silently lose the schema. Found by running it.
 */
const TMP_DIR = mkdtempSync(join(tmpdir(), "signal-couple-artifact-"));
const TMP_DB = join(TMP_DIR, "timeline.db").replaceAll("\\", "/");

process.env.SIGNAL_ACCESS_MODE = "development";
process.env.TIMELINE_DATABASE_URL = `file:${TMP_DB}`;
delete process.env.TIMELINE_AUTH_TOKEN;
delete process.env.NEXT_PUBLIC_DEMO_MODE;
delete process.env.DEMO_MODE;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

type TimelineModule = typeof import("./audience-timeline");
type ClientModule = typeof import("./db/timeline-client");
type LibModule = typeof import("../lib/audience-timeline");

let audience: TimelineModule;
let dbModule: ClientModule;
let lib: LibModule;

const WORKSPACE_SLUG = "mara-and-finn";
/** Manual nodes need no Tasks provenance, so the whole fixture lives in
 *  `node_overlays` and the publication path runs unmodified. */
const SOURCE_AUTHORITY = {
  kind: "manual-local",
  sourceWorkspaceId: `timeline:${WORKSPACE_SLUG}`,
} as const;

const NODE_DATED = "manual:our-wedding:ceremony";
const NODE_UNDATED = "manual:our-wedding:dress";
const NODE_PRIVATE = "manual:our-wedding:budget";
const NODE_HIDDEN = "manual:our-wedding:hen";

async function run(sql: string): Promise<void> {
  const { sql: raw } = await import("drizzle-orm");
  await dbModule.db.run(raw.raw(sql));
}

async function insertManualNode(input: {
  nodeId: string;
  title: string;
  targetDate: string | null;
  hidden?: boolean;
}): Promise<void> {
  await run(`
    INSERT INTO node_overlays
      (workspace_slug, node_id, hidden, label_override, lane_override,
       date_override, sort_override, source, manual_title, manual_status,
       manual_target_date, created_at, updated_at)
    VALUES
      ('${WORKSPACE_SLUG}', '${input.nodeId}', ${input.hidden ? 1 : 0}, NULL, NULL,
       ${input.targetDate === null ? "'__signal_timeline_undated__'" : "NULL"}, 0,
       'manual', '${input.title}', 'next',
       ${input.targetDate === null ? "NULL" : `'${input.targetDate}'`},
       unixepoch(), unixepoch())
  `);
}

/** Publish a draft and return the raw bearer token for it. */
async function publish(publicationId: string): Promise<string> {
  return audience.publishAudiencePublication(publicationId, WORKSPACE_SLUG, null);
}

before(async () => {
  dbModule = await import("./db/timeline-client");
  audience = await import("./audience-timeline");
  lib = await import("../lib/audience-timeline");

  const baseline = readFileSync(
    new URL("../../../../drizzle-timeline/0000_timeline_baseline.sql", import.meta.url),
    "utf8",
  );
  for (const statement of baseline.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    await run(trimmed);
  }

  await run(`
    INSERT INTO workspaces (slug, name, owner_user_id, plan, created_at)
    VALUES ('${WORKSPACE_SLUG}', 'Mara and Finn', 'user-owner', 'free', unixepoch())
  `);
  await run(`
    INSERT INTO projects
      (workspace_slug, slug, name, one_liner, accent, sort_order, published_at)
    VALUES
      ('${WORKSPACE_SLUG}', 'our-wedding', 'Our wedding', 'The plan', 'accent', 0, unixepoch())
  `);

  await insertManualNode({
    nodeId: NODE_DATED,
    title: "The ceremony",
    targetDate: "2027-06-19",
  });
  await insertManualNode({
    nodeId: NODE_UNDATED,
    title: "Find the dress",
    targetDate: null,
  });
  await insertManualNode({
    nodeId: NODE_PRIVATE,
    title: "Agree the budget with Dad",
    targetDate: "2026-09-30",
  });
  await insertManualNode({
    nodeId: NODE_HIDDEN,
    title: "The hen",
    targetDate: "2027-05-01",
    hidden: true,
  });
});

after(() => {
  // Windows keeps the libSQL handle open past the last assertion. A leftover
  // file in the OS temp directory is not worth failing a privacy suite over.
  try {
    rmSync(TMP_DIR, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* the OS will reap it */
  }
});

// ---------------------------------------------------------------- E06.01 ---

test("E06.01 · the published DTO carries only the allowlisted top-level keys", async () => {
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: "2027-06-19",
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED, NODE_UNDATED],
  });
  const token = await publish(publicationId);

  const result = await audience.resolveAudienceTimeline(token);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;

  assert.deepEqual(Object.keys(result.dto).sort(), [
    "audienceKind",
    "label",
    "lastUpdatedAt",
    "ownerDisplayLabel",
    "primaryDate",
    "publicationId",
    "sections",
    "today",
    "version",
  ]);

  // Nothing that identifies the private plan, its source or the venue.
  const serialised = JSON.stringify(result.dto);
  for (const forbidden of [
    "sourceWorkspaceId",
    "source_workspace_id",
    "sourceRelation",
    "sourceDigest",
    "workspaceSlug",
    "ownerUserId",
    "ownerEmail",
    "sponsor",
    "attachments",
    "description",
    WORKSPACE_SLUG,
    NODE_DATED,
    "timeline:mara-and-finn",
  ]) {
    assert.ok(
      !serialised.includes(forbidden),
      `the couple's DTO leaked "${forbidden}"`,
    );
  }
});

test("E06.01 · a shared name carrying a home address never reaches a public page", () => {
  // Refused at the projection layer, not only at the form, so a row written
  // before this rule existed cannot render either.
  for (const label of [
    "Mara and Finn, 14 Ashbourne Rise, V94 XY12",
    "Mara and Finn 087 555 0100",
    "mara@example.com",
    "https://example.com/mara",
    "Mara and Finn · 2027",
  ]) {
    assert.throws(
      () =>
        lib.validateAudienceTimelineDto({
          version: 1,
          audienceKind: "couple",
          publicationId: "pub-1",
          label: "Our wedding",
          ownerDisplayLabel: label,
          lastUpdatedAt: "2026-08-03T00:00:00.000Z",
          today: "2026-08-03",
          sections: [],
        }),
      /ownerDisplayLabel is not a shared name/,
      `expected "${label}" to be refused`,
    );
    assert.equal(lib.isCoupleDisplayLabel(label), false);
  }
});

test("E06.01 · real couple names still pass, and other audiences keep the old rule", () => {
  for (const label of [
    "Mara and Finn",
    "Mara & Finn",
    "Máire Ní Bhriain and Seán O'Donnell",
    "Anne-Marie and Jo",
  ]) {
    assert.equal(lib.isCoupleDisplayLabel(label), true, label);
  }

  // A class timeline may legitimately be called "Year 3, 2027". The digit rule
  // is a property of the couple artifact, not of the field.
  const dto = lib.validateAudienceTimelineDto({
    version: 1,
    audienceKind: "class",
    publicationId: "pub-2",
    label: "Leaving Cert 2027",
    ownerDisplayLabel: "Year 3, 2027",
    lastUpdatedAt: "2026-08-03T00:00:00.000Z",
    today: "2026-08-03",
    sections: [],
  });
  assert.equal(dto.ownerDisplayLabel, "Year 3, 2027");
});

// ---------------------------------------------------------------- E06.02 ---

test("E06.02 · private · a milestone left out of the selection is never copied", async () => {
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: "2027-06-19",
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED],
  });
  const token = await publish(publicationId);

  const result = await audience.resolveAudienceTimeline(token);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;

  const titles = result.dto.sections.flatMap((section) =>
    section.items.map((item) => item.title),
  );
  assert.deepEqual(titles, ["The ceremony"]);
  assert.ok(
    !JSON.stringify(result.dto).includes("Agree the budget with Dad"),
    "an unselected milestone reached the published payload",
  );
});

test("E06.02 · private · a hidden milestone is refused at selection", async () => {
  await assert.rejects(
    () =>
      audience.createAudiencePublication({
        workspaceSlug: WORKSPACE_SLUG,
        projectSlug: "our-wedding",
        sourceAuthority: SOURCE_AUTHORITY,
        label: "Our wedding",
        audienceKind: "couple",
        ownerDisplayLabel: "Mara and Finn",
        primaryDateLabel: "The day",
        primaryDate: "2027-06-19",
        timezone: "Europe/Dublin",
        selectedSourceIds: [NODE_DATED, NODE_HIDDEN],
      }),
    /not available in this workspace/,
  );
});

test("E06.02 · title-and-date · an undated milestone carries no date key", async () => {
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: "2027-06-19",
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED, NODE_UNDATED],
  });
  const token = await publish(publicationId);

  const result = await audience.resolveAudienceTimeline(token);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;

  const items = result.dto.sections.flatMap((section) => section.items);
  const dress = items.find((item) => item.title === "Find the dress");
  const ceremony = items.find((item) => item.title === "The ceremony");
  assert.ok(dress && ceremony);

  assert.deepEqual(Object.keys(dress).sort(), ["publicId", "state", "title"]);
  assert.ok(!("date" in dress), "an undated milestone emitted a date key");
  assert.deepEqual(Object.keys(ceremony).sort(), [
    "date",
    "publicId",
    "state",
    "title",
  ]);
});

test("E06.02 · image and short-story states have no representation at any layer", () => {
  // Recorded as a failing capability rather than a passing one. If either
  // state is ever built, this test goes red and has to be rewritten
  // deliberately — which is the point.
  const libSource = readFileSync(
    new URL("../lib/audience-timeline.ts", import.meta.url),
    "utf8",
  );
  const schemaSource = readFileSync(
    new URL("./db/timeline-schema.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    !/ITEM_KEYS[^)]*"(image|imageUrl|story)"/.test(libSource),
    "ITEM_KEYS gained an image or story key without the content model being updated",
  );
  assert.ok(
    !/timeline_publication_items[\s\S]{0,2000}(image_url|story_body)/.test(schemaSource),
    "timeline_publication_items gained an image or story column",
  );
});

// ---------------------------------------------------------------- E06.06 ---

test("E06.06 · hiding the main date removes the key from the published payload", async () => {
  // A wedding date deliberately different from every published milestone date,
  // so "the string is gone" means the main date and nothing else.
  const WEDDING_DAY = "2027-08-14";
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: WEDDING_DAY,
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED],
  });
  const token = await publish(publicationId);

  const before_ = await audience.resolveAudienceTimeline(token);
  assert.equal(before_.kind, "ok");
  if (before_.kind !== "ok") return;
  assert.deepEqual(before_.dto.primaryDate, {
    label: "The day",
    date: WEDDING_DAY,
  });

  const outcome = await audience.setAudiencePrimaryDate({
    publicationId,
    workspaceSlug: WORKSPACE_SLUG,
    primaryDateLabel: null,
    primaryDate: null,
  });
  assert.equal(outcome, "concealed");

  // Fresh token so the per-request cache around resolveAudienceTimeline
  // cannot return the pre-concealment DTO.
  const rotated = await audience.rotateAudienceShare(
    publicationId,
    WORKSPACE_SLUG,
    null,
  );
  const after = await audience.resolveAudienceTimeline(rotated);
  assert.equal(after.kind, "ok");
  if (after.kind !== "ok") return;

  assert.ok(
    !("primaryDate" in after.dto),
    "the concealed date was still present as a key",
  );
  assert.ok(
    !JSON.stringify(after.dto).includes(WEDDING_DAY),
    "the concealed wedding date was still in the payload",
  );
  assert.ok(!JSON.stringify(after.dto).includes("The day"));
});

test("E06.06 · a half-set pair conceals rather than publishing a partial date", async () => {
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: "2027-06-19",
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED],
  });
  const token = await publish(publicationId);
  assert.equal((await audience.resolveAudienceTimeline(token)).kind, "ok");

  const outcome = await audience.setAudiencePrimaryDate({
    publicationId,
    workspaceSlug: WORKSPACE_SLUG,
    primaryDateLabel: "The day",
    primaryDate: null,
  });
  assert.equal(outcome, "concealed");

  const rotated = await audience.rotateAudienceShare(
    publicationId,
    WORKSPACE_SLUG,
    null,
  );
  const after = await audience.resolveAudienceTimeline(rotated);
  assert.equal(after.kind, "ok");
  if (after.kind !== "ok") return;
  assert.ok(!("primaryDate" in after.dto));
});

test("E06.06 · concealment is owner-scoped: another workspace cannot touch it", async () => {
  const publicationId = await audience.createAudiencePublication({
    workspaceSlug: WORKSPACE_SLUG,
    projectSlug: "our-wedding",
    sourceAuthority: SOURCE_AUTHORITY,
    label: "Our wedding",
    audienceKind: "couple",
    ownerDisplayLabel: "Mara and Finn",
    primaryDateLabel: "The day",
    primaryDate: "2027-06-19",
    timezone: "Europe/Dublin",
    selectedSourceIds: [NODE_DATED],
  });
  await assert.rejects(
    () =>
      audience.setAudiencePrimaryDate({
        publicationId,
        workspaceSlug: "someone-else",
        primaryDateLabel: null,
        primaryDate: null,
      }),
    /Publication not found/,
  );
});

test("E06.06 · the shared page's social preview carries no concealable value", () => {
  // A concealed date must not survive in an unfurl. `/s/[token]` builds its
  // title, description and OpenGraph card from the label and the audience
  // kind only, and never from the date or the couple's name.
  const source = readFileSync(
    new URL("../../../app/s/[token]/page.tsx", import.meta.url),
    "utf8",
  );
  for (const forbidden of ["primaryDate", "ownerDisplayLabel"]) {
    assert.ok(
      !source.includes(forbidden),
      `/s/[token] metadata referenced "${forbidden}"`,
    );
  }
  // Positive statement of the noindex posture, so a widening is loud.
  assert.ok(source.includes("robots: { index: false, follow: false"));
});
