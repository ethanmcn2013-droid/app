/**
 * Sync canonical workspace templates from the Signal Studio repo into
 * this App repo's committed Tasks and Timeline slices.
 *
 * Source-of-truth: Studio's src/lib/templates/ at CANONICAL_SOURCE_REF below.
 * Studio removed that directory with its marketing pages in a2d70fa. Read the
 * last source revision from Git; never silently substitute a generated slice.
 * Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12).
 *
 * Run: pnpm sync:templates [--check] [--studio-root <local Studio checkout>]
 *
 * Both generated files are committed — App builds do not need Studio.
 * After a canonical Studio edit is reviewed, update the source pin, rerun
 * this script and review both artifact diffs together.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CANONICAL_SOURCE_REF = "ed02bc831894eb93b36f69f5b820a4727a9e2bb3";
const SOURCE_DIRECTORY = "src/lib/templates";

function git(checkout: string, args: string[]): string {
  return execFileSync("git", ["-C", checkout, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Resolve from the owning clone, not the task worktree's sibling folders. */
export function findStudioCheckout(appRoot: string): string {
  const commonDir = git(appRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  return resolve(dirname(commonDir), "../studio");
}

export type StudioTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  domain: string;
  tasks: Array<{
    title: string;
    lane: string;
    priority: string;
    due?: string;
    tags?: string[];
    /** Optional, canonical source may not carry them yet. Passed straight
     *  through so a studio-side template can declare Timeline milestones and
     *  wedding-relative due offsets without another change here. */
    milestone?: boolean;
    dueOffsetDays?: number;
  }>;
  roadmap: {
    projects: Array<{
      slug: string;
      name: string;
      oneLiner: string;
      accent?: string;
    }>;
    items: Array<{
      projectSlug: string;
      title: string;
      description: string;
      status: string;
      targetDate?: string;
      anchorOffsetDays?: number;
    }>;
    anchor?: {
      label: string;
      prompt: string;
      hint?: string;
    };
  };
};

const BANNER = [
  "// AUTO-GENERATED, do not edit by hand.",
  "// Source: studio/src/lib/templates/ (canonical workspace templates).",
  `// Canonical revision: studio@${CANONICAL_SOURCE_REF}`,
  "// Refresh: pnpm sync:templates",
  "// Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12)",
].join("\n");

/**
 * Project accents author as hex in studio, where designers read them, but a
 * raw hex in this repo trips the design-system ratchet and a CSS variable
 * cannot survive the JSON boundary. Emit the space-separated `rgb()` form the
 * ratchet accepts and say why on the line.
 */
function serializeWithAccents(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(
    /"accent": "#([0-9a-fA-F]{6})"(,?)/g,
    (_match: string, hex: string, comma: string) => {
      const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
      return (
        `"accent": "rgb(${channel(0)} ${channel(2)} ${channel(4)})"${comma}` +
        " // ds-allow: CSS variables cannot safely cross the generated serialization boundary."
      );
    },
  );
}

/** Reject disconnected or ambiguous seeds before either output can be written. */
export function validateTemplates(templates: StudioTemplate[]): void {
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error("Canonical templates must be a nonempty array.");
  }
  const ids = new Set<string>();
  for (const template of templates) {
    if (!template.id || ids.has(template.id)) throw new Error(`Duplicate or missing template id: ${template.id}`);
    ids.add(template.id);
    if (!Array.isArray(template.tasks) || template.tasks.length === 0) {
      throw new Error(`${template.id}: no task seeds.`);
    }
    const slugs = new Set<string>();
    for (const project of template.roadmap.projects) {
      if (!project.slug || slugs.has(project.slug)) throw new Error(`${template.id}: duplicate or missing project slug.`);
      slugs.add(project.slug);
    }
    for (const item of template.roadmap.items) {
      if (!slugs.has(item.projectSlug)) throw new Error(`${template.id}: unknown project ${item.projectSlug}.`);
      if (item.anchorOffsetDays !== undefined && !Number.isInteger(item.anchorOffsetDays)) {
        throw new Error(`${template.id}: invalid anchor offset for ${item.title}.`);
      }
    }
    for (const task of template.tasks) {
      if (task.dueOffsetDays !== undefined && !Number.isInteger(task.dueOffsetDays)) {
        throw new Error(`${template.id}: invalid due offset for ${task.title}.`);
      }
    }
  }
}

