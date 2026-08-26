import { chromium } from "@playwright/test";
const base = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });

async function srDump(page){
  return await page.evaluate(()=>Array.from(document.querySelectorAll(".sr,[aria-live]")).map(n=>({cls:n.className, live:n.getAttribute("aria-live"), text:n.textContent.trim(), app: (n.closest("[data-app]")||{}).dataset?.app })));
}

for (const st of ["notes.notebook","tasks.board","timeline.owner-flight","timeline.desk"]) {
  await p.goto(base+st);
  await p.waitForTimeout(700);
  const before = await srDump(p);
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(500);
  const after = await srDump(p);
  const focus = await p.evaluate(()=>{const a=document.activeElement;return a?a.tagName+"."+a.className+"#"+a.id:"none";});
  const overlay = await p.evaluate(()=>!!document.querySelector(".searchTop"));
  console.log("=== "+st);
  console.log(" focus:", focus, " searchTop:", overlay);
  console.log(" before:", JSON.stringify(before));
  console.log(" after :", JSON.stringify(after));
}

// Tasks dock field attributes
await p.goto(base+"tasks.board");
await p.waitForTimeout(600);
console.log("=== tasks dockField attrs");
console.log(await p.evaluate(()=>{
  const el=document.querySelector('[data-app="tasks"] .dockField');
  if(!el) return "none";
  const o={html:el.outerHTML.slice(0,400)};
  for(const a of el.attributes) o[a.name]=a.value;
  return o;
}));
console.log("=== tasks headSearch attrs");
console.log(await p.evaluate(()=>{
  const el=document.querySelector('[data-app="tasks"] .headSearch');
  if(!el) return "none";
  const o={};
  for(const a of el.attributes) o[a.name]=a.value;
  return o;
}));
console.log("=== notes dockField attrs");
await p.goto(base+"notes.notebook"); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
  const el=document.querySelector('[data-app="notes"] .dockField');
  if(!el) return "none";
  const o={text:el.textContent.trim()};
  for(const a of el.attributes) o[a.name]=a.value;
  return o;
}));
console.log("=== timeline: any kbd/K advertised?");
await p.goto(base+"timeline.owner-flight"); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
  const app=document.querySelector('[data-app="timeline"]');
  const kbds=Array.from(app.querySelectorAll("kbd")).map(k=>k.textContent);
  const srch=Array.from(app.querySelectorAll("*")).filter(n=>n.children.length===0&&/search/i.test(n.textContent)).map(n=>n.tagName+":"+n.textContent.trim());
  const dockHtml=(app.querySelector(".dock")||{}).outerHTML||"no dock";
  return {kbds, srch, dockHtml: dockHtml.slice(0,900)};
}));
await b.close();
