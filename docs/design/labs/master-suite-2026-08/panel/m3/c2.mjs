import { launch, open } from "./drive.mjs";
const b = await launch();
for (const [W,H] of [[1024,900],[1280,900],[1440,960]]) {
  const p = await open(b, { state: "timeline.owner-flight", width:W, height:H });
  const r = await p.evaluate(()=>{
    const s=[...document.querySelectorAll("*")].filter(e=>{const c=getComputedStyle(e);return (c.overflowY==="auto"||c.overflowY==="scroll")&&e.scrollHeight>e.clientHeight+2;}).map(e=>String(e.className).split(" ")[0]+" "+e.scrollHeight+"/"+e.clientHeight);
    const docScroll=document.documentElement.scrollHeight-document.documentElement.clientHeight;
    const labels=[...document.querySelectorAll(".b-mLabel,.b-moment,[class*=b-m]")].map(e=>({c:String(e.className).split(" ")[0],b:Math.round(e.getBoundingClientRect().bottom)})).filter(x=>x.b>innerHeight);
    return {scrollers:s,docScroll,belowFold:labels.slice(0,6)};
  });
  console.log(W+"x"+H, JSON.stringify(r).slice(0,400));
  await p.close();
}
await b.close();
