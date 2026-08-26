import { chromium } from "@playwright/test";
const B = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });

const FIX = () => {
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains("b-behindDetails") || !d.open) return;
    const rows = d.querySelectorAll(".b-behindRow");
    if (rows.length) rows[rows.length - 1].scrollIntoView({ block: "nearest" });
    d.querySelector("summary").scrollIntoView({ block: "nearest" });
  }, true);
};

async function run(url, w, h, fix) {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(350);
  if (fix) await p.evaluate(FIX);
  const has = await p.evaluate(()=>!!document.querySelector(".b-behindDetails"));
  if (!has) return "no details";
  // record all scroller positions before
  const before = await p.evaluate(()=> {
    const all=[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1);
    return {list: all.map(e=>({c:e.className&&e.className.baseVal!==undefined?"svg":String(e.className).slice(0,40), t:Math.round(e.scrollTop), l:Math.round(e.scrollLeft)})), win:[Math.round(scrollX),Math.round(scrollY)]};
  });
  await p.evaluate(()=>document.querySelector(".b-behindSummary").focus());
  await p.keyboard.press("Enter");
  await p.waitForTimeout(600);
  const after = await p.evaluate(()=> {
    const d=document.querySelector(".b-behindDetails"), sh=d.closest(".app.sheet"), shr=sh.getBoundingClientRect();
    const rows=[...d.querySelectorAll(".b-behindRow")];
    const vis=rows.filter(r=>{const bb=r.getBoundingClientRect(); return bb.top>=shr.top-0.5&&bb.bottom<=shr.bottom+0.5;}).length;
    const s=d.querySelector("summary").getBoundingClientRect();
    const sumVis = s.top>=shr.top-0.5 && s.bottom<=shr.bottom+0.5;
    const n=document.querySelector('.b-behindNote[data-when="open"]');
    const noteVis = n ? (n.getBoundingClientRect().bottom<=shr.bottom+0.5 && n.getBoundingClientRect().top>=shr.top-0.5) : null;
    const all=[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1);
    return {vis, total:rows.length, sumVis, noteVis, scrollTop:Math.round(sh.scrollTop), max:Math.round(sh.scrollHeight-sh.clientHeight),
      list: all.map(e=>({c:String(e.className).slice(0,40), t:Math.round(e.scrollTop), l:Math.round(e.scrollLeft)})), win:[Math.round(scrollX),Math.round(scrollY)]};
  });
  const moved = after.list.filter((e,i)=>{const m=before.list.find(x=>x.c===e.c); return m && (m.t!==e.t||m.l!==e.l);}).map(e=>e.c+":"+e.t);
  return `rows ${after.vis}/${after.total} sumVis=${after.sumVis} noteVis=${after.noteVis} st=${after.scrollTop}/${after.max} win=${after.win} moved=[${moved.join(" ")}]`;
}

const urls = [
  ["owner-flight", B+"&state=timeline.owner-flight"],
  ["owner-flight across", B+"&state=timeline.owner-flight&layout=across"],
  ["desk", B+"&state=timeline.desk"],
  ["desk across", B+"&state=timeline.desk&layout=across"],
  ["phone", B+"&state=timeline.phone"],
];
for (const [name,u] of urls) {
  for (const [w,h] of [[1440,960],[1920,1000],[1280,900],[1024,900],[768,1024],[390,844]]) {
    const off = await run(u,w,h,false);
    const on  = await run(u,w,h,true);
    console.log(`${name} ${w}x${h}\n   OFF ${off}\n   FIX ${on}`);
  }
}
await b.close();
