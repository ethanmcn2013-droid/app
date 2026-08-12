/**
 * Home fixture universe · Notes, and the two sentinels.
 *
 * SECURITY_AND_PRIVACY §1.2. A field-level assertion ("we did not select
 * `body`") proves the wrong thing — it survives the moment someone
 * interpolates a body into a summary, a ranking explanation, a prompt, an
 * error message or a log line. The invariant is a BYTE-LEVEL ABSENCE CHECK
 * over the finished artifact, so every fixture Note carries markers that
 * cannot occur by accident.
 *
 *   body     SS-NOTE-BODY-<32 hex>      at its start AND at its end
 *   extract  SS-NOTE-EXTRACT-<32 hex>
 *
 * Two sentinels, because the extract is allowed out and the body is not: one
 * sentinel cannot tell a correct promotion from a leak.
 */

// ── The prefixes the scanners match on ──────────────────────────────────────

/**
 * 13 characters. The scan matches the PREFIX, not the full value, so a
 * summariser that truncates a body to 40 characters still trips it. Matching
 * the full 32-hex value would let truncation hide a leak.
 */
export const NOTE_BODY_SENTINEL_PREFIX = "SS-NOTE-BODY-";
export const NOTE_EXTRACT_SENTINEL_PREFIX = "SS-NOTE-EXTRACT-";

export type FixtureNote = Readonly<{
  id: string;
  /** Filing metadata only. Never an ownership claim. PROJECT_SCOPE §2.4. */
  filedUnderProjectId: string | null;
  ownerUserId: string;
  title: string;
  /**
   * PRIVATE. This string must never appear in any Home output, on any of the
   * fifteen surfaces enumerated in SECURITY_AND_PRIVACY §1.3.
   */
  body: string;
  /**
   * The creator-authored approved extract, or null when the creator never
   * approved one. The ONLY Note-derived text Home may render, and only with
   * its label.
   */
  extractBody: string | null;
  /** The integrity marker the real promotion edge writes alongside it. */
  extractSha256: string | null;
  /** Which Tasks row the approved extract was promoted onto, if any. */
  promotedToTaskId: string | null;
}>;

function body(hex: string, middle: string): string {
  const sentinel = `${NOTE_BODY_SENTINEL_PREFIX}${hex}`;
  return `${sentinel} ${middle} ${sentinel}`;
}

/**
 * Fixed 32-hex values, written by hand. They are not generated, not hashed
 * from content, and not derived from a clock — a sentinel that changes
 * between runs cannot anchor a regression test.
 */
export const HOME_FIXTURE_NOTES: readonly FixtureNote[] = Object.freeze([
  {
    id: "home-note-mara-finn-menu",
    filedUnderProjectId: "home-ws-mara-finn",
    ownerUserId: "truth-user",
    title: "Menu tasting, my own notes",
    body: body(
      "9f2c41a7d6b84e05a1c37f6b2e9d0c48",
      "Mara's mother cannot eat shellfish and has not told Mara. Handle this quietly with the kitchen, do not raise it at the table.",
    ),
    extractBody:
      "SS-NOTE-EXTRACT-3b7e5d1908af4c62b0d95e2a6c14f8d7 Confirm the tasting menu has one shellfish-free main.",
    extractSha256:
      "aa41f0c8bd2e4f5b9c6d7e8a0b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4",
    promotedToTaskId: "home-task-mf-menu-tasting",
  },
  {
    id: "home-note-nora-cian-budget",
    filedUnderProjectId: "home-ws-nora-cian",
    ownerUserId: "truth-user",
    title: "Budget conversation, private",
    body: body(
      "1d84b0e75c3947aab2f6081c9e5d3a20",
      "Cian's father is covering the venue but does not want Nora to know the amount. Never put this in a shared document.",
    ),
    extractBody: null,
    extractSha256: null,
    promotedToTaskId: null,
  },
  {
    id: "home-note-aisling-tom-venue",
    filedUnderProjectId: "home-ws-aisling-tom",
    ownerUserId: "truth-user",
    title: "Venue walk, first impressions",
    body: body(
      "7c02fa9e4b1d48539ae6172c8d0b5f3a",
      "The second room smells of damp. Do not recommend it. Aisling loved it, so this needs a gentle conversation.",
    ),
    extractBody:
      "SS-NOTE-EXTRACT-5f19c8a2074e4d13b6c8e0a91d2f7b46 Ask the venue about the second room before the next visit.",
    extractSha256:
      "bb52a1d9ce3f506ca7d8e9f0b1c2d3e4f50617283949a5b6c7d8e9f0a1b2c3d5",
    promotedToTaskId: "home-task-at-venue-question",
  },
  {
    id: "home-note-unfiled-suppliers",
    /** Unfiled is a normal durable state, not an error. D-H05. */
    filedUnderProjectId: null,
    ownerUserId: "truth-user",
    title: "Suppliers I keep meaning to call",
    body: body(
      "4e6b18cd9207f43a51c0d8e2b7a3f695",
      "The florist in Adare quoted well below the others. Check whether they are actually insured before recommending them to anyone.",
    ),
    extractBody: null,
    extractSha256: null,
    promotedToTaskId: null,
  },
  {
    id: "home-note-other-actor-private",
    /** Owned by somebody else. Home must never read this at all. */
    filedUnderProjectId: "home-ws-sinead-ruairi",
    ownerUserId: "collab-user-eabha",
    title: "Not the actor's note",
    body: body(
      "0a3f7d5c81be4629b4f2a7c609d13e8b",
      "Written by a different person in a Project the actor can see. Its presence in the universe is the point: a Project-scoped read that returns it is the cross-tenant defect.",
    ),
    extractBody: null,
    extractSha256: null,
    promotedToTaskId: null,
  },
]);

