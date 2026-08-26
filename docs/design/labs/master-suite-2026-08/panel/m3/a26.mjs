import { launch, open } from "./drive.mjs";
const b = await launch();
// Tasks: tick + undo + focus + scroll, with real input
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
await p.evaluate(()=>{window.__ann=[];for(const t of document.querySelectorAll("[aria-live],[role=status]"))new MutationObserver(()=>window.__ann.push((t.textContent||"").trim().slice(0,140))).observe(t,{childList:true,subtree:true,characterData:true});});
const dump=async(t)=>console.log(t,JSON.stringify(await p.evaluate(()=>{const x=window.__ann;window.__ann=[];return x;})));
const st=async()=>await p.evaluate(()=>({act:String(document.activeElement.className).split(" ")[0]+"|"+(document.activeElement.getAttribute("aria-label")||"").slice(0,36),
  head:(document.querySelector("[data-app='tasks'] .headFacts")?.textContent||"").replace(/\s+/g," ").trim(),
  trays:[...document.querySelectorAll(".tray")].map(t=>t.getAttribute("aria-label")).join(" / "),
  boardScroll: document.querySelector(".board")?.scrollLeft, trayScroll: [...document.querySelectorAll(".trayBody")].map(t=>t.scrollTop).join(",")}));
console.log("before", JSON.stringify(await st()));
await p.locator(".tick").first().click(); await p.waitForTimeout(600); await dump("tick"); console.log("after tick", JSON.stringify(await st()));
await p.keyboard.press("Control+z"); await p.waitForTimeout(600); await dump("undo"); console.log("after undo", JSON.stringify(await st()));
// filter chips
await p.locator(".late").nth(1).click(); await p.waitForTimeout(600); await dump("filter"); console.log("filtered", JSON.stringify(await st()));
await p.screenshot({path:"panel/m3/filtered.png"});
await p.close(); await b.close();
