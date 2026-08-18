// The Notes states the inherited harness can no longer reach.
//
//   node scripts/design/notes-scenes-extra.mjs --out=docs/design/shots/notes-reference-2026-08
//
// `scripts/design/notes-scenes.mjs` belongs to the Tasks exploration and is
// not edited here. Four of its scenes fail against the build as it stands
// today, because the product moved and the harness did not:
//
//   - Voice now opens on a consent stage. "Start recording" has to be
//     pressed before anything is listening, so every scene that waited for
//     "Stop and read it back" timed out on a screen that was never
//     recording.
//   - The photo primary action is "Read with AI", not "Read this photo".
//
// This sibling captures those states, plus the consent stage itself, which
// the original harness had no scene for because it did not exist yet.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);
const BASE = args.get("base") ?? "http://localhost:3510";
const OUT = args.get("out") ?? "docs/design/shots/notes-reference-2026-08";
const WIDTH = Number(args.get("width") ?? 1440);
const HEIGHT = Number(args.get("height") ?? 960);

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";

const startVoice = async (page) => {
  await page.getByRole("button", { name: "Voice" }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
};

const SCENES = [
  {
    slug: "voice-consent",
    async act(page) {
      await page.getByRole("button", { name: "Voice" }).click();
      await page.getByRole("button", { name: "Start recording" }).waitFor();
    },
  },
  {
    slug: "voice-listening",
    async act(page) {
      await startVoice(page);
      await page.waitForTimeout(3200);
    },
  },
  {
    slug: "voice-processing",
    async act(page) {
      await startVoice(page);
      await page.waitForTimeout(3600);
      await page.getByRole("button", { name: /Stop and read it back/ }).click();
      await page.waitForTimeout(80);
    },
    settle: 0,
  },
  {
    slug: "voice-review",
    async act(page) {
      await startVoice(page);
      await page.waitForTimeout(3800);
      await page.getByRole("button", { name: /Stop and read it back/ }).click();
      await page.getByRole("textbox", { name: /Note 1 of/ }).waitFor({ timeout: 45_000 });
    },
  },
  {
    slug: "photo-preview",
    async act(page) {
      await page
        .getByLabel("Choose a photo to read")
        .setInputFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: Buffer.from(PNG_BASE64, "base64") });
      await page.getByRole("button", { name: "Read with AI" }).waitFor();
    },
  },
  {
    slug: "photo-review",
    async act(page) {
      await page
        .getByLabel("Choose a photo to read")
        .setInputFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: Buffer.from(PNG_BASE64, "base64") });
      await page.getByRole("button", { name: "Read with AI" }).click();
      await page.getByRole("textbox", { name: /Note 1 of/ }).waitFor({ timeout: 45_000 });
    },
  },
];

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  permissions: ["microphone"],
  locale: "en-IE",
  timezoneId: "Europe/Dublin",
});
await mkdir(OUT, { recursive: true });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));

const failures = [];
for (const scene of SCENES) {
  try {
    await page.goto(`${BASE}/app/notes`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      try {
        sessionStorage.clear();
        sessionStorage.setItem("signal-tasks.devbanner_dismissed", "1");
      } catch {
        /* private mode */
      }
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await scene.act(page);
    await page.waitForTimeout(scene.settle ?? 220);
    await page.screenshot({ path: path.join(OUT, `${scene.slug}.png`) });
    process.stdout.write(`ok   ${scene.slug}\n`);
  } catch (error) {
    failures.push({ slug: scene.slug, error: String(error).split("\n")[0] });
    process.stdout.write(`FAIL ${scene.slug}: ${String(error).split("\n")[0]}\n`);
    await page.screenshot({ path: path.join(OUT, `${scene.slug}--FAILED.png`) }).catch(() => {});
  }
}

await writeFile(
  path.join(OUT, "capture-report-extra.txt"),
  [
    `output: ${OUT}`,
    `scenes attempted: ${SCENES.length}`,
    `scene failures: ${failures.length}`,
    ...failures.map((f) => `  FAILED ${f.slug}: ${f.error}`),
    `console errors: ${new Set(consoleErrors).size}`,
    ...[...new Set(consoleErrors)].map((l) => `  ${l}`),
    "",
  ].join("\n"),
  "utf8",
);
process.stdout.write(`\nconsole errors: ${new Set(consoleErrors).size}\nscene failures: ${failures.length}\n`);
await browser.close();
if (failures.length) process.exitCode = 1;
