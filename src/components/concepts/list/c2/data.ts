/* Sample plans for the Living outline concept. Invented data, no backend. */

export type PersonId = "orla" | "aoife" | "mara" | "finn" | "niamh" | "tomas" | "priya" | "ciaran";

export const PEOPLE: Record<PersonId, { name: string; initials: string; hue: string; role: string }> = {
  orla: { name: "Orla Byrne", initials: "OB", hue: "var(--v3-project-3)", role: "Planner" },
  aoife: { name: "Aoife Kelly", initials: "AK", hue: "var(--v3-project-8)", role: "Assistant planner" },
  mara: { name: "Mara Doyle", initials: "MD", hue: "var(--v3-project-1)", role: "Couple" },
  finn: { name: "Finn Walsh", initials: "FW", hue: "var(--v3-project-5)", role: "Couple" },
  niamh: { name: "Niamh Ryan", initials: "NR", hue: "var(--v3-project-2)", role: "Student" },
  tomas: { name: "Tomás Ó Súilleabháin", initials: "TÓ", hue: "var(--v3-project-4)", role: "Student" },
  priya: { name: "Priya Nair", initials: "PN", hue: "var(--v3-project-8)", role: "Student" },
  ciaran: { name: "Ciarán Moore", initials: "CM", hue: "var(--v3-project-6)", role: "Student" },
};

/** The concept runs on a fixed "today" so the sample dates always read the same. */
export const TODAY = "2027-06-10";

export type OutlineNode = {
  id: string;
  title: string;
  done: boolean;
  due?: string;
  owner?: PersonId;
  /** A counted step, e.g. replies back: shown as a small meter. */
  count?: { n: number; of: number; unit: string };
  note?: string;
  parent: string | null;
  children: string[];
};

export type Doc = {
  key: "wedding" | "hydrology";
  rootId: string;
  /** The day everything builds to. */
  eventDay: string;
  eventLabel: string;
  place: string;
  people: PersonId[];
  nodes: Record<string, OutlineNode>;
};

type Seed = {
  t: string;
  d?: 1;
  due?: string;
  o?: PersonId;
  count?: OutlineNode["count"];
  note?: string;
  c?: Seed[];
};

function build(prefix: string, seed: Seed): { rootId: string; nodes: Record<string, OutlineNode> } {
  const nodes: Record<string, OutlineNode> = {};
  let n = 0;
  const walk = (s: Seed, parent: string | null): string => {
    const id = `${prefix}${n++}`;
    nodes[id] = {
      id,
      title: s.t,
      done: s.d === 1,
      due: s.due,
      owner: s.o,
      count: s.count,
      note: s.note,
      parent,
      children: [],
    };
    nodes[id].children = (s.c ?? []).map((child) => walk(child, id));
    return id;
  };
  const rootId = walk(seed, null);
  return { rootId, nodes };
}

