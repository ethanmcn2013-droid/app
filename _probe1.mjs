import { chromium } from "@playwright/test";
import path from "node:path";
const FILE = "file:///" + path.resolve("docs/design/labs/notes-2026-08/notebook.html").split("\\").join("/");
const b = await chromium.launch();
const errs = [];
async function open(q="", vp={width:1440,height:960}) {
  const p = await b.newPage({viewport:vp});
  p.on("pageerror", e=>errs.push("PAGEERROR "+String(e).split("\n")[0]));
  p.on("console", m=>m.type()==="error"&&errs.push("CONSOLE "+m.text()));
  await p.goto(FILE+q); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
  return p;
}
const log = (...a)=>console.log(...a);

/* PROBE 1: ctrl+z while a NEW draft is in progress */
{
  const p = await open();
  await p.locator(".topField").fill("First note about the cake table.");
  await p.keyboard.press("Control+Enter");
  await p.waitForTimeout(320);
  // now start a SECOND note
  await p.locator(".topField").click();
  await p.locator(".topField").type("Second note I am half way through writing and do not want to lose");
  await p.waitForTimeout(160);
  const draftBefore = await p.locator(".topField").inputValue();
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(240);
  const draftAfter = await p.locator(".topField").inputValue();
  log("P1 draft before ctrl+z:", JSON.stringify(draftBefore));
  log("P1 draft after  ctrl+z:", JSON.stringify(draftAfter));
  log("P1 announced:", JSON.stringify(await p.locator("#say").textContent()));
  // is it recoverable?
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(200);
  log("P1 second ctrl+z ->", JSON.stringify(await p.locator(".topField").inputValue()));
  await p.close();
}

/* PROBE 2: a double quote in a typed note */
{
  const p = await open();
  await p.locator(".topField").fill('Ask the band about the "first dance" song list.');
  await p.keyboard.press("Control+Enter");
  await p.waitForTimeout(340);
  const r = await p.evaluate(()=>{
    const row = document.querySelector(".idxRow");
    const t = row.querySelector(".idxText");
    return { label: row.getAttribute("aria-label"), full: t?t.dataset.full:null, shown: t?t.textContent:null, attrs: [...row.attributes].map(a=>a.name+"="+a.value), outer: row.outerHTML.slice(0,420) };
  });
  log("P2 aria-label:", JSON.stringify(r.label));
  log("P2 data-full :", JSON.stringify(r.full));
  log("P2 shown text:", JSON.stringify(r.shown));
  log("P2 attrs:", JSON.stringify(r.attrs));
  log("P2 outer:", r.outer);
  await p.close();
}

/* PROBE 3: the settle animation — does opacity transition? */
{
  const p = await open();
  const cs = await p.evaluate(()=>{
    const t = document.querySelector(".top");
    const c = getComputedStyle(t);
    return { transitionProperty: c.transitionProperty, transitionDuration: c.transitionDuration };
  });
  log("P3 .top transition:", JSON.stringify(cs));
  const ht = await p.evaluate(()=>{ const c=getComputedStyle(document.createElement("div")); return null; });
  await p.locator(".topField").fill("A note whose settle I am watching.");
  await p.waitForTimeout(120);
  const samples = [];
  await p.keyboard.press("Control+Enter");
  for (let i=0;i<10;i++){
    samples.push(await p.evaluate(()=>{ const t=document.querySelector(".top"); if(!t) return null; const c=getComputedStyle(t); return {o:c.opacity, tr:c.transform, s:t.hasAttribute("data-settling")};}));
    await p.waitForTimeout(30);
  }
  log("P3 opacity/transform samples over 300ms:");
  samples.forEach((s,i)=>log("   t="+(i*30)+"ms", JSON.stringify(s)));
  await p.close();
}
console.log("ERRORS:", JSON.stringify([...new Set(errs)]));
await b.close();
