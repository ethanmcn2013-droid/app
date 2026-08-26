import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
console.log(JSON.stringify(await p.evaluate(()=>{
  const out={};
  const hn=document.querySelector("button.headNext");
  out.headNext = hn?{inertAncestor:!!hn.closest("[inert]"), offsetParent:hn.offsetParent===null?"null":"has", checkVis: hn.checkVisibility?hn.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}):"n/a", ownDisplay:getComputedStyle(hn).display, rect:hn.getBoundingClientRect().width, ti:hn.tabIndex}:null;
  const sr=document.querySelector("span.sr");
  out.sr = sr?{cls:sr.className, cs:(()=>{const c=getComputedStyle(sr);return {overflow:c.overflow,w:c.width,h:c.height,clip:c.clipPath||c.clip,pos:c.position,to:c.textOverflow};})(), scrollW:sr.scrollWidth, clientW:sr.clientWidth, txt:(sr.textContent||"").slice(0,50)}:null;
  out.srCount = document.querySelectorAll("span.sr").length;
  // can headNext actually receive focus?
  hn && hn.focus();
  out.focusWent = document.activeElement===hn ? "TO THE INVISIBLE BUTTON" : String(document.activeElement.tagName);
  return out;
}),null,1));
await p.close(); await b.close();
