import { launch, open } from "./drive.mjs";
const b = await launch();
for (const n of [0,1,2]) {
  const p = await open(b, { state: "notes.seam", width:1440, height:960 });
  await p.evaluate(()=>{window.__a=[];for(const t of document.querySelectorAll("[aria-live],[role=status]"))new MutationObserver(()=>window.__a.push((t.textContent||"").trim().slice(0,200))).observe(t,{childList:true,subtree:true,characterData:true});});
  const before = await p.evaluate(()=>document.body.innerText.length);
  await p.locator('.index[aria-label="Already in Tasks"] .idxRow').nth(n).click({force:true});
  await p.waitForTimeout(800);
  console.log("row",n,"ann:",JSON.stringify(await p.evaluate(()=>window.__a)),"| bodyLenDelta:",(await p.evaluate(()=>document.body.innerText.length))-before,"| hasNoteBody:",await p.evaluate(()=>/Linen supplier rang|Mara asked about a late checkout|Registrar confirmed she can do 2pm/.test(document.body.innerText)));
  await p.close();
}
await b.close();