// ── The scanners ────────────────────────────────────────────────────────────

export type SentinelScanResult = Readonly<{
  /** Every distinct body sentinel found in the scanned text. */
  bodyHits: readonly string[];
  extractHits: readonly string[];
}>;

const BODY_PATTERN = /SS-NOTE-BODY-[0-9a-f]{0,32}/g;
const EXTRACT_PATTERN = /SS-NOTE-EXTRACT-[0-9a-f]{0,32}/g;

/** Byte-level scan of a finished artifact. Never a field-level assertion. */
export function scanForSentinels(artifact: string): SentinelScanResult {
  return Object.freeze({
    bodyHits: Object.freeze([...new Set(artifact.match(BODY_PATTERN) ?? [])]),
    extractHits: Object.freeze([
      ...new Set(artifact.match(EXTRACT_PATTERN) ?? []),
    ]),
  });
}

export type PopulationCheck =
  | { ok: true; sentinelsSeen: number }
  | { ok: false; reason: "empty-population" | "body-sentinel-present"; detail: string };

/**
 * SECURITY_AND_PRIVACY §1.2, "refusal on an empty population".
 *
 * If the scanned population contains zero body sentinels the check FAILS. It
 * does not report clean. This adopts the repository's existing posture —
 * `perf:budgets` exits 3 with "Refusing to report a measurement of zero" and
 * `check:contrast` reports unmeasurable surfaces rather than a pass. A privacy
 * check that passes because it looked at nothing is worse than no check,
 * because it is recorded as evidence.
 *
 * @param population every body string the fixture universe holds
 * @param artifact   the finished output the sentinel must be absent from
 */
export function assertBodySentinelAbsent(
  population: readonly string[],
  artifact: string,
): PopulationCheck {
  const inPopulation = population.flatMap(
    (text) => scanForSentinels(text).bodyHits,
  );
  if (inPopulation.length === 0) {
    return {
      ok: false,
      reason: "empty-population",
      detail:
        "Refusing to report a clean scan: the population carried zero body sentinels, so this check looked at nothing.",
    };
  }
  const leaked = scanForSentinels(artifact).bodyHits;
  if (leaked.length > 0) {
    return {
      ok: false,
      reason: "body-sentinel-present",
      detail: `Private note body reached a Home artifact: ${leaked.join(", ")}`,
    };
  }
  return { ok: true, sentinelsSeen: new Set(inPopulation).size };
}

/** Every private body in the universe. The population the scan must not be empty over. */
export const HOME_FIXTURE_NOTE_BODIES: readonly string[] = Object.freeze(
  HOME_FIXTURE_NOTES.map((note) => note.body),
);

/** The extracts Home IS permitted to render, each only with its label. */
export const HOME_FIXTURE_APPROVED_EXTRACTS: readonly string[] = Object.freeze(
  HOME_FIXTURE_NOTES.map((note) => note.extractBody).filter(
    (value): value is string => value !== null,
  ),
);