const WEDDING: Seed = {
  t: "Mara & Finn wedding",
  c: [
    {
      t: "Before the day",
      c: [
        {
          t: "Invitations",
          o: "aoife",
          c: [
            {
              t: "Print",
              c: [
                { t: "Approve the final proof", d: 1, o: "mara" },
                { t: "Choose the paper stock", d: 1, o: "mara" },
                { t: "Print 120 invitations", d: 1, o: "orla" },
                { t: "Collect from the printer", d: 1, o: "finn" },
              ],
            },
            {
              t: "Post",
              c: [
                { t: "Address the envelopes", d: 1, o: "finn" },
                { t: "Post to guests in Ireland", d: 1, o: "aoife" },
                { t: "Post to guests overseas", d: 1, o: "aoife" },
              ],
            },
            { t: "Track replies", o: "aoife", due: "2027-06-08", count: { n: 86, of: 110, unit: "replies" } },
            { t: "Chase the last 24 guests by phone", o: "aoife", due: "2027-06-12" },
          ],
        },
        {
          t: "Suppliers",
          c: [
            {
              t: "Florist",
              o: "orla",
              c: [
                {
                  t: "Bouquets",
                  c: [
                    {
                      t: "Bridal bouquet",
                      o: "mara",
                      c: [
                        { t: "Confirm peonies are still in season", d: 1, o: "orla" },
                        { t: "Send the reference photo", d: 1, o: "mara" },
                        { t: "Pick the ribbon colour", o: "mara", due: "2027-06-11" },
                      ],
                    },
                    { t: "Three bridesmaid posies", d: 1 },
                    { t: "Six buttonholes", o: "orla", due: "2027-06-15" },
                  ],
                },
                { t: "Ceremony arch flowers", o: "orla", due: "2027-06-17" },
                { t: "Pay the florist balance", o: "finn", due: "2027-06-12" },
              ],
            },
            {
              t: "Photographer",
              c: [
                { t: "Book Síle for the full day", d: 1, o: "mara" },
                { t: "Pay the deposit", d: 1, o: "finn" },
                { t: "Send the shot list", d: 1, o: "mara" },
                { t: "Share the running order", d: 1, o: "orla" },
                { t: "Confirm arrival at 12:30", d: 1, o: "orla" },
              ],
            },
            {
              t: "Ceilidh band",
              c: [
                { t: "Book The Kilnamona Four", d: 1, o: "finn" },
                { t: "Pay the band deposit", o: "finn", due: "2027-06-05" },
                { t: "Send the first-dance song", d: 1, o: "mara" },
                { t: "Confirm set times", o: "orla", due: "2027-06-15" },
              ],
            },
            {
              t: "Cake",
              c: [
                { t: "Tasting at the bakery", d: 1, o: "mara" },
                { t: "Choose flavours", d: 1, o: "finn" },
                { t: "Confirm tiers and the stand", o: "mara", due: "2027-06-14" },
                { t: "Arrange delivery to The Orchard", o: "orla", due: "2027-06-18" },
              ],
            },
          ],
        },
        {
          t: "Legal and admin",
          c: [
            { t: "Give notice at the registry office", d: 1, o: "mara" },
            { t: "Book the registrar", d: 1, o: "finn" },
            { t: "Confirm the two witnesses", o: "mara", due: "2027-06-12" },
            { t: "Collect the rings", o: "finn", due: "2027-06-16" },
          ],
        },
      ],
    },
    {
      t: "Friday 18 June, set-up",
      c: [
        { t: "Marquee sides up", o: "orla", due: "2027-06-18" },
        {
          t: "Fairy lights",
          o: "aoife",
          c: [
            { t: "Test every string", d: 1, o: "aoife" },
            { t: "Hang over the dance floor", o: "aoife", due: "2027-06-18" },
            { t: "Hang along the orchard path", o: "aoife", due: "2027-06-18" },
          ],
        },
        {
          t: "Table plan",
          c: [
            { t: "Finalise the seating", o: "mara", due: "2027-06-13" },
            { t: "Print the table plan", o: "aoife", due: "2027-06-16" },
            { t: "Write place cards", o: "aoife", due: "2027-06-16" },
          ],
        },
      ],
    },
    {
      t: "Saturday 19 June",
      c: [
        {
          t: "Ceremony",
          o: "orla",
          c: [
            { t: "Set out chairs", o: "orla", due: "2027-06-19", count: { n: 0, of: 110, unit: "chairs" } },
            { t: "Aisle petals", o: "aoife", due: "2027-06-19" },
            { t: "Sound check with the registrar", o: "orla", due: "2027-06-19" },
            { t: "Order of service printed", d: 1, o: "aoife" },
            { t: "Reserved signs for family", d: 1, o: "aoife" },
            { t: "Rehearse the readings", o: "finn", due: "2027-06-18" },
            { t: "Ring cushion", d: 1, o: "mara" },
            { t: "Umbrellas in case of rain", d: 1, o: "orla" },
            { t: "Guest book and pens", d: 1, o: "aoife" },
          ],
        },
        {
          t: "Dinner",
          c: [
            { t: "Menu tasting", d: 1, o: "mara" },
            {
              t: "Dietary list",
              o: "orla",
              c: [
                { t: "Collect dietary needs from replies", d: 1, o: "aoife" },
                { t: "Send the list to the caterer", o: "orla", due: "2027-06-11" },
                { t: "Gluten-free dessert for table 7", o: "orla", due: "2027-06-14" },
              ],
            },
            { t: "Wine order", o: "finn", due: "2027-06-12" },
            { t: "Speeches" },
          ],
        },
        {
          t: "Evening",
          c: [
            { t: "Band load-in at 7pm", o: "orla", due: "2027-06-19" },
            { t: "Book the pizza van", d: 1, o: "finn" },
            { t: "Late food served at 9:30", o: "orla", due: "2027-06-19" },
          ],
        },
      ],
    },
    {
      t: "After",
      c: [
        { t: "Return the hire: chairs, glassware, marquee", o: "orla", due: "2027-06-21" },
        {
          t: "Thank-you cards",
          c: [
            { t: "Buy the cards", d: 1, o: "mara" },
            { t: "Write the cards", o: "mara", due: "2027-07-03" },
            { t: "Post the cards", o: "finn", due: "2027-07-06" },
          ],
        },
        { t: "Share the photos with guests", o: "mara" },
      ],
    },
  ],
};

