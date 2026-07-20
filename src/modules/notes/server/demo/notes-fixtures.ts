export const DEMO_FIXTURE_IDS = [
  "first-use",
  "first-capture",
  "populated",
  "empty",
  "dense",
  "loading",
  "error",
  "long-content",
  "partial-failure",
  "restricted",
  "capture-email",
] as const;

export type DemoFixtureId = (typeof DEMO_FIXTURE_IDS)[number];

export const DEMO_FIXTURE_DESCRIPTIONS: Record<DemoFixtureId, string> = {
  "first-use": "A new notebook before its first capture.",
  "first-capture": "The one-time confirmation immediately after the first saved note.",
  populated: "A realistic, normally populated private notebook.",
  empty: "An established notebook with no active or archived notes.",
  dense: "A large, dense stream used to exercise scanning and layout.",
  loading: "The real route-level notebook loading experience.",
  error: "The real recoverable notebook error boundary.",
  "long-content": "Long note copy and an unusually long supplier name.",
  "partial-failure": "Notes remain usable while connected details are unavailable.",
  restricted: "A populated notebook without Workspace email capture.",
  "capture-email": "A populated notebook with a synthetic capture address.",
};

const FIXTURE_IDS = new Set<string>(DEMO_FIXTURE_IDS);

export function resolveDemoFixture(
  raw: string | string[] | undefined,
): DemoFixtureId {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return candidate && FIXTURE_IDS.has(candidate)
    ? (candidate as DemoFixtureId)
    : "populated";
}
