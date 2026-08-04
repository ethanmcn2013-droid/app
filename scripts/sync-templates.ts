/**
 * Sync canonical workspace templates from the Signal Studio repo into
 * this Tasks repo as a generated TS file (`src/lib/templates.generated.ts`).
 *
 * Source-of-truth: `../studio/src/lib/templates/` (sibling directory).
 * Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12).
 *
 * Run:  pnpm sync:templates
 *
 * The generated file is committed to git — Vercel does not need the
 * studio repo to build. Re-run this script after editing canonical
 * templates in studio and commit the diff together.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioTemplatesPath = resolve(__dirname, "../../studio/src/lib/templates");

if (!existsSync(studioTemplatesPath)) {
  console.error(
    `Studio templates not found at ${studioTemplatesPath}. ` +
      `Expected the studio repo to be a sibling of the tasks repo.`,
  );
  process.exit(1);
}

const studioIndexUrl = pathToFileURL(`${studioTemplatesPath}/index.ts`).href;

type StudioTemplate = {
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
};

async function main(): Promise<void> {
  const mod = (await import(studioIndexUrl)) as {
    WORKSPACE_TEMPLATES: StudioTemplate[];
  };

  const slice = mod.WORKSPACE_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
    domain: t.domain,
    tasks: t.tasks,
  }));

  const banner = [
    "// AUTO-GENERATED — do not edit by hand.",
    "// Source: studio/src/lib/templates/ (canonical workspace templates).",
    "// Refresh: pnpm sync:templates",
    "// Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12)",
  ].join("\n");

  const body = `${banner}

import type { Template } from "./templates";

export const SYNCED_TEMPLATES: Template[] = ${JSON.stringify(slice, null, 2)};

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATES.map((t) => t.id),
);
`;

  const outPath = resolve(__dirname, "../src/lib/templates.generated.ts");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body, "utf8");

  console.log(
    `Synced ${slice.length} workspace template(s) to ${outPath}: ${slice
      .map((t) => t.id)
      .join(", ")}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
