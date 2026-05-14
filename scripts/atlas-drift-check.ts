#!/usr/bin/env tsx
/**
 * Atlas drift-check — runs against the current repo's staged files.
 *
 * For every atlas entry, normalize its references[] to repo-relative
 * paths that could exist here. For every staged file, see if it matches
 * any entry's normalized references. If so, mark the entry as drifted
 * in content/atlas/_drift.json.
 *
 * Two clear paths run unconditionally on every invocation:
 *   1. If an entry's own .md file is staged with a bumped lastVerified,
 *      remove its slug from the sidecar (the operator confirmed it).
 *   2. If an entry's own .md file is staged AND its body changed, the
 *      entry is implicitly re-verified — clear the slug.
 *
 * Hook contract: NEVER blocks the commit. Records drift, stages the
 * sidecar so it travels with the same commit, prints a one-line summary.
 *
 * Invocation:
 *   tsx scripts/atlas-drift-check.ts
 *
 * Activation (one-time):
 *   git config core.hooksPath .githooks
 *
 * See docs/ATLAS_DRIFT_TRIGGER.md for the full spec and the multi-repo
 * fan-out plan.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type SidecarEntry = {
  drifted: string[];
  updatedAt: string;
  byCommit?: string;
};
type Sidecar = Record<string, SidecarEntry>;

const REPO_ROOT = execSync("git rev-parse --show-toplevel").toString().trim();
const HOME = process.env.HOME ?? "";
// The atlas lives in the studio repo. Each product repo's drift-check
// reads entries from there and writes findings back into the same
// sidecar. ATLAS_REPO_ROOT env override allows ad-hoc relocation.
const ATLAS_REPO_ROOT =
  process.env.ATLAS_REPO_ROOT ??
  path.join(HOME, "Projects", "personal", "studio");
const ATLAS_DIR = path.join(ATLAS_REPO_ROOT, "content", "atlas");
const SIDECAR_PATH = path.join(ATLAS_DIR, "_drift.json");

// The studio repo lives at this absolute path; references[] often use a
// "~/Projects/personal/<repo>/<rest>" prefix that needs to resolve to
// either THIS repo or a sibling. We only flag drift for the repo we're
// running in.
const REPO_HOME_PREFIX = HOME ? REPO_ROOT.replace(HOME, "~") : REPO_ROOT;

function readStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listAtlasEntries(): { slug: string; file: string; raw: string }[] {
  if (!fs.existsSync(ATLAS_DIR)) return [];
  return fs
    .readdirSync(ATLAS_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => ({
      slug: f.replace(/\.md$/, ""),
      file: f,
      raw: fs.readFileSync(path.join(ATLAS_DIR, f), "utf-8"),
    }));
}

function parseFrontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function parseInlineArray(value: string): string[] {
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Decide whether a reference (from atlas entry frontmatter) names a path
 * inside THIS repo. Returns the repo-relative form, or null if the
 * reference points at a different repo, an env var name, or a URL.
 */
function normalizeReference(ref: string): string | null {
  if (!ref) return null;
  // Strip leading "~/" prefix and resolve against HOME
  const expanded = ref.startsWith("~/") && HOME
    ? path.join(HOME, ref.slice(2))
    : ref;

  // Reference is an absolute path under this repo?
  if (expanded.startsWith(REPO_ROOT)) {
    return path.relative(REPO_ROOT, expanded);
  }

  // Reference uses the ~/Projects/personal/<repo>/ shorthand but resolves
  // outside this repo's tree — skip.
  if (expanded.startsWith(HOME) && expanded.includes(path.sep)) {
    return null;
  }

  // No leading slash, no leading tilde — treat as a repo-relative path.
  if (!path.isAbsolute(ref) && !ref.startsWith("~") && !/^https?:|^[A-Z_]+$/.test(ref)) {
    return ref;
  }

  return null;
}

function referenceMatches(stagedPath: string, normalizedRef: string): boolean {
  // Exact file match.
  if (stagedPath === normalizedRef) return true;
  // Directory reference — match any file under it.
  const dirRef = normalizedRef.endsWith("/")
    ? normalizedRef
    : `${normalizedRef}/`;
  if (stagedPath.startsWith(dirRef)) return true;
  return false;
}

