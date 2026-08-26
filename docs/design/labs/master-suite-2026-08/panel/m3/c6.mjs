import { launch, open } from "./drive.mjs";

const b = await launch();
for (const [W, H] of [[1440, 960], [1280, 900], [1920, 1000]]) {
  const p = await open(b, { state: "tasks.board", width: W, height: H });
  await p.locator(".undated").click();
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const sheet = document.querySelector('[data-app="tasks"] .sheet');
    const board = document.querySelector(".board");
    const fadeAfter = getComputedStyle(sheet, "::after");
    const fadeBefore = getComputedStyle(sheet, "::before");
    return {
      moreRight: sheet.hasAttribute("data-more-right"),
      moreLeft: sheet.hasAttribute("data-more-left"),
      scrollW: board.scrollWidth, clientW: board.clientWidth, scrollL: board.scrollLeft,
      afterContent: fadeAfter.content, afterW: fadeAfter.width, afterBg: fadeAfter.backgroundImage.slice(0, 70), afterOpacity: fadeAfter.opacity,
      beforeContent: fadeBefore.content, beforeW: fadeBefore.width, beforeOpacity: fadeBefore.opacity,
      lanesVisible: [...document.querySelectorAll(".tray")].map((t) => {
        const rr = t.getBoundingClientRect(); const br = board.getBoundingClientRect();
        return t.getAttribute("aria-label").split(",")[0] + ":" + (rr.left >= br.left - 1 && rr.right <= br.right + 1 ? "full" : rr.left > br.right ? "off" : "clipped");
      }),
    };
  });
  console.log(W + "x" + H, JSON.stringify(r, null, 0));
  await p.close();
}
await b.close();
