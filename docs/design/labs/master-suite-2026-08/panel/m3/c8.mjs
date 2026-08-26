import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
await p.locator(".undated").click();
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() => {
  const drawer = document.querySelector(".drawer");
  const board = document.querySelector(".board");
  const card = document.querySelector("article.card");
  return {
    drawerRole: drawer?.getAttribute("role"), drawerModal: drawer?.getAttribute("aria-modal"), drawerLabel: drawer?.getAttribute("aria-label"),
    boardInert: !!board.closest("[inert]"), boardAriaHidden: !!board.closest("[aria-hidden=true]"),
    cardTabIndex: card.tabIndex, cardInert: !!card.closest("[inert]"),
    cardOpacity: getComputedStyle(card).opacity, cardPE: getComputedStyle(card).pointerEvents,
    scrimPresent: !!document.querySelector(".menuVeil,.scrim,[class*=veil],[class*=scrim]"),
    railInert: !!document.querySelector(".rail")?.closest("[inert]"),
    dockInert: !!document.querySelector(".dock")?.closest("[inert]"),
    headInert: !!document.querySelector(".undated")?.closest("[inert]"),
  };
}), null, 1));
// can the mouse still act on the board?
const before = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join("/"));
await p.locator(".tick").first().click({ trial: false }).catch((e) => console.log("tick click failed:", String(e).slice(0, 80)));
await p.waitForTimeout(600);
const after = await p.evaluate(() => [...document.querySelectorAll(".tray")].map((t) => t.getAttribute("aria-label")).join("/"));
console.log("mouse tick while drawer open changed board?", before !== after, "\n  ", after);
await p.close();
await b.close();
