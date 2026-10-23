/** Actual client against the local synthetic conversation harness; no provider credentials. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = process.argv[2]; const output = process.argv[3];
if (!origin || !output) throw new Error("Pass explicit loopback fixture origin and evidence directory");
const parsed = new URL(origin);
if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/" || !parsed.port) throw new Error("Only the explicit loopback synthetic fixture is allowed");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = []; const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce", acceptDownloads: true, extraHTTPHeaders: { "x-fixture-actor": "synthetic_alice" } });
  await context.addCookies([{ name: "__conversation_fixture_actor", value: "synthetic_alice", url: origin, httpOnly: true, sameSite: "Strict" }]);
  const page = await context.newPage(); const requests = []; const uploadRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/conversations/attachments") uploadRequests.push(request.url());
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/conversations") {
      try { const body = request.postDataJSON(); if (body.action === "send") requests.push(body); } catch { /* Multipart is captured through file assertions. */ }
    }
  });
  const post = async (actor, body) => {
    const response = await context.request.post(`${origin}/api/conversations`, { headers: { origin, "x-fixture-actor": actor }, data: body });
    const result = await response.json(); assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
  };
  const projectId = "synthetic_project_a";
  await post("synthetic_alice", { action: "ensure", projectId });
  const dm = await post("synthetic_alice", { action: "dm-request", projectId, recipientId: "synthetic_bob", clientRequestId: `dm_browser_${crypto.randomUUID().replaceAll("-", "")}` });
  if (dm.scope.pairState !== "active") await post("synthetic_bob", { action: "dm-transition", projectId, conversationId: dm.scope.conversationId, operation: "accept", expectedAudienceEpoch: dm.scope.audienceEpoch, clientRequestId: `accept_${crypto.randomUUID().replaceAll("-", "")}` });
  await page.goto(`${origin}/lab/project-conversation/live?actor=alice`);
  const composerFor = textbox => page.getByRole("region", { name: "Message composer", exact: true }).filter({ has: textbox });
  const text = page.getByRole("textbox", { name: "Message Website launch", exact: true });
  await expect(text).toBeVisible();
  const composer = composerFor(text); const fileInput = composer.locator('input[type="file"]');
  await expect(fileInput).toBeAttached();
  const nonce = Date.now(); const name = `project-${nonce}.txt`; const bytes = Buffer.from("Synthetic Project attachment. Exact bytes.\n");
  await fileInput.setInputFiles({ name, mimeType: "text/plain", buffer: bytes });
  await expect(composer.getByText("Ready to send", { exact: false })).toBeVisible();
  // A soft scope switch preserves this exact ready claim; it never uploads into the destination.
  await page.getByRole("button", { name: "Autumn exhibition", exact: true }).click();
  await page.getByRole("button", { name: "Website launch", exact: true }).click();
  await expect(composer.getByRole("button", { name: `Remove ${name}`, exact: true })).toBeVisible();
  await text.fill(`Project attachment ${nonce}`);
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  const link = page.getByRole("link", { name: new RegExp(name.replaceAll(".", "\\.")) });
  await expect(link).toBeVisible();
  const downloadPromise = page.waitForEvent("download"); await link.click(); const download = await downloadPromise;
  const downloadPath = path.join(output, name); await download.saveAs(downloadPath); assert.deepEqual(await readFile(downloadPath), bytes);
  results.push("Project upload, navigation custody, send and exact download");
  const root = page.locator("li[data-message-id]").filter({ hasText: `Project attachment ${nonce}` });
  await root.getByRole("button", { name: /^(Reply|\d+ repl)/ }).click();
  const reply = page.getByRole("textbox", { name: "Write a reply", exact: true }); const replyComposer = composerFor(reply);
  const replyName = `reply-${nonce}.txt`;
  await replyComposer.locator('input[type="file"]').setInputFiles({ name: replyName, mimeType: "text/plain", buffer: Buffer.from("Synthetic root-pinned reply") });
  await expect(replyComposer.getByText("Ready to send", { exact: false })).toBeVisible();
  await replyComposer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(replyName.replaceAll(".", "\\.")) })).toBeVisible();
  await page.getByRole("button", { name: /Back to conversation/ }).click();
  results.push("Root-pinned reply file-only send");
  await page.getByRole("button", { name: /^Maya Chen/ }).click();
  const privateText = page.getByRole("textbox", { name: "Message Maya Chen", exact: true }); const privateComposer = composerFor(privateText);
  await expect(privateComposer.locator('input[type="file"]')).toBeAttached();
  await privateText.evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="), character => character.charCodeAt(0))], "clipboard.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(privateComposer.getByText("Ready to send", { exact: false })).toBeVisible();
  await privateText.fill(`Private pasted image ${nonce}`);
  await privateComposer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("link", { name: /clipboard\.png/ })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: /^Maya Chen/ }).click();
  await expect(page.getByRole("link", { name: /clipboard\.png/ })).toBeVisible();
  results.push("DM clipboard image, explicit send and durable reload");
  // The deterministic fixture commits, then withholds its send response.
  await context.request.post(`${origin}/__fixture?action=withhold-receipt&actorId=synthetic_alice`, { headers: { origin } });
  const uncertainName = `uncertain-${nonce}.txt`;
  await privateComposer.locator('input[type="file"]').setInputFiles({ name: uncertainName, mimeType: "text/plain", buffer: Buffer.from("Synthetic uncertain file") });
  await expect(privateComposer.getByText("Ready to send", { exact: false })).toBeVisible();
  await privateText.fill(`Uncertain attachment ${nonce}`); await privateComposer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Checking whether this sent", { exact: true })).toBeVisible();
  const sendsBeforeRecovery = requests.length;
  await page.getByRole("button", { name: "Check receipt, then retry", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(uncertainName.replaceAll(".", "\\.")) })).toBeVisible();
  assert.equal(requests.length, sendsBeforeRecovery); results.push("Lost response reconciles same attachment receipt without replay");
  await page.getByRole("button", { name: "Project conversation", exact: true }).click();
  const changedName = `audience-${nonce}.txt`;
  await fileInput.setInputFiles({ name: changedName, mimeType: "text/plain", buffer: Buffer.from("Synthetic audience-bound file") });
  await expect(composer.getByText("Ready to send", { exact: false })).toBeVisible();
  await context.request.post(`${origin}/__fixture?action=remove&actorId=synthetic_charlie`, { headers: { origin } });
  await expect(page.getByRole("button", { name: "Review audience", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(composer.getByText("Prepared for the previous audience.", { exact: false })).toBeVisible();
  const uploadsBeforeReview = uploadRequests.length;
  await page.getByRole("button", { name: "Review audience", exact: true }).click();
  await expect(composer.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  assert.equal(uploadRequests.length, uploadsBeforeReview);
  await composer.getByRole("button", { name: `Upload again ${changedName}`, exact: true }).click();
  await expect(composer.getByText("Ready to send", { exact: false })).toBeVisible();
  assert.equal(uploadRequests.length, uploadsBeforeReview + 1);
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(changedName.replaceAll(".", "\\.")) })).toBeVisible();
  results.push("Audience change pauses send and requires explicit new upload");
  await page.getByRole("button", { name: /^Maya Chen/ }).click();
  await page.screenshot({ path: path.join(output, "desktop-dm.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(privateText).toBeVisible(); await page.screenshot({ path: path.join(output, "phone-dm.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "receipt.json"), JSON.stringify({ origin, synthetic: true, results, errors, sends: requests.map(({ projectId, conversationId, rootId, clientRequestId, expectedAudienceEpoch, attachmentIds }) => ({ projectId, conversationId, rootId, clientRequestId, expectedAudienceEpoch, attachmentIds })) }, null, 2));
  await context.close();
  process.stdout.write(JSON.stringify({ passed: results.length, results, output }) + "\n");
} finally { await browser.close(); }
