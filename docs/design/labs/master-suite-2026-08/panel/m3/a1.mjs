import { launch, open } from "./drive.mjs";
const b = await launch();
for (const state of ["tasks.board","notes.notebook","timeline.owner-flight"]) {
  const p = await open(b, { state });
  const r = await p.evaluate(() => {
    const out = { live: [], landmarks: [], headings: [], dupIds: [], ariaBad: [] };
    for (const el of document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")) {
      const cs = getComputedStyle(el);
      out.live.push({ sel: el.tagName.toLowerCase()+"."+String(el.className).split(" ")[0], live: el.getAttribute("aria-live"), role: el.getAttribute("role"), atomic: el.getAttribute("aria-atomic"), text: (el.textContent||"").trim().slice(0,60), display: cs.display, vis: cs.visibility, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, hidden: el.hasAttribute("hidden"), inert: el.closest("[inert]") ? true : false, ariaHidden: !!el.closest("[aria-hidden=true]") });
    }
    for (const el of document.querySelectorAll("main,nav,header,footer,aside,[role=main],[role=navigation],[role=banner],[role=complementary],[role=region]")) {
      const rect = el.getBoundingClientRect();
      out.landmarks.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute("role"), label: el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")||"", vis: rect.width>0&&rect.height>0, cls: String(el.className).split(" ")[0] });
    }
    for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")) {
      const rect = el.getBoundingClientRect();
      out.headings.push({ tag: el.tagName.toLowerCase(), lvl: el.getAttribute("aria-level"), text: (el.textContent||"").trim().slice(0,40), vis: rect.width>0&&rect.height>0 });
    }
    const seen = new Set();
    for (const el of document.querySelectorAll("[id]")) { if (seen.has(el.id)) out.dupIds.push(el.id); seen.add(el.id); }
    for (const el of document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns],[aria-activedescendant]")) {
      for (const attr of ["aria-labelledby","aria-describedby","aria-controls","aria-owns","aria-activedescendant"]) {
        const v = el.getAttribute(attr); if (!v) continue;
        for (const id of v.split(/\s+/)) if (!document.getElementById(id)) out.ariaBad.push({ el: el.tagName.toLowerCase()+"."+String(el.className).split(" ")[0], attr, id });
      }
    }
    return out;
  });
  console.log("=== "+state);
  console.log(JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
