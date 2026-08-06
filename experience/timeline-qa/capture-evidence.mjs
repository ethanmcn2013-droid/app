#!/usr/bin/env node
/**
 * One-shot evidence capture for the proportionality repair.
 *
 * Not a test and not wired into any gate — the visual-QA spec next to it is
 * the measured harness. This exists so a change to what the rail CLAIMS can be
 * looked at rather than only read about: it shoots the public bearer artifact
 * and the Share dialog at the sizes those two surfaces are actually used at,
 * and prints, alongside each shot, the rail-percent per calendar day between
 * every pair of neighbouring marks. On a proportional rail that number is the
 * same for every pair; the defect this was written for made it vary by a
 * factor of fifteen.
 *
 * Usage: node experience/timeline-qa/capture-evidence.mjs [outDir]
 * Targets the review-mode server on TIMELINE_QA_PORT (default 3520).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = process.env.TIMELINE_QA_PORT ?? "3520";
const BASE = `http://localhost:${PORT}`;
const TOKEN = "DemoAudienceTimelineToken2026Fixed000000000";
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(os.tmpdir(), "timeline-rail-evidence");

const SHOTS = [
  { id: "public-artifact-1440", url: `${BASE}/s/${TOKEN}`, width: 1440, height: 900 },
  { id: "public-artifact-390", url: `${BASE}/s/${TOKEN}`, width: 390, height: 844 },
  { id: "owner-timeline-1440", url: `${BASE}/app/timeline`, width: 1440, height: 900 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      colorScheme: "light",
      locale: "en-GB",
      timezoneId: "Europe/London",
    });
    await page.goto(shot.url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(1200);
    const file = path.join(OUT, `${shot.id}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`wrote ${file}`);
    await page.close();
  }

  // The proportionality reading, taken off the rendered rail rather than the
  // model, so it is evidence about the page and not about the unit under test.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/s/${TOKEN}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1000);
  const rates = await page.evaluate(() => {
    const stage = document.querySelector("[data-timeline-scroll-viewport] > *");
    if (!stage) return null;
    const railWidth = stage.getBoundingClientRect().width;
    const marks = Array.from(stage.querySelectorAll("li[style*='--timeline-position']"));
    const read = (element) => {
      const raw = element.style.getPropertyValue("--timeline-position").trim();
      const label = element.querySelector("small")?.textContent?.trim() ?? "";
      return { percent: Number.parseFloat(raw), label };
    };
    const points = marks.map(read).filter((p) => Number.isFinite(p.percent));
    return { railWidth, points };
  });
  await page.close();
  await browser.close();

  if (!rates) {
    console.log("rail not found — nothing measured");
    return;
  }
  console.log(`\nrail width ${Math.round(rates.railWidth)}px, ${rates.points.length} marks`);
  const day = (text) => Date.parse(text.replace("Sept", "Sep"));
  const perDay = [];
  for (let index = 1; index < rates.points.length; index += 1) {
    const days = (day(rates.points[index].label) - day(rates.points[index - 1].label)) / 86_400_000;
    const percent = rates.points[index].percent - rates.points[index - 1].percent;
    if (Number.isFinite(days) && days > 0) perDay.push(percent / days);
  }
  if (perDay.length === 0) {
    console.log("no dated pairs to compare");
    return;
  }
  const min = Math.min(...perDay);
  const max = Math.max(...perDay);
  console.log(`rail-percent per calendar day: ${perDay.map((r) => r.toFixed(4)).join(", ")}`);
  console.log(`spread ${(max / min).toFixed(2)}x  (1.00x means distance is time)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
