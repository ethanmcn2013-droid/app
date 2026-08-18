/* Real content for the Notes design exploration.
 *
 * Every note body in NOTES.notes is lifted verbatim from the review-mode
 * fixture the app actually serves — src/modules/notes/server/demo/notes-demo.ts
 * — including its curled apostrophes and its en dashes, which are pinned by a
 * cross-suite contract and must not be normalised here. The cast, the venue
 * and the clock come from src/lib/review-suite-fixture.ts: The Orchard,
 * events; Mara & Finn; Orla; the pinned review clock of 16 July 2026, 09:00.
 *
 * Relative times ("35 minutes ago") are computed here from the same fixed
 * clock the product computes them from, so a lab frame and a product frame
 * can be laid beside each other and disagree about nothing.
 *
 * Two honest extensions, labelled wherever they appear:
 *   - DENSE repeats the fixture's own notes with unique ids and timestamps,
 *     exactly as the product's dense fixture does, because the shipped
 *     notebook holds fourteen notes and cannot exercise a full shelf.
 *   - LONG is the fixture's own long-content note, unedited.
 *
 * Copy strings come from src/modules/notes/lib/notes-copy.ts, generic
 * register, verbatim. No direction may rewrite them.
 */
window.NOTES = (function () {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  /* 16 July 2026, 09:00 UTC. The product's DEMO_REFERENCE_TIME. */
  const NOW = Date.UTC(2026, 6, 15, 9, 0, 0);

  /* The product's own relative-time voice. "Yesterday" rather than "1 day
     ago", because that is what the shipped view model says. */
  function ago(ms) {
    const mins = Math.round(ms / MIN);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.round(ms / HOUR);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(ms / DAY);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  }

  /* The day a note belongs to, for the run's date rules. */
  function dayOf(ms) {
    const days = Math.floor(ms / DAY);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    const d = new Date(NOW - ms);
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  }

  /* What each note is ABOUT, as opposed to when it was written.
   *
   * This is the one honest extension to the fixture and it is labelled as
   * one wherever it appears. The subjects are not invented: every one of
   * them is named in the body of the notes it groups, and the two that are
   * dated come from the review fixture's own project and its wedding date.
   *
   * It exists because a panel seat put the direction's real failure
   * plainly: grouped only by the day they were captured, these notes could
   * be swapped for engineering standups and not one pixel of the design
   * would change. A venue's notes are ABOUT something — a Saturday, a
   * couple, the house, a course — and the product that holds them should
   * know that or admit it does not.
   */
  /* One grammar for every name, one meaning for every slot, and an order
     by what the venue is actually facing rather than by whichever date is
     nearest. A college reading due today does not outrank a wedding in two
     days, and a panel seat was right to say that sorting by proximity made
     the pile open on the wrong thing.

     stake 1  a day the venue is running. The business.
     stake 2  a commitment with a date on it that is not the business.
     stake 3  standing work that never stops and has no date.  */
  const SUBJECTS = {
    "mara-finn": { label: "Mara & Finn", when: "Saturday 18 July", days: 2, stake: 1 },
    "the-house": { label: "The house", when: null, days: null, stake: 3 },
    "the-studio": { label: "The studio", when: null, days: null, stake: 3 },
    "the-course": { label: "The course", when: "Thursday 16 July", days: 0, stake: 2 },
    "the-enquiries": { label: "The enquiries", when: null, days: null, stake: 3 },
  };

  /* The fixture, in the fixture's own order. `sent` means a task exists for
     this note; `reviewed` means the decision has already been made and the
     note is simply kept. Neither is missing by accident: a note with both
     absent is a note still waiting on a decision, which is the point. */
  const SEED = [
    {
      id: "n01",
      about: "mara-finn",
      body: "Saturday wedding, Mara & Finn. Ceremony 2pm in the orchard, drinks on the terrace if it stays dry. Confirm marquee sides with the hire company by Thursday.",
      ago: 35 * MIN,
      task: "Confirm marquee sides with hire company before Thursday",
      sent: true,
      edited: true,
    },
    {
      id: "n02",
      about: "mara-finn",
      body: "Mara & Finn’s menu tasting at The Orchard is booked for 1 August. Confirm the final dietary list before the venue team locks the service notes.",
      ago: 2 * HOUR,
      task: "Menu tasting with Mara & Finn",
      sent: true,
      edited: true,
    },
    {
      id: "n03",
      pick: "Ask the venue whether the ballroom can be accessed from 8am on the Saturday.",
      about: "mara-finn",
      body: "Ask the venue whether the ballroom can be accessed from 8am on the Saturday. If not we lose the whole morning setup and the florist has to come back twice.",
      ago: 3 * HOUR,
      source: "voice",
    },
    {
      id: "n04",
      about: "the-studio",
      body: "Idea for the studio newsletter: short piece on “what a calm Saturday actually looks like behind the bar”. People love the backstage angle.",
      ago: 5 * HOUR,
    },
    {
      id: "n05",
      about: "the-studio",
      body: "Teacher onboarding, three things they kept asking for: one place to see the term, a way to hand a job to someone without chasing it, and something that works on a phone at the back of a classroom.",
      ago: 6 * HOUR,
      source: "photo",
    },
    {
      id: "n06",
      about: "the-course",
      body: "Course reading for Thursday: chapters 4–5 on cash-flow forecasting. Bring the worked example, the lecturer always opens with it.",
      ago: 9 * HOUR,
      task: "Read cash-flow chapters 4–5 before Thursday class",
      edited: true,
    },
    {
      id: "n07",
      about: "the-studio",
      body: "Student launch pricing needs one simple annual option. Two prices and a discount code is already too many decisions for someone signing up between lectures.",
      ago: 1 * DAY + 1 * HOUR,
      source: "voice",
      reviewed: true,
    },
    {
      id: "n08",
      about: "the-enquiries",
      body: "Walk-in couple this morning, June 2027, ~80 guests, budget-conscious but lovely. Sent them the midweek rate. Follow up Friday if no reply.",
      ago: 1 * DAY + 3 * HOUR,
    },
    {
      id: "n09",
      about: "the-house",
      body: "Bar restock: tonic running low, order two extra cases before the weekend. Also the good olives, last delivery was short.",
      ago: 1 * DAY + 6 * HOUR,
      task: "Order 2 cases tonic + olives before weekend",
      sent: true,
      edited: true,
    },
    {
      id: "n10",
      about: "the-enquiries",
      body: "Photographer recommendation from the Hendersons: Aoife @ northlight. Natural light, doesn’t herd people. Keep her card for the recommended-suppliers list.",
      ago: 2 * DAY,
      reviewed: true,
    },
    {
      id: "n11",
      pick: "Reprint before the open day",
      about: "the-house",
      body: "Small thing but it matters: the welcome sign by the gate is faded. Reprint before the open day, first impression is the whole car-park walk.",
      ago: 2 * DAY + 4 * HOUR,
    },
    {
      id: "n12",
      about: "the-studio",
      body: "Quote from today that I want to keep: “we don’t want a big production, we just want it to feel like us.” That’s the whole pitch, really.",
      ago: 3 * DAY,
      reviewed: true,
    },
    {
      id: "n13",
      about: "the-studio",
      body: "Follow up with the motion designer about the venue film. She needs the final music choice before she can lock the edit, and the cut is due the week after next.",
      ago: 3 * DAY + 5 * HOUR,
      source: "email",
    },
    {
      id: "n14",
      pick: "Switch on before guests arrive, not when.",
      about: "the-house",
      body: "Heating: orchard room takes ~40 min to warm in October. Switch on before guests arrive, not when. Note for the winter brochure couples.",
      ago: 4 * DAY,
    },
  ];

  /* The fixture's long-content note, unedited. The torture test for the note
     object: 900 words of one person's actual sentence structure, including a
     deliberately unbreakable supplier name. */
  const LONG_BODY =
    "Post-event debrief for Mara and Finn. The orchard ceremony moved inside at 13:20 when the rain line reached the west gate, so the team reset eighty-four chairs in eighteen minutes and kept the terrace drinks plan intact. What worked: Aoife held family photographs until the room settled; the bar moved one person to the entrance before guests arrived; the florist reused the aisle foliage around the fireplace without needing another decision. What to change next time: keep a printed wet-weather sequence in the duty folder, confirm who owns the accessibility route before opening the side doors, and label the supplier crate for the extraordinarily long North Coast Botanical Installations and Seasonal Hire Company name so it does not disappear into general storage. Follow up with Mara on Thursday, send the revised room-turn checklist to the Saturday team, and keep this note as the source for the winter brochure case study.";

  /* Notes that crossed the one-way edge into Tasks. Each kept its private
     body here; the wording the person picked is the action that now lives in
     Tasks. This is the surface that shows how Notes behaves in the suite. */
  const CROSSED = [
    {
      id: "s1",
      about: "mara-finn",
      sent: true,
      body: "Mara asked about a late checkout for the bridal suite, Sunday 11am instead of 9. Said yes in principle, just needs to clear housekeeping.",
      ago: 1 * DAY + 8 * HOUR,
      source: "voice",
      task: "Clear Sunday 11am late checkout with housekeeping",
      crossedAgo: 20 * HOUR,
      lane: "In progress",
    },
    {
      id: "s2",
      about: "mara-finn",
      sent: true,
      body: "Linen supplier rang, the order now ships Tuesday, not Friday. Fine for Saturday, but tight if anything slips.",
      ago: 2 * DAY + 5 * HOUR,
      task: "Chase linen order, now shipping Tuesday",
      crossedAgo: 1 * DAY + 12 * HOUR,
      lane: "Waiting",
    },
    {
      id: "s3",
      about: "mara-finn",
      sent: true,
      body: "Registrar confirmed she can do 2pm but wants the final paperwork a fortnight out. Don’t leave it late this time.",
      ago: 4 * DAY,
      task: "Send registrar paperwork two weeks before the date",
      crossedAgo: 2 * DAY + 8 * HOUR,
      lane: "To do",
    },
  ];

  function build(seed) {
    const about = SUBJECTS[seed.about] || SUBJECTS["the-house"];
    const title = seed.body.split(/(?<=[.?!”])\s/)[0] || seed.body;
    const rest = seed.body.slice(title.length).trim();
    return {
      id: seed.id,
      body: seed.body,
      title,
      rest,
      source: seed.source || "typed",
      when: ago(seed.ago),
      day: dayOf(seed.ago),
      ms: seed.ago,
      task: seed.task || null,
      sent: Boolean(seed.sent),
      reviewed: Boolean(seed.reviewed),
      edited: Boolean(seed.edited),
      /* The decision is outstanding when nothing has been decided and it has
         not already crossed. Everything else in the notebook is settled. */
      pending: !seed.sent && !seed.reviewed,
      crossedWhen: seed.crossedAgo ? ago(seed.crossedAgo) : null,
      lane: seed.lane || null,
      words: seed.body.trim().split(/\s+/).length,
      /* The words a person highlighted in their own note. The contract
         underneath the real product sends exactly this and nothing else,
         so the lab carries it as a field rather than inventing one at
         render time. */
      pick: seed.pick || null,
      about,
      aboutKey: seed.about || "the-house",
    };
  }

  const notes = SEED.map(build);
  const crossed = CROSSED.map(build);
  const long = build({ id: "long", about: "mara-finn", body: LONG_BODY, ago: 18 * MIN, task: "Write the wet-weather room-turn checklist and share it with the Saturday team" });

  /* Peak season. The shipped fixture holds fourteen notes and cannot
     exercise a full shelf, so the product's own dense fixture repeats them
     with unique ids and timestamps. Same rule here. Labelled as an
     extension wherever it appears. */
  const dense = Array.from({ length: 36 }, (_, i) => {
    const source = SEED[i % SEED.length];
    return build({
      ...source,
      id: `d${String(i + 1).padStart(2, "0")}`,
      ago: (i + 1) * 23 * MIN,
      sent: i % 7 === 0 ? true : source.sent,
    });
  });

  const pending = notes.filter((n) => n.pending);

  return {
    now: NOW,
    today: "Thursday 16 July",
    operator: { name: "Orla", initials: "OR", role: "Orla, venue manager" },
    workspace: "The Orchard, events",
    project: "Mara & Finn",

    notes,
    long,
    dense,
    crossed,
    pending,

    subjects: SUBJECTS,
    /* The venue's own next date, from the review fixture's project. The
       head states it because a notebook that does not know what is coming
       is a notebook that could belong to anyone. */
    next: { key: "mara-finn", label: "Mara & Finn", when: "Saturday 18 July", days: 2 },

    counts: {
      notebook: notes.length,
      review: pending.length,
      sent: crossed.length,
      dense: dense.length,
    },

    /* Verbatim from notes-copy.ts, generic register. Not rewritten by any
       direction; a direction may only decide where a string lives. */
    copy: {
      placeholder: "Write the thought before it disappears…",
      privacy: "Private to you",
      save: "Save it",
      photo: "Read a photo",
      filingLabel: "Filing under",
      otherWaysLabel: "Other ways in",
      privacyLong: "Yours until you send something on",
      emptyTitle: "Your notebook starts with one private thought.",
      emptyBody: "The capture field is ready above.",
      voiceStart: "Dictate",
      voiceStop: "Stop listening",
      voiceDisclosure:
        "Your browser may send microphone audio to its speech service to turn it into text. Signal Studio does not receive or retain that audio. Your browser or speech provider controls its service retention. Typing stays on your device until you save.",
      heading: "Turn this into a task",
      begin: "Use these words",
      handoffBoundary:
        "Your note stays here. Tasks only ever receives the exact words you pick and check below.",
      sourceLabel: "The words you picked",
      destinationLabel: "Which project",
      wordingLabel: "The task wording",
      payload:
        "Tasks receives these words and nothing else from this note. The rest of what you wrote stays private here.",
      cancel: "Never mind",
      send: "Send to Tasks",
      confirmed: "Tasks has it",
      open: "Open in Tasks",
      stayedPut: "Your note is still here, still private, still yours to edit.",
      sentReceipt: "Sent to Tasks. Your note stayed here.",
      offline: "You are offline. Nothing has left Notes. Reconnect and try again.",
      nothingSelected: "Highlight the words you want in the note first.",
      sourceChanged:
        "This note changed while you were sending. Both versions are kept. Read it again and pick your words.",
    },

    /* The four ways a note got here. The label is the accessible name for
       the mark, so state never rests on a glyph alone. */
    sources: {
      typed: { icon: "typed", label: "Written" },
      voice: { icon: "mic", label: "Spoken" },
      photo: { icon: "photo", label: "From a photo" },
      email: { icon: "email", label: "By email" },
    },

    /* The transcript the review build's rehearsal produces, and the two
       notes it separates into. Real strings from the product's speech
       rehearsal, so the read-back state is not invented. */
    speech: {
      transcript:
        "Ask the venue whether the ballroom can be accessed from eight in the morning. If not we lose the whole setup window and the florist has to come back twice.",
      separated: [
        "Ask the venue whether the ballroom can be accessed from eight in the morning.",
        "If not we lose the whole setup window and the florist has to come back twice.",
      ],
    },

    projects: ["The Orchard, events", "Mara & Finn", "Studio"],
  };
})();
