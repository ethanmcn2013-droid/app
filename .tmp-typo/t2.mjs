import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  function lines(el){
    const t = el.firstChild && el.firstChild.nodeType===3 ? el.firstChild : null;
    const txt = el.textContent;
    // walk words, group by top
    const rng = document.createRange();
    const node = el.childNodes[0];
    if(!node || node.nodeType!==3) return null;
    const s = node.textContent; const out=[]; let cur=null;
    let i=0;
    while(i<s.length){
      let j = s.indexOf(" ", i); if(j===-1) j=s.length;
      rng.setStart(node,i); rng.setEnd(node,j);
      const rect = rng.getClientRects()[0]; if(!rect){i=j+1;continue;}
      const top = Math.round(rect.top);
      if(!cur || Math.abs(cur.top-top)>2){ cur={top, words:[], right:0, left:rect.left}; out.push(cur); }
      cur.words.push(s.slice(i,j)); cur.right = rect.right;
      i=j+1;
    }
    const boxW = el.getBoundingClientRect().width;
    return out.map(l=>({txt:l.words.join(" "), n:l.words.length, fill: Math.round((l.right-l.left)/boxW*100)}));
  }
  const out = {titles:[], notes:[]};
  document.querySelectorAll(".cardTitle").forEach(n=>out.titles.push({t:n.textContent.trim(), L:lines(n)}));
  document.querySelectorAll(".cardNote").forEach(n=>out.notes.push({t:n.textContent.trim(), L:lines(n)}));
  return out;
});
console.log(JSON.stringify(r,null,1));
await b.close();