/** Load only the pinned canonical directory, without changing or fetching Studio. */
export async function loadCanonicalTemplates(
  studioRoot: string,
  sourceRef = CANONICAL_SOURCE_REF,
): Promise<StudioTemplate[]> {
  if (!/^[a-f0-9]{40}$/.test(sourceRef)) throw new Error("Canonical source requires an exact Git commit.");
  const origin = git(studioRoot, ["remote", "get-url", "origin"]).trim()
    .replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").toLowerCase();
  if (origin !== "https://github.com/ethanmcn2013-droid/studio") {
    throw new Error("Canonical template source must be the Signal Studio repository.");
  }
  const entries = git(studioRoot, ["ls-tree", "-r", "-z", sourceRef, "--", SOURCE_DIRECTORY])
    .split("\0").filter(Boolean);
  const paths = entries.map((entry) => {
    const match = /^100644 blob [a-f0-9]{40}\t(src\/lib\/templates\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.ts)$/.exec(entry);
    if (!match) throw new Error("Unexpected canonical template source entry.");
    return match[1];
  });
  if (!paths.includes(`${SOURCE_DIRECTORY}/index.ts`)) {
    throw new Error(`Canonical templates missing at studio@${sourceRef}. Restore local Git history; no outputs changed.`);
  }
  const scratchRoot = resolve(tmpdir());
  const snapshot = mkdtempSync(resolve(scratchRoot, "signal-template-source-"));
  try {
    for (const path of paths) {
      const output = resolve(snapshot, path);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, git(studioRoot, ["show", `${sourceRef}:${path}`]), "utf8");
    }
    const mod = await import(pathToFileURL(resolve(snapshot, SOURCE_DIRECTORY, "index.ts")).href);
    validateTemplates(mod.WORKSPACE_TEMPLATES);
    return mod.WORKSPACE_TEMPLATES;
  } finally {
    // Only remove the private directory returned by mkdtemp, never the checkout.
    if (dirname(snapshot) === scratchRoot) rmSync(snapshot, { recursive: true, force: true });
  }
}

export function renderTemplateArtifacts(templates: StudioTemplate[]): Record<string, string> {
  validateTemplates(templates);

  const tasksSlice = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    domain: t.domain,
    tasks: t.tasks,
  }));

  const tasksBody = `${BANNER}

import type { Template } from "./templates";

export const SYNCED_TEMPLATES: Template[] = ${JSON.stringify(tasksSlice, null, 2)};

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATES.map((t) => t.id),
);
`;

  // The Timeline module reads the roadmap slice. It carried the same
  // "Refresh: pnpm sync:templates" banner while no generator wrote it, so the
  // milestone seeds could drift from studio silently. They cannot now.
  const roadmapSlice = templates.map((t) => ({
    id: t.id,
    name: t.name,
    roadmap: t.roadmap,
  }));

  const roadmapBody = `${BANNER}

export type SyncedTemplateRoadmap = {
  id: string;
  name: string;
  roadmap: {
    projects: Array<{
      slug: string;
      name: string;
      oneLiner: string;
      accent?: string;
    }>;
    items: Array<{
      projectSlug: string;
      title: string;
      description: string;
      status: "shipped" | "in-flight" | "next" | "waiting" | "refused";
      targetDate?: string;
      /** Days from the seed's anchor date, negative meaning before it. */
      anchorOffsetDays?: number;
    }>;
    /** Declared when this template's plan points at one known day. */
    anchor?: {
      label: string;
      prompt: string;
      hint?: string;
    };
  };
};

export const SYNCED_TEMPLATE_ROADMAPS: SyncedTemplateRoadmap[] = ${serializeWithAccents(roadmapSlice)};

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATE_ROADMAPS.map((t) => t.id),
);

export function getSyncedTemplateRoadmap(id: string): SyncedTemplateRoadmap | undefined {
  return SYNCED_TEMPLATE_ROADMAPS.find((t) => t.id === id);
}
`;

  return {
    "src/lib/templates.generated.ts": tasksBody.replace(/\r\n/g, "\n"),
    "src/modules/timeline/lib/templates.generated.ts": roadmapBody.replace(/\r\n/g, "\n"),
  };
}

/** --check is read-only; unchanged files keep their bytes and modification time. */
export function syncTemplateArtifacts(appRoot: string, templates: StudioTemplate[], check = false): string[] {
  const artifacts = renderTemplateArtifacts(templates);
  const changed = Object.keys(artifacts).filter((path) => {
    const output = resolve(appRoot, path);
    return !existsSync(output) || readFileSync(output, "utf8").replace(/\r\n/g, "\n") !== artifacts[path];
  });
  if (check && changed.length) throw new Error(`Template artifacts are stale: ${changed.join(", ")}. Run pnpm sync:templates.`);
  for (const path of changed) {
    const output = resolve(appRoot, path);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, artifacts[path], "utf8");
  }
  return changed;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false }, "studio-root": { type: "string" } } });
  const appRoot = resolve(__dirname, "..");
  const studioRoot = values["studio-root"] ? resolve(values["studio-root"]) : findStudioCheckout(appRoot);
  const templates = await loadCanonicalTemplates(studioRoot);
  const changed = syncTemplateArtifacts(appRoot, templates, values.check);
  console.log(`${values.check ? "Checked" : "Synced"} ${templates.length} templates from studio@${CANONICAL_SOURCE_REF}; ${changed.length} artifact(s) changed.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
