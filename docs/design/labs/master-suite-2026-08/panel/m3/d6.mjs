import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width:1440, height:960 });
console.log("before:", await p.evaluate(()=>{const d=document.querySelector("details");return d?{open:d.open,txt:(d.textContent||"").replace(/\s+/g," ").trim().slice(0,140)}:null;}));
await p.locator(".b-behindSummary").click(); await p.waitForTimeout(600);
console.log("after:", await p.evaluate(()=>{const d=document.querySelector("details");return d?{open:d.open,txt:(d.textContent||"").replace(/\s+/g," ").trim().slice(0,260),focusables:[...d.querySelectorAll("button,a[href],[tabindex='0']")].map(e=>(e.getAttribute("aria-label")||e.textContent).trim().slice(0,40))}:null;}));
await p.screenshot({path:"panel/m3/behind2.png"});
// tab from summary
await p.keyboard.press("Tab"); 
console.log("next stop:", await p.evaluate(()=>{const a=document.activeElement;return a===document.body?"BODY":String(a.className).split(" ")[0]+" | "+(a.getAttribute("aria-label")||a.textContent||"").trim().slice(0,40);}));
await p.close(); await b.close();
