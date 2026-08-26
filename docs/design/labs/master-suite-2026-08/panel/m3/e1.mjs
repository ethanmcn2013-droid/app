import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width:1440, height:960 });
await p.locator('.b-act:has-text("Preview")').first().click(); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(()=>{const e=document.activeElement;return {cls:String(e.className),tag:e.tagName,ti:e.tabIndex,label:e.getAttribute("aria-label"),txt:(e.textContent||"").replace(/\s+/g," ").trim().slice(0,120),box:(()=>{const r=e.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})()};})));
console.log("live regions text:", JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll("[aria-live],[role=status]")].map(t=>(t.textContent||"").trim().slice(0,80)))));
console.log("any 'preview' word on screen:", await p.evaluate(()=>{const m=document.body.innerText.match(/[^.\n]*[Pp]review[^.\n]*/g);return m||null;}));
await p.screenshot({path:"panel/m3/preview.png"});
// now back
await p.locator('.b-act:has-text("Back to the plan")').click(); await p.waitForTimeout(700);
console.log("back: grabs=", await p.evaluate(()=>document.querySelectorAll(".b-grab").length), "focus=", await p.evaluate(()=>String(document.activeElement.className).split(" ")[0]+"|"+(document.activeElement.getAttribute("aria-label")||document.activeElement.textContent||"").trim().slice(0,40)));
await p.close(); await b.close();
