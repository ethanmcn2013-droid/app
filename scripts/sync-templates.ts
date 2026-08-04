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

async function main(): Promise<void> {
  const mod = (await import(studioIndexUrl)) as {
    WORKSPACE_TEMPLATES: StudioTemplate[];
  };

  const tasksSlice = mod.WORKSPACE_TEMPLATES.map((t) => ({
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

  const tasksOut = resolve(__dirname, "../src/lib/templates.generated.ts");
  mkdirSync(dirname(tasksOut), { recursive: true });
  writeFileSync(tasksOut, tasksBody, "utf8");

  // The Timeline module reads the roadmap slice. It carried the same
  // "Refresh: pnpm sync:templates" banner while no generator wrote it, so the
  // milestone seeds could drift from studio silently. They cannot now.
  const roadmapSlice = mod.WORKSPACE_TEMPLATES.map((t) => ({
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

  const roadmapOut = resolve(
    __dirname,
    "../src/modules/timeline/lib/templates.generated.ts",
  );
  mkdirSync(dirname(roadmapOut), { recursive: true });
  writeFileSync(roadmapOut, roadmapBody, "utf8");

  console.log(
    `Synced ${tasksSlice.length} workspace template(s) (${tasksSlice
      .map((t) => t.id)
      .join(", ")}):\n  ${tasksOut}\n  ${roadmapOut}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
