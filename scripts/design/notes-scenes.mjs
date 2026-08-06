// The scripted states of Notes, driven through the real interface.
//
//   node scripts/design/notes-scenes.mjs --out=docs/design/shots/after --base=http://localhost:3510
//
// Each scene navigates, performs real interactions, and captures what a
// person would actually see. Nothing is stubbed: the voice scenes drive the
// review build's rehearsal, and the photo scenes upload a real PNG.
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
const OUT = args.get("out") ?? "docs/design/shots/scenes";
const ONLY = args.get("only")?.split(",").map((value) => value.trim()) ?? null;
const WIDTH = Number(args.get("width") ?? 1440);
const HEIGHT = Number(args.get("height") ?? 900);
const MOBILE = args.get("mobile") === "true";

/**
 * A 4x4 PNG. Real bytes with a real mime type, so the upload path, the size
 * guard and the preview are all genuinely exercised; the review build's
 * deterministic reader supplies the notes.
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";

const SCENES = [
  {
    slug: "composer-empty",
    url: "/app/notes",
  },
  {
    slug: "composer-focused",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("textbox", { name: "Write a note" }).click();
    },
  },
  {
    slug: "composer-content",
    url: "/app/notes",
    async act(page) {
      await page
        .getByRole("textbox", { name: "Write a note" })
        .fill(
          "Ring the marquee company back about the side panels.\nThey close at four on a Friday, so it has to be before then.",
        );
    },
  },
  {
    slug: "voice-recording",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: "Voice" }).click();
      await page.waitForTimeout(3200);
    },
  },
  {
    slug: "voice-processing",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: "Voice" }).click();
      await page.waitForTimeout(4200);
      await page.getByRole("button", { name: /Stop and read it back/ }).click();
      await page.waitForTimeout(60);
    },
    settle: 0,
  },
  {
    slug: "voice-review",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: "Voice" }).click();
      await page.waitForTimeout(4400);
      await page.getByRole("button", { name: /Stop and read it back/ }).click();
      await page.getByRole("textbox", { name: /Note 1 of/ }).waitFor();
    },
  },
  {
    slug: "photo-preview",
    url: "/app/notes",
    async act(page) {
      await page
        .getByLabel("Choose a photo to read")
        .setInputFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: Buffer.from(PNG_BASE64, "base64") });
      await page.getByRole("button", { name: "Read this photo" }).waitFor();
    },
  },
  {
    slug: "photo-review",
    url: "/app/notes",
    async act(page) {
      await page
        .getByLabel("Choose a photo to read")
        .setInputFiles({ name: "whiteboard.png", mimeType: "image/png", buffer: Buffer.from(PNG_BASE64, "base64") });
      await page.getByRole("button", { name: "Read this photo" }).click();
      await page.getByRole("textbox", { name: /Note 1 of/ }).waitFor();
    },
  },
  {
    slug: "note-selected",
    url: "/app/notes",
  },
  {
    slug: "note-editing",
    url: "/app/notes",
    async act(page) {
      const field = page.getByRole("textbox", { name: "Note", exact: true });
      await field.click();
      await field.press("End");
      await page.keyboard.type(" Ask about the side panels too.");
    },
  },
  {
    slug: "search-results",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("searchbox", { name: "Search notebook" }).fill("orchard");
    },
  },
  {
    slug: "search-no-results",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("searchbox", { name: "Search notebook" }).fill("zzzzz");
    },
  },
  {
    slug: "note-delete-confirm",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: "More actions for this note" }).click();
    },
  },
  { slug: "review-queue", url: "/app/notes?view=review" },
  {
    slug: "review-turn-into-task",
    url: "/app/notes?view=review",
    async act(page) {
      await page.getByRole("button", { name: "Turn into task" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    slug: "task-created",
    url: "/app/notes?view=review",
    async act(page) {
      await page.getByRole("button", { name: "Turn into task" }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Create task" }).click();
      await page.getByRole("heading", { name: "Task created" }).waitFor();
    },
  },
  {
    slug: "review-complete",
    url: "/app/notes?view=review&fixture=empty",
  },
  { slug: "sent-view", url: "/app/notes?view=sent" },
  { slug: "sent-empty", url: "/app/notes?view=sent&fixture=empty" },
  { slug: "notebook-empty", url: "/app/notes?fixture=empty" },
  {
    slug: "save-failure",
    url: "/app/notes?hybridMode=save-error",
    async act(page) {
      await page
        .getByRole("textbox", { name: "Write a note" })
        .fill("This one will not reach the server on the first try.");
      await page.keyboard.press("Control+Enter");
      await page.getByText(/That did not save/).first().waitFor();
    },
  },
  {
    slug: "conflict",
    url: "/app/notes?hybridMode=conflict",
    async act(page) {
      const field = page.getByRole("textbox", { name: "Note", exact: true });
      await field.click();
      await page.keyboard.type(" Edited here.");
      await field.blur();
      await page.getByText("This note changed somewhere else").first().waitFor();
    },
  },
  {
    slug: "offline",
    url: "/app/notes?hybridMode=offline",
    async act(page) {
      await page
        .getByRole("textbox", { name: "Write a note" })
        .fill("Written while the connection was down.");
      await page.keyboard.press("Control+Enter");
      await page.getByText(/Held on this device|reconnect/).first().waitFor();
    },
  },
  {
    slug: "privacy-popover",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: /Private to you/ }).click();
      await page.getByRole("dialog", { name: /Only you can read your notes/ }).waitFor();
    },
  },
  {
    slug: "options-menu",
    url: "/app/notes",
    async act(page) {
      await page.getByRole("button", { name: "Notes options" }).click();
      await page.getByRole("menu").waitFor();
    },
  },
  { slug: "dense", url: "/app/notes?fixture=dense" },
  { slug: "long-content", url: "/app/notes?fixture=long-content" },
];

async function run() {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    hasTouch: MOBILE,
    isMobile: MOBILE,
    permissions: ["microphone"],
    locale: "en-IE",
    timezoneId: "Europe/Dublin",
  });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("signal-tasks.devbanner_dismissed", "1");
    } catch {
      /* private mode keeps the pill; the shot is still valid */
    }
  });
  await mkdir(OUT, { recursive: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error}`));

  const failures = [];
  let attempted = 0;
  for (const scene of SCENES) {
    if (ONLY && !ONLY.includes(scene.slug)) continue;
    attempted += 1;
    try {
      // Every scene starts from nothing. Drafts and queued captures live in
      // session storage by design, so without this a scene inherits the
      // previous one's unsaved words and no longer shows what it claims to.
      await page.goto(`${BASE}${scene.url}`, { waitUntil: "networkidle" });
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
      if (scene.act) await scene.act(page);
      await page.waitForTimeout(scene.settle ?? 220);
      const file = path.join(OUT, `${scene.slug}.png`);
      await page.screenshot({ path: file });
      process.stdout.write(`ok   ${scene.slug}\n`);
    } catch (error) {
      failures.push({ slug: scene.slug, error: String(error).split("\n")[0] });
      process.stdout.write(`FAIL ${scene.slug}: ${String(error).split("\n")[0]}\n`);
      await page.screenshot({ path: path.join(OUT, `${scene.slug}--FAILED.png`) }).catch(() => {});
    }
  }

  await writeFile(
    path.join(OUT, "console.txt"),
    [...new Set(consoleErrors)].join("\n") || "no console errors\n",
    "utf8",
  );
  // The run's own verdict, written beside its output. Without this the bundle
  // recorded a clean console and said nothing about scenes that never reached
  // the state they claim to show, which let a failed capture sit unremarked
  // next to passing ones.
  await writeFile(
    path.join(OUT, "capture-report.txt"),
    [
      `output: ${OUT}`,
      `scenes attempted: ${attempted}`,
      `scene failures: ${failures.length}`,
      ...failures.map((entry) => `  FAILED ${entry.slug}: ${entry.error}`),
      `console errors: ${new Set(consoleErrors).size}`,
      ...[...new Set(consoleErrors)].map((line) => `  ${line}`),
      "",
    ].join("\n"),
    "utf8",
  );
  process.stdout.write(
    `\nconsole errors: ${new Set(consoleErrors).size}\nscene failures: ${failures.length}\n`,
  );
  await browser.close();
  if (failures.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
