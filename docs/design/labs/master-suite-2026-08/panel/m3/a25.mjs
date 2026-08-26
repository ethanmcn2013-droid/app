import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "notes.seam", width:1440, height:960 });
const facts = async(tag)=>{
  const r = await p.evaluate(()=>{
    const head = document.querySelector('main.sheet:not([inert]) .head, .app:not([inert]) .head');
    return { headText: (document.querySelector("[data-app='tasks'] .head")?.textContent||"").replace(/\s+/g," ").trim().slice(0,180),
      notesHead: (document.querySelector("[data-app='notes'] .head")?.textContent||"").replace(/\s+/g," ").trim().slice(0,180),
      tlHead: (document.querySelector(".tlHead")?.textContent||"").replace(/\s+/g," ").trim().slice(0,200),
      trays: [...document.querySelectorAll(".tray")].map(t=>t.getAttribute("aria-label")),
      alreadyIn: (document.querySelector(".deskFactRow, .alreadyHead, [class*=already]")?.textContent||"").replace(/\s+/g," ").trim().slice(0,120)
    };
  });
  console.log("--- "+tag); console.log(JSON.stringify(r,null,1));
};
await facts("before");
await p.locator('[data-act="send"]').first().click(); await p.waitForTimeout(700);
await facts("after send");
await p.close(); await b.close();