function readSidecar(): Sidecar {
  if (!fs.existsSync(SIDECAR_PATH)) return {};
  try {
    const raw = fs.readFileSync(SIDECAR_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Sidecar) : {};
  } catch {
    return {};
  }
}

function writeSidecar(sidecar: Sidecar): void {
  if (Object.keys(sidecar).length === 0) {
    if (fs.existsSync(SIDECAR_PATH)) fs.unlinkSync(SIDECAR_PATH);
    return;
  }
  fs.writeFileSync(SIDECAR_PATH, `${JSON.stringify(sidecar, null, 2)}\n`);
}

function currentCommitShort(): string | undefined {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return undefined;
  }
}

function main(): void {
  const staged = readStagedFiles();
  if (staged.length === 0) {
    return; // nothing to check
  }

  const entries = listAtlasEntries();
  if (entries.length === 0) {
    return;
  }

  const sidecar = readSidecar();
  const sha = currentCommitShort();
  const now = new Date().toISOString();
  const flagged: { slug: string; refs: string[] }[] = [];
  const cleared: string[] = [];

  for (const entry of entries) {
    const fm = parseFrontmatter(entry.raw);
    const slug = fm.slug ?? entry.slug;

    // Clear path: if this entry's own .md is staged, treat it as
    // operator-acknowledged. Remove from sidecar.
    const entryPath = path.relative(REPO_ROOT, path.join(ATLAS_DIR, entry.file));
    if (staged.includes(entryPath) && sidecar[slug]) {
      delete sidecar[slug];
      cleared.push(slug);
      continue;
    }

    // Drift path: match staged files against this entry's normalized references.
    const refs = parseInlineArray(fm.references ?? "");
    const driftedRefs: string[] = [];
    for (const ref of refs) {
      const normalized = normalizeReference(ref);
      if (!normalized) continue;
      for (const stagedPath of staged) {
        if (referenceMatches(stagedPath, normalized)) {
          if (!driftedRefs.includes(ref)) driftedRefs.push(ref);
        }
      }
    }
    if (driftedRefs.length > 0) {
      const prior = sidecar[slug]?.drifted ?? [];
      const merged = Array.from(new Set([...prior, ...driftedRefs]));
      sidecar[slug] = { drifted: merged, updatedAt: now, byCommit: sha };
      flagged.push({ slug, refs: driftedRefs });
    }
  }

  writeSidecar(sidecar);

  // Stage the sidecar so it travels with the same commit — only when
  // the atlas is in THIS repo. Cross-repo runs (e.g. from tasks repo
  // writing into studio's sidecar) leave the studio sidecar
  // uncommitted; the studio operator picks it up next time.
  const sidecarInThisRepo = REPO_ROOT === ATLAS_REPO_ROOT;
  if (sidecarInThisRepo) {
    if (fs.existsSync(SIDECAR_PATH)) {
      try {
        execSync(`git add ${JSON.stringify(SIDECAR_PATH)}`, { stdio: "ignore" });
      } catch {
        // best effort
      }
    } else {
      // Sidecar was deleted (all entries cleared) — stage the deletion.
      try {
        execSync(`git add -A ${JSON.stringify(SIDECAR_PATH)}`, { stdio: "ignore" });
      } catch {
        // best effort
      }
    }
  }

  // One-line summary for the operator. Never blocks.
  const parts: string[] = [];
  if (flagged.length > 0) {
    parts.push(
      `atlas: drift flagged on ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"} (${flagged.map((f) => f.slug).join(", ")})`,
    );
  }
  if (cleared.length > 0) {
    parts.push(
      `atlas: drift cleared on ${cleared.length} ${cleared.length === 1 ? "entry" : "entries"} (${cleared.join(", ")})`,
    );
  }
  if (parts.length > 0) {
    // eslint-disable-next-line no-console
    console.log(parts.join(" · "));
  }
}

main();
