// Shared plumbing for the elevate toolchain.
//
// Every script takes --lab=<dir> pointing at an engagement lab that contains
// elevate.config.json. Nothing else about the engagement is hardcoded
// anywhere: the config is the single mechanical source of truth, the brief
// is the single narrative one.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function parseArgs(argv = process.argv.slice(2)) {
  return new Map(
    argv.map((raw) => {
      const [key, ...rest] = raw.replace(/^--/, "").split("=");
      return [key, rest.length ? rest.join("=") : "true"];
    }),
  );
}

export async function loadLab(args) {
  const lab = path.resolve(args.get("lab") ?? ".");
  let raw;
  try {
    raw = await readFile(path.join(lab, "elevate.config.json"), "utf8");
  } catch {
    throw new Error(
      `No elevate.config.json in ${lab}. Pass --lab=<engagement dir> ` +
      `(created by scaffold.mjs).`,
    );
  }
  const config = JSON.parse(raw);
  config.master ??= "master.html";
  config.states ??= ["resting"];
  config.variants ??= [config.defaultVariant ?? "a"];
  config.defaultVariant ??= config.variants[0];
  config.viewports ??= [
    { name: "390x844", width: 390, height: 844, isMobile: true },
    { name: "768x1024", width: 768, height: 1024 },
    { name: "1280x900", width: 1280, height: 900 },
    { name: "1440x960", width: 1440, height: 960 },
  ];
  config.gate ??= 9.5;
  return { lab, config };
}

/* The master answers to two URL parameters — ?state= and ?v= — which is the
   whole contract between the master and the toolchain. */
export function masterUrl(lab, config, { state, variant } = {}) {
  const url = new URL(pathToFileURL(path.join(lab, config.master)).href);
  if (state) url.searchParams.set("state", state);
  if (variant) url.searchParams.set("v", variant);
  return url.href;
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function fileUrl(p) {
  return pathToFileURL(path.resolve(p)).href;
}

/* Launch Chromium wherever it actually is. Playwright wants the browser
   revision its own version pinned; managed containers often preinstall a
   different revision (with a stable symlink like /opt/pw-browsers/chromium).
   Try the normal launch first, then fall back to known executable paths so
   the gates run in any environment rather than only a freshly-installed one. */
export async function launch(chromium, opts = {}) {
  try {
    return await chromium.launch(opts);
  } catch (error) {
    const candidates = [
      process.env.ELEVATE_CHROMIUM,
      process.env.PLAYWRIGHT_BROWSERS_PATH && `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`,
      "/opt/pw-browsers/chromium",
    ].filter(Boolean);
    for (const executablePath of candidates) {
      try {
        return await chromium.launch({ ...opts, executablePath });
      } catch { /* next candidate */ }
    }
    throw error;
  }
}
