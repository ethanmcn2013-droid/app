/* ═══════════════════════════════════════════════════════════════════
   FLOW — the founder's own closing test, driven as ONE session.

   Every other assertion in this lab opens a fresh page, does one thing
   and closes it. That is the right way to test a behaviour and the wrong
   way to find what this file is for: state that survives an interaction
   it should not have survived. A filter left on across a project switch,
   an open panel that outlives the card it described, a search that keeps
   filtering a board whose contents it has never seen — none of those can
   appear in a test that only ever does one thing.

   So this is one page, one browser, and the whole sequence the founder
   wrote out, in order, with the board checked between every step.
   ═══════════════════════════════════════════════════════════════════ */

export async function flow({ browser, url, check, head }) {
  head("17 · the whole flow, in one sitting");

  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(url + "?v=paper&state=tasks.board");
  await page.waitForTimeout(800);

  const step = async (name, fn, detail) => {
    const r = await page.evaluate(fn);
    check("flow", name, r.ok === true, detail ? detail(r) : JSON.stringify(r));
    return r;
  };

  /* 1 · Open Tasks, on The Orchard. */
  await step("opens on Tasks, showing The Orchard", () => {
    const name = (document.querySelector(".projSwitch span") || {}).textContent || "";
    return { ok: /Orchard/.test(name), name };
  }, (r) => r.name);

  /* 2 · Switch to Academic Year 2026 — Tasks, Timeline and Planning move. */
  await step("switching project moves Tasks, Timeline and Planning together", async () => {
    const go = async (id) => {
      const b = document.querySelector('[data-act="projects"]');
      if (b.getAttribute("aria-expanded") !== "true") b.click();
      await new Promise((r) => setTimeout(r, 320));
      document.querySelector(`[data-project="${id}"]`).click();
      await new Promise((r) => setTimeout(r, 900));
    };
    await go("academic");
    const tasks = [...document.querySelectorAll(".board .card .cardTitle")].map((e) => e.textContent);
    const tl = document.querySelector('[data-app="timeline"]').textContent || "";
    return {
      ok: tasks.some((t) => /literature review/i.test(t)) &&
          /Marketing strategy assignment/i.test(tl) &&
          !/Mara & Finn|marquee/.test(document.querySelector('[data-app="tasks"]').textContent) &&
          !/Mara & Finn/.test(tl),
      board: tasks.length, timelineHasWedding: /Mara & Finn/.test(tl),
    };
  });

  /* 3 · And back, with nothing of the other project left behind. */
  await step("switching back restores The Orchard and leaves nothing behind", async () => {
    const b = document.querySelector('[data-act="projects"]');
    if (b.getAttribute("aria-expanded") !== "true") b.click();
    await new Promise((r) => setTimeout(r, 320));
    document.querySelector('[data-project="orchard"]').click();
    await new Promise((r) => setTimeout(r, 900));
    const scope = [...document.querySelectorAll('[data-app="tasks"], [data-app="timeline"]')]
      .map((e) => e.textContent).join(" ");
    return { ok: /marquee/.test(scope) && !/MK3021|literature review/.test(scope) };
  });

  /* 4 · Open a task, and close it. */
  await step("a task opens into the expanded surface and closes again", async () => {
    const card = document.querySelector('.board [data-lane="doing"] .card');
    const t = card.querySelector(".cardTitle").getBoundingClientRect();
    const at = { clientX: t.x + t.width / 2, clientY: t.y + t.height / 2, bubbles: true };
    card.dispatchEvent(new PointerEvent("pointerdown", at));
    card.querySelector(".cardTitle").dispatchEvent(new PointerEvent("pointerup", at));
    await new Promise((r) => setTimeout(r, 450));
    const opened = Boolean(document.querySelector(".taskPanel"));
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 350));
    return { ok: opened && !document.querySelector(".taskPanel"), opened };
  });

  /* 5 · Complete a task with the tick — the moment fires. */
  await step("completing with the tick fires the moment exactly once", async () => {
    const before = document.querySelectorAll('[data-lane="done"] .card').length;
    document.querySelector('.board [data-lane="todo"] .card .tick').click();
    await new Promise((r) => setTimeout(r, 130));
    const bursts = document.querySelectorAll(".burst").length;
    await new Promise((r) => setTimeout(r, 900));
    return {
      ok: bursts === 1 && document.querySelectorAll('[data-lane="done"] .card').length === before + 1 &&
        document.querySelectorAll(".burst").length === 0,
      bursts, before,
    };
  });

  /* 6 · And by carrying a card into Done — the SAME feedback. */
  await step("carrying a card into Done fires the same moment", async () => {
    const card = document.querySelector('.board [data-lane="todo"] .card');
    card.focus();
    const key = (k) => document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    key(" ");
    for (let i = 0; i < 4; i++) key("ArrowRight");
    key(" ");
    await new Promise((r) => setTimeout(r, 130));
    const bursts = document.querySelectorAll(".burst").length;
    await new Promise((r) => setTimeout(r, 900));
    return { ok: bursts === 1, bursts };
  });

  /* 7 · Search opens, filters, and closes without moving the board. */
  await step("search opens and closes without moving the board", async () => {
    const card = () => {
      const c = document.querySelector(".board .card");
      const r = c.getBoundingClientRect();
      return Math.round(r.left) + "," + Math.round(r.top);
    };
    const before = card();
    const input = document.querySelector(".dockInput");
    input.focus();
    await new Promise((r) => setTimeout(r, 400));
    const during = card();
    input.value = "welcome";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const filtered = document.querySelectorAll(".board .card").length;
    document.querySelector(".dockInput").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 350));
    document.querySelector(".dockInput").blur();
    await new Promise((r) => setTimeout(r, 400));
    return { ok: before === during && filtered > 0 && filtered < 13, before, during, filtered };
  });

  /* 8 · More, via the plus. Then Settings. */
  await step("the plus opens More, and Settings is reachable and honest", async () => {
    document.querySelector('.rail [data-rail="more"]').click();
    await new Promise((r) => setTimeout(r, 320));
    const doors = [...document.querySelectorAll(".morePop .moreItem")].length;
    /* On the FOCUSED element, which is what a browser does. The rail's
       listener is on the deck, and events bubble UP — an Escape dispatched
       on `document` can never reach a listener on one of its descendants.
       Dispatching there reported the panel as un-closable while a real
       Escape closes it every time. */
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 260));
    const gear = document.querySelector('.rail [data-rail="settings"]');
    return {
      ok: doors >= 3 && !document.querySelector(".morePop") && gear &&
        gear.getAttribute("aria-disabled") === "true" &&
        /not here yet/i.test(gear.getAttribute("title") || ""),
      doors,
    };
  });

  /* 9 · Walk the whole spine and come back. */
  await step("Notes, Tasks and Timeline all still work after all of that", async () => {
    const seen = {};
    for (const p of ["notes", "timeline", "tasks"]) {
      document.querySelector(`.rail [data-rail="${p}"]`).click();
      await new Promise((r) => setTimeout(r, 600));
      const host = document.querySelector(`[data-app="${p}"]`);
      seen[p] = !host.hasAttribute("hidden") && host.textContent.trim().length > 40;
    }
    return { ok: seen.notes && seen.timeline && seen.tasks, seen };
  });

  /* 10 · And after every one of those, the console is still silent. Errors
     collected across the WHOLE session, not per page — a handler that only
     throws on the third interaction is invisible to a per-page check. */
  check("flow", "the whole session is silent",
    errors.length === 0, errors.length ? errors.slice(0, 2).join(" | ") : "0 errors across ten steps");

  await page.close();
}
