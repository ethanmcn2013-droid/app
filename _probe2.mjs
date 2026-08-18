import { chromium } from "@playwright/test";
import path from "node:path";
const FILE = "file:///" + path.resolve("docs/design/labs/notes-2026-08/notebook.html").split("\\").join("/");
const b = await chromium.launch();
const errs=[];
async function open(q="", vp={width:1440,height:960}) {
  const p = await b.newPage({viewport:vp});
  p.on("pageerror", e=>errs.push("PAGEERROR "+String(e).split("\n")[0]));
  p.on("console", m=>m.type()==="error"&&errs.push("CONSOLE "+m.text()));
  await p.goto(FILE+q, {waitUntil:"load"}); await p.waitForTimeout(400); try{await p.evaluate(()=>document.fonts.ready);}catch(e){} await p.waitForTimeout(200);
  return p;
}
const log=(...a)=>console.log(...a);

/* P4: the dock painting over the index's last rows (desktop) */
for (const [state,vp] of [["notebook",{width:1440,height:960}],["notebook",{width:1280,height:800}],["pressure",{width:1440,height:960}]]) {
  const p = await open("?state="+state, vp);
  const r = await p.evaluate(()=>{
    const idx=document.getElementById("index");
    idx.scrollTop = idx.scrollHeight;
    return new Promise(res=>setTimeout(()=>{ res((()=>{
      const rows=[...document.querySelectorAll(".idxRow")];
      const last=rows[rows.length-1].getBoundingClientRect();
      const dock=document.querySelector(".dock").getBoundingClientRect();
      const wrap=document.querySelector(".dockWrap");
      const scrim=wrap?wrap.getBoundingClientRect():null;
      // what is actually at the centre of the last row?
      const el=document.elementFromPoint(last.left+last.width/2, last.top+last.height/2);
      const elLeft=document.elementFromPoint(last.left+30, last.top+last.height/2);
      return { lastBottom:last.bottom, lastTop:last.top, dockTop:dock.top, dockBottom:dock.bottom,
        scrimTop: scrim? scrim.top:null,
        overlapPx: Math.max(0, last.bottom-dock.top),
        hitCentre: el? (el.className||el.tagName)+"" : null,
        hitLeft: elLeft? (elLeft.className||elLeft.tagName)+"":null,
        indexPadBottom: getComputedStyle(idx).paddingBottom,
        atEnd: idx.scrollTop+idx.clientHeight >= idx.scrollHeight-1 }; })()); },160));
  });
  log("P4", state, vp.width+"x"+vp.height, JSON.stringify(r));
  await p.close();
}

/* P5: arrow keys in states where the rendered list is not visible() */
for (const st of ["not-yet","nothing","seam","readback","review"]) {
  const p = await open("?state="+st);
  await p.evaluate(()=>document.body.focus());
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(180);
  const r = await p.evaluate(()=>({
    said: document.getElementById("say").textContent,
    active: document.activeElement ? (document.activeElement.className||document.activeElement.tagName) : null,
    cursorRows: document.querySelectorAll(".idxRow[data-cursor]").length,
    rows: document.querySelectorAll(".idxRow").length,
  }));
  log("P5", st, JSON.stringify(r));
  await p.close();
}

/* P6: inert controls — every [data-act] with no branch, plus rail tiles */
{
  const p = await open();
  const acts = await p.evaluate(()=>{
    const set=new Set();
    for (const el of document.querySelectorAll("[data-act]")) set.add(el.dataset.act);
    return [...set];
  });
  log("P6 notebook data-acts:", JSON.stringify(acts));
  // click the rail Tasks tile and see if anything happens
  const before = await p.evaluate(()=>document.documentElement.getAttribute("data-state"));
  await p.locator('.railTile[aria-label="Tasks"]').click();
  await p.waitForTimeout(200);
  log("P6 rail Tasks click -> state", before, "->", await p.evaluate(()=>document.documentElement.getAttribute("data-state")), "said:", JSON.stringify(await p.locator("#say").textContent()));
  // open a note, click Turn into a task
  await p.locator(".idxRow").nth(2).click(); await p.waitForTimeout(200);
  const html1 = await p.evaluate(()=>document.querySelector(".sheet").innerHTML.length);
  await p.locator('[data-act="peel"]').click(); await p.waitForTimeout(300);
  log("P6 'Turn into a task' click -> peel present?", await p.locator(".peel").count(), "state:", await p.evaluate(()=>document.documentElement.getAttribute("data-state")), "said:", JSON.stringify(await p.locator("#say").textContent()));
  await p.close();
}
{
  const p = await open("?state=seam");
  await p.locator('[data-act="send"]').click(); await p.waitForTimeout(300);
  log("P7 seam Send click -> state", await p.evaluate(()=>document.documentElement.getAttribute("data-state")), "said:", JSON.stringify(await p.locator("#say").textContent()), "peel still:", await p.locator(".peel").count());
  await p.close();
}
{
  const p = await open("?state=search");
  await p.locator("#q").fill("zzzz"); await p.waitForTimeout(240);
  await p.locator('[data-act="nearest"]').click(); await p.waitForTimeout(300);
  log("P8 no-result 'Open that one' -> rows", await p.locator(".idxRow").count(), "readBody", await p.locator(".readBody").count(), "q", await p.locator("#q").inputValue(), "said", JSON.stringify(await p.locator("#say").textContent()));
  await p.close();
}
{
  const p = await open("?state=not-yet");
  await p.locator('[data-act="destroy"]').click(); await p.waitForTimeout(300);
  log("P9 not-yet 'Delete it' -> said", JSON.stringify(await p.locator("#say").textContent()), "undo strip", await p.locator(".undo").count());
  await p.locator('[data-act="retry"]').first().click(); await p.waitForTimeout(250);
  log("P9 'Try now' -> said", JSON.stringify(await p.locator("#say").textContent()));
  await p.close();
}
/* P10: role=list without listitems */
{
  const p = await open();
  const r = await p.evaluate(()=>{
    const l=document.getElementById("index");
    return { role:l.getAttribute("role"), childRoles: [...l.children].map(c=>c.getAttribute("role")||c.tagName+"."+c.className) };
  });
  log("P10", JSON.stringify(r).slice(0,600));
  await p.close();
}
/* P11: keep-both fake undo */
{
  const p = await open("?state=readback");
  const before = await p.locator(".indexHead .cnt").textContent();
  await p.locator('[data-act="keep-both"]').click(); await p.waitForTimeout(300);
  const after = await p.locator(".indexHead .cnt").textContent();
  log("P11 count before/after 'Put both on the pile':", before.trim(), "->", after.trim(), "| rows", await p.locator(".idxRow").count(), "| strip:", JSON.stringify(await p.locator(".undo span").textContent()));
  await p.locator('[data-act="undo"]').click(); await p.waitForTimeout(250);
  log("P11 after undo: count", (await p.locator(".indexHead .cnt").textContent()).trim(), "said", JSON.stringify(await p.locator("#say").textContent()));
  await p.close();
}
console.log("ERRORS:", JSON.stringify([...new Set(errs)]));
await b.close();
