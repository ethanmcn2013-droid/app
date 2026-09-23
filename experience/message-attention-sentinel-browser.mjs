import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Browser geometry check for the bounded top sentinel used by both rendered
// message and comment rows. A tall row cannot reach a 0.6 whole-row ratio.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  await page.setContent(`<!doctype html><style>
    #reading { width: 320px; height: 320px; overflow: auto; }
    .row { height: 1800px; position: relative; }
    .sentinel { position: absolute; inset: 0 0 auto; height: 24px; pointer-events: none; }
  </style><div id="reading"><article class="row" data-message-id="tall">
    <span class="sentinel" data-message-observe data-observe-message-id="tall"></span>
    <p>Long message</p></article><article class="row" hidden data-message-id="hidden">
    <span class="sentinel" data-message-observe data-observe-message-id="hidden"></span>
  </article></div>`);
  await page.evaluate(() => {
    window.attentionHits = [];
    const reading = document.getElementById("reading");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio >= 0.6)
        window.attentionHits.push(entry.target.dataset.observeMessageId);
    }, { root: reading, threshold: 0.6 });
    reading.querySelectorAll("[data-message-observe]").forEach(node => observer.observe(node));
  });
  await page.waitForFunction(() => window.attentionHits.includes("tall"));
  const evidence = await page.evaluate(() => {
    const reading = document.getElementById("reading").getBoundingClientRect();
    const row = document.querySelector('[data-message-id="tall"]').getBoundingClientRect();
    return { wholeRowRatioCeiling: reading.height / row.height, hits: window.attentionHits };
  });
  assert.ok(evidence.wholeRowRatioCeiling < 0.6);
  assert.deepEqual(evidence.hits, ["tall"]);
  console.log("PASS tall-item top sentinel observed; hidden row remained unread");
} finally { await browser.close(); }
