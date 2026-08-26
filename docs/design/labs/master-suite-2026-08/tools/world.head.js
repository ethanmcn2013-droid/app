/* ═══════════════════════════════════════════════════════════════════
   ONE WORLD.

   The Orchard, events. Orla, venue manager. Mara & Finn on Saturday 18
   July, and the review clock pinned to Thursday 16 July 2026. Three
   products, one venue, one cast, one day.

   Everything below this header is the three labs' own data files, in
   their own words, unedited except for one number: Notes' clock, which
   said 15 July while its own copy said 16. The header declares the facts
   they share; the footer joins them and then ASSERTS the agreement, so a
   suite that quietly starts disagreeing with itself fails at load rather
   than in front of somebody.

   GENERATED ONCE by tools/split.mjs. After that this file is the world.
   ═══════════════════════════════════════════════════════════════════ */
var WORLD = (window.WORLD = {
  /* The pinned review clock. src/lib/review-suite-fixture.ts, reviewToday. */
  today: "2026-07-16",
  todayLabel: "Thursday 16 July",
  nowUTC: Date.UTC(2026, 6, 16, 9, 0, 0),

  /* ── the wedding, held ONCE ──────────────────────────────────
     Round 1 found the same couple carrying two irreconcilable days: the
     notebook's head read "Mara & Finn · Saturday 18 July, in 2 days" and
     the Timeline's count read 79 with its date on Saturday 3 October.
     Two seats filed it independently and both refuters confirmed it as
     the finding the suite's whole claim rests on — a person reading the
     notebook is preparing for a wedding that, according to the Timeline
     beside it, has not happened yet and will not for eleven weeks.

     3 October is the anchor, not 18 July, and that direction is forced:
     it is the date in `src/lib/review-suite-fixture.ts`, it is the date
     the ten milestones are measured from, and moving it to July would
     collapse the count from 79 to 2 and take the Timeline's entire
     composition with it. So the July claim moves, and the notebook now
     derives its subject and its head from here rather than declaring a
     second one. */
  wedding: { couple: "Mara & Finn", date: "2026-10-03", label: "Saturday 3 October" },

  venue: "The Orchard, events",
  operator: { name: "Orla", initials: "OR", role: "Orla, venue manager" },
  project: "Mara & Finn",
  couples: ["Mara & Finn", "Nora & Cian", "Aisling & Tom"],
});
