import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LAB = path.resolve("docs/design/labs/tasks-2026-08");
const url = `${pathToFileURL(path.join(LAB, "floor.html")).href}?state=dense&v=locked`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(500);

const out = await page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return {t:+b.top.toFixed(1),b:+b.bottom.toFixed(1),h:+b.height.toFixed(1)}; };
  const board = document.querySelector(".board");
  const sheet = document.querySelector(".sheet") || board.parentElement;
  const scrim = document.querySelector(".dockScrim");
  const dock = document.querySelector(".dock");
  const trays = [...document.querySelectorAll(".tray")];
  return {
    sheet: { ...r(sheet), cls: sheet.className },
    board: { ...r(board), scrollH: board.scrollHeight, clientH: board.clientHeight, scrolls: board.scrollHeight > board.clientHeight + 1, padBottom: getComputedStyle(board).paddingBottom },
    scrim: scrim ? { ...r(scrim), offsetParent: scrim.offsetParent && scrim.offsetParent.className } : null,
    dock: dock ? r(dock) : null,
    trays: trays.map((tray) => {
      const body = tray.querySelector(".trayBody");
      const head = tray.querySelector(".trayHead");
      const add = tray.querySelector(".trayAdd");
      const cards = [...body.querySelectorAll(".card")];
      const last = cards[cards.length - 1];
      return {
        name: tray.querySelector(".trayName")?.textContent,
        cards: cards.length,
        tray: r(tray),
        head: r(head),
        body: { ...r(body), scrollH: body.scrollHeight, clientH: body.clientHeight, scrolls: body.scrollHeight > body.clientHeight + 1, pb: getComputedStyle(body).paddingBottom },
        add: add ? { ...r(add), text: add.textContent.trim() } : null,
        lastCard: last ? { ...r(last), title: last.querySelector(".cardTitle")?.textContent?.slice(0,50) } : null,
      };
    }),
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
