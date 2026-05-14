#!/usr/bin/env tsx
/**
 * Atlas drift-check — runs against the current repo's staged files
 * and writes drift into studio's canonical sidecar.
 *
 * Architecture (Cycle A.11, 2026-05-14): shared write. All five
 * product repos (studio + tasks + roadmap + analytics + notes) ship
 * this same script. Atlas content always lives in studio, so the
 * sidecar lives next to it at:
 *
 *   ~/Projects/personal/studio/content/atlas/_drift.json
 *
 * Per-repo behavior:
 *   - In studio:   auto-stages the sidecar, runs the clear path (when
 *                  an entry's own .md is staged, slug is cleared).
 *   - In sibling:  writes the sidecar in studio's working tree but
 *                  skips auto-stage (foreign repo). Clear path is
 *                  inert because entry .md files only live in studio.
 *
 * Hook contract: NEVER blocks the commit. Records drift, prints a
 * one-line summary. Silent no-op if studio's atlas dir is missing
 * (e.g. CI clone, fresh machine).
 *
 * See docs/ATLAS_DRIFT_TRIGGER.md for the full spec.
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

const HOME = process.env.HOME ?? "";
const REPO_ROOT = execSync("git rev-parse --show-toplevel").toString().trim();
const STUDIO_ROOT = path.join(HOME, "Projects", "personal", "studio");
const ATLAS_DIR = path.join(STUDIO_ROOT, "content", "atlas");
const SIDECAR_PATH = path.join(ATLAS_DIR, "_drift.json");
const IS_STUDIO = REPO_ROOT === STUDIO_ROOT;

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
  const expanded = ref.startsWith("~/") && HOME
    ? path.join(HOME, ref.slice(2))
    : ref;

  if (expanded.startsWith(REPO_ROOT)) {
    return path.relative(REPO_ROOT, expanded);
  }

  if (expanded.startsWith(HOME) && expanded.includes(path.sep)) {
    return null;
  }

  if (!path.isAbsolute(ref) && !ref.startsWith("~") && !/^https?:|^[A-Z_]+$/.test(ref)) {
    return ref;
  }

  return null;
}

function referenceMatches(stagedPath: string, normalizedRef: string): boolean {
  if (stagedPath === normalizedRef) return true;
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

function repoLabel(): string {
  return path.basename(REPO_ROOT);
}

function main(): void {
  if (!fs.existsSync(ATLAS_DIR)) {
    return;
  }

  const staged = readStagedFiles();
  if (staged.length === 0) {
    return;
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

    // Clear path: only meaningful when running inside studio, since
    // sibling commits cannot stage atlas .md files (they live in studio).
    if (IS_STUDIO) {
      const entryPath = path.relative(REPO_ROOT, path.join(ATLAS_DIR, entry.file));
      if (staged.includes(entryPath) && sidecar[slug]) {
        delete sidecar[slug];
        cleared.push(slug);
        continue;
      }
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

  // Auto-stage only inside the studio repo. Sibling repos write the
  // sidecar in studio's working tree without staging — the studio
  // operator picks it up on the next studio commit.
  if (IS_STUDIO) {
    if (fs.existsSync(SIDECAR_PATH)) {
      try {
        execSync(`git add ${JSON.stringify(SIDECAR_PATH)}`, { stdio: "ignore" });
      } catch {
        // best effort
      }
    } else {
      try {
        execSync(`git add -A ${JSON.stringify(SIDECAR_PATH)}`, { stdio: "ignore" });
      } catch {
        // best effort
      }
    }
  }

  const repoTag = IS_STUDIO ? "" : ` [${repoLabel()}]`;
  const parts: string[] = [];
  if (flagged.length > 0) {
    parts.push(
      `atlas${repoTag}: drift flagged on ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"} (${flagged.map((f) => f.slug).join(", ")})`,
    );
  }
  if (cleared.length > 0) {
    parts.push(
      `atlas${repoTag}: drift cleared on ${cleared.length} ${cleared.length === 1 ? "entry" : "entries"} (${cleared.join(", ")})`,
    );
  }
  if (parts.length > 0) {
    // eslint-disable-next-line no-console
    console.log(parts.join(" · "));
  }
}

main();
