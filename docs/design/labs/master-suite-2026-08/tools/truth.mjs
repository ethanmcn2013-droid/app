/* ═══════════════════════════════════════════════════════════════════
   WHAT THE SUITE SAYS ABOUT ITSELF — round 1, batch 2.

   Seven `misleading` findings from three seats. A product that lies is
   worse than one that visibly fails, because the failure is at least
   honest — so these outrank every defect in the round.

     · The seam promised, in bold, directly above the button, that Tasks
       receives only the words you picked. It sent the whole private note.
     · The same couple carried two irreconcilable wedding days: Notes and
       Tasks said this Saturday, Timeline said 3 October, 79 days out.
     · The ledger counted three crossings while the index badged six.
     · Notes painted two account tiles, one of which said it did nothing
       and one of which did something.

   Every assertion below was written before the fix and watched failing.
   ═══════════════════════════════════════════════════════════════════ */

export async function truth({ browser, url, check, head }) {
  head("11 · what the suite says about itself");

  const open = async (query, width) => {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 960 } });
    await page.goto(url + query);
    await page.waitForTimeout(700);
    return page;
  };

  /* ── the seam keeps its own promise ──────────────────────────────
     WATCHED FAILING: cross() put `note: entry.body` on the card, so the
     whole note a person had just been promised would stay private was
     printed on the board one click later. */
  {
    const page = await open("?p=notes", 1440);
    /* Open a note that has not crossed, pick its words, peel, send. */
    const body = await page.evaluate(() => {
      const row = [...document.querySelectorAll('[data-app="notes"] .idxRow')]
        .find((r) => !/In Tasks/.test(r.textContent));
      row.click();
      return null;
    });
    await page.waitForTimeout(400);
    const whole = await page.evaluate(() => {
      const el = document.querySelector('[data-app="notes"] .readBody');
      return el ? el.textContent.trim() : null;
    });
    /* Pick one SENTENCE, not the whole note, so the promise has something
       to be measured against. */
    const picked = await page.evaluate(() => {
      const el = document.querySelector('[data-app="notes"] .readBody');
      /* The first TEXT node, and an offset inside that node — a note is
         set as prose with marks in it, so the body's own text and any one
         child's text are different lengths and the offset from one does
         not address the other. */
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null;
      while ((node = walk.nextNode())) if (node.textContent.trim().length > 20) break;
      if (!node) return null;
      const stop = node.textContent.indexOf(".");
      const end = stop > 0 ? stop + 1 : Math.min(60, node.textContent.length);
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, end);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      return range.toString().trim();
    });
    await page.waitForTimeout(400);
    const peel = await page.$('[data-app="notes"] [data-act="peel"]');
    if (peel) { await peel.click(); await page.waitForTimeout(400); }
    const send = await page.$('[data-app="notes"] [data-act="send"]');
    if (send) { await send.click(); await page.waitForTimeout(600); }

    const card = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-app="tasks"] .card[data-id^="seam_"]')];
      const el = rows[rows.length - 1];
      if (!el) return null;
      return {
        id: el.dataset.id,
        title: (el.querySelector(".cardTitle") || {}).textContent || "",
        note: (el.querySelector(".cardNote") || {}).textContent || "",
        all: el.textContent,
      };
    });
    check("truth", "the crossing lands", Boolean(card), card ? card.id : "no card");
    if (card && whole && picked) {
      /* The promise, measured: nothing from the note that was not picked
         may appear on the board. The note's own unpicked remainder is the
         thing being protected, so that is what is looked for. */
      const rest = whole.replace(picked, "").trim();
      const leakedFrom = rest
        .split(/(?<=\.)\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 24)
        .filter((s) => card.all.includes(s.slice(0, 24)));
      check("truth", "…carrying only the words that were picked", leakedFrom.length === 0,
        leakedFrom.length ? `LEAKED: “${leakedFrom[0].slice(0, 70)}…”`
          : `${picked.length} chars picked, ${rest.length} chars kept back`);
      /* "Only the picked words" must not be satisfied by sending none of
         them. The promise is that Tasks RECEIVES these words — a card
         that arrives empty keeps the letter of it and breaks the point. */
      const key = picked.replace(/^\W+/, "").slice(0, 20);
      check("truth", "…and the picked words are actually there",
        card.all.includes(key), `looking for “${key}” in the card`);
    }
    await page.close();
  }

  /* ── one couple, one wedding day ─────────────────────────────────
     WATCHED FAILING: Notes' head read "Mara & Finn · Saturday 18 July, in
     2 days" while Timeline's count read 79 and its date read Saturday 3
     October. The suite's whole claim is one world. */
  {
    const page = await open("?p=notes", 1440);
    const said = await page.evaluate(() => {
      const W = window.WORLD, N = window.NOTES, T = window.__TLFIXTURE;
      return {
        world: W.wedding ? W.wedding.date : null,
        couple: W.wedding ? W.wedding.couple : null,
        timeline: T.project.primaryDate.date,
        timelineName: T.project.name,
        notesSubject: N.subjects["mara-finn"].when,
        notesSubjectDays: N.subjects["mara-finn"].days,
        notesNext: N.next.when,
        notesNextDays: N.next.days,
        headText: (document.querySelector('[data-app="notes"] .headNext') || {}).textContent || "",
      };
    });
    check("truth", "the world holds the wedding once", Boolean(said.world), said.world || "not declared");
    check("truth", "Timeline agrees with it", said.timeline === said.world, `${said.timeline} vs ${said.world}`);
    check("truth", "the notebook agrees with it",
      /3\s*October/.test(said.notesSubject) && said.notesSubjectDays === 79,
      `${said.notesSubject}, in ${said.notesSubjectDays} days`);
    check("truth", "and the head says the same day", /3\s*October/.test(said.headText),
      `“${said.headText.replace(/\s+/g, " ").trim().slice(0, 60)}”`);
    check("truth", "the couple is the same couple", said.couple === said.timelineName,
      `${said.couple} vs ${said.timelineName}`);
    await page.close();
  }

  /* ── the ledger counts what the index badges ─────────────────────
     WATCHED FAILING: the pile headed "what has crossed into Tasks" said
     three, and the index beside it badged six notes "In Tasks". */
  {
    const page = await open("?p=notes", 1440);
    const n = await page.evaluate(() => {
      const N = window.NOTES;
      const sent = N.notes.filter((x) => x.sent).length + N.crossed.length;
      return { counted: N.counts.sent, sent };
    });
    check("truth", "the ledger counts every crossing", n.counted === n.sent,
      `${n.counted} counted, ${n.sent} notes actually badged`);
    await page.close();
  }

  /* ── one account tile per sheet ──────────────────────────────────
     WATCHED FAILING: Notes painted two "OR" discs at once — the rail's,
     which says it does nothing, and the dock's, which announces. Two
     objects, one name, two different contracts. */
  for (const [product, width] of [["notes", 1440], ["tasks", 1440], ["notes", 390]]) {
    const page = await open(`?p=${product}`, width);
    const discs = await page.evaluate(() =>
      [...document.querySelectorAll(".railAvatar, .app:not([hidden]) .dockAvatar")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({
          where: el.className.split(" ")[0],
          label: el.getAttribute("aria-label") || "",
          disabled: el.getAttribute("aria-disabled") === "true",
        })));
    /* Two slots is correct — Tasks has always had both — but they may not
       make two different promises about the same thing. */
    const contracts = new Set(discs.map((d) => (d.disabled ? "not here yet" : "live")));
    check("truth", `${product} @${width} · the account tiles agree`, contracts.size <= 1,
      discs.map((d) => `${d.where}:${d.disabled ? "not-yet" : "live"}`).join(" "));
    await page.close();
  }
}