const HYDROLOGY: Seed = {
  t: "Year 3 hydrology report",
  c: [
    {
      t: "Fieldwork",
      c: [
        { t: "Choose three river sites", d: 1, o: "niamh" },
        { t: "Risk assessment signed", d: 1, o: "ciaran" },
        {
          t: "Flow readings",
          c: [
            { t: "Site A, upstream of the weir", d: 1, o: "tomas" },
            { t: "Site B, the footbridge", d: 1, o: "tomas" },
            { t: "Site C, below the confluence", d: 1, o: "priya" },
          ],
        },
        { t: "Collect water samples", d: 1, o: "priya" },
      ],
    },
    {
      t: "Data",
      c: [
        { t: "Clean the readings", d: 1, o: "tomas" },
        { t: "Discharge calculations", o: "tomas", due: "2027-06-12" },
        { t: "Rating curve chart", o: "priya", due: "2027-06-15" },
        { t: "Compare with the gauge records", o: "niamh", due: "2027-06-09" },
      ],
    },
    {
      t: "Write-up",
      c: [
        { t: "Introduction", o: "niamh", due: "2027-06-16" },
        { t: "Method", d: 1, o: "ciaran" },
        { t: "Results", o: "priya", due: "2027-06-19" },
        { t: "Discussion", o: "niamh", due: "2027-06-22" },
        { t: "References in Harvard style", o: "ciaran", due: "2027-06-23" },
      ],
    },
    {
      t: "Slides",
      c: [
        { t: "Outline the ten slides", o: "ciaran", due: "2027-06-18" },
        { t: "Charts for the slides", o: "priya" },
        { t: "Rehearse in ten minutes", o: "niamh", due: "2027-06-24" },
      ],
    },
  ],
};

export function makeDocs(): Record<Doc["key"], Doc> {
  const w = build("w", WEDDING);
  const h = build("h", HYDROLOGY);
  return {
    wedding: {
      key: "wedding",
      ...w,
      eventDay: "2027-06-19",
      eventLabel: "the wedding",
      place: "The Orchard, Co. Wicklow",
      people: ["orla", "aoife", "mara", "finn"],
    },
    hydrology: {
      key: "hydrology",
      ...h,
      eventDay: "2027-06-26",
      eventLabel: "hand-in",
      place: "Geography, Year 3",
      people: ["niamh", "tomas", "priya", "ciaran"],
    },
  };
}

/* ── Dates ─────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const parseDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function daysFromToday(iso: string) {
  return Math.round((parseDay(iso) - parseDay(TODAY)) / DAY);
}

export function addDays(iso: string, n: number) {
  return new Date(parseDay(iso) + n * DAY).toISOString().slice(0, 10);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(iso: string) {
  const d = new Date(parseDay(iso));
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

export function dueLabel(iso: string, done: boolean) {
  const n = daysFromToday(iso);
  if (!done && n < 0) return n === -1 ? "Yesterday" : `${-n} days late`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return formatDay(iso);
}
