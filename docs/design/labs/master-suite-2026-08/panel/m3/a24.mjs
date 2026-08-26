import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
await p.keyboard.press("Tab"); // rail
for(let i=0;i<10;i++){await p.keyboard.press("Tab"); const c=await p.evaluate(()=>String(document.activeElement.className).split(" ")[0]); if(c==="card")break;}
console.log(await p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();const tb=a.closest(".trayBody").getBoundingClientRect();return JSON.stringify({card:[r.x,r.y,r.width,r.height].map(Math.round),trayBody:[tb.x,tb.y,tb.width,tb.height].map(Math.round),cs:getComputedStyle(a.closest(".trayBody")).overflow, pad:getComputedStyle(a.closest(".trayBody")).padding});}));
await p.screenshot({path:"panel/m3/focus-card.png", clip:{x:110,y:180,width:300,height:180}});
// also focus last card in a lane and check bottom clipping
await p.close(); await b.close();
