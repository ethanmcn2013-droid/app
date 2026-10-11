/* Sample world for the Team load concept. Front-end only, invented data.
   Today is Thursday 1 October 2026. Dates are ISO strings (YYYY-MM-DD). */

export const TODAY = "2026-10-01";

export type Person = {
  id: string;
  name: string;
  first: string;
  initials: string;
  role: string;
  /** var(--v3-project-N) identity colour for the avatar. */
  tone: number;
  /** Working weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
  hoursPerDay: number;
  guest?: boolean;
  /** Days off inside the working week, shown as an Away band. */
  away?: { from: string; to: string; note: string };
  /** One-off extra working days (the wedding). */
  extra?: { date: string; note: string }[];
  /** A guest only takes work whose title mentions one of these. */
  takes?: string[];
  /** A short line about when this person works, in words. */
  pattern: string;
};

export type Tag = { key: string; label: string; tone: number };

export type Task = {
  id: string;
  title: string;
  hours: number;
  /** null = Unassigned. */
  personId: string | null;
  date: string;
  tag: string;
  /** Tied to its day (a service, a visit): suggestions never move it. */
  fixed?: boolean;
};

export type Milestone = {
  date: string;
  label: string;
  kind: "deadline" | "milestone" | "event";
};

export type Project = {
  id: string;
  name: string;
  kind: string;
  tone: number;
  people: Person[];
  tags: Tag[];
  milestones: Milestone[];
  tasks: Task[];
};

/* ── Tiny DSL: "who date hours title #tag !" (! = fixed to the day) ── */

function parse(prefix: string, lines: string): Task[] {
  const out: Task[] = [];
  lines
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const m = line.match(/^(\S+)\s+(\d\d-\d\d)\s+([\d.]+)\s+(.+?)\s+#(\S+)(\s+!)?$/);
      if (!m) throw new Error(`bad task line: ${line}`);
      const [, who, md, hours, title, tag, fixed] = m;
      out.push({
        id: `${prefix}${i}`,
        personId: who === "none" ? null : who,
        date: `2026-${md}`,
        hours: Number(hours),
        title,
        tag,
        fixed: Boolean(fixed),
      });
    });
  return out;
}

const MON_FRI = [1, 2, 3, 4, 5];

/* ── The Orchard, events ──────────────────────────────────────────── */

const orchardTasks = parse(
  "o",
  `
orla 09-28 3 Walk the terrace with the Doyles #venue
orla 09-28 2 Reply to October enquiries #venue
orla 09-29 4 Draft the Mara & Finn run-sheet #mf
orla 09-30 3 Hire company call about the marquee #venue
orla 10-01 2 Confirm the menu tasting date #mf
orla 10-01 3 Update the autumn price list #venue
orla 10-02 3 Supplier review for Q4 #venue
dev 09-28 3 Autumn menu costing #kitchen
dev 09-29 4 Test the new canapé list #kitchen
dev 09-30 2 Order game for October #kitchen
dev 10-01 3 Plan the tasting menu #mf
dev 10-01 1 Allergen sheet for the Kellys #kitchen
dev 10-02 4 Kitchen deep clean #kitchen
aoife 09-28 2 Send the welcome pack to Mara & Finn #mf
aoife 09-29 3 Seating plan first pass #mf
aoife 09-30 3.5 Show round for the Byrne party #venue
aoife 10-01 2 Chase the band's rider #mf
aoife 10-01 2 Confirm guest list numbers #mf
aoife 10-02 3 Book the ceremony musicians #mf
sam 09-29 3 Train two new bar staff #bar
sam 09-30 2 Stock take for the bar #bar
sam 10-01 4 Friday dinner service rota #bar
sam 10-02 3 Set the terrace for Saturday #venue
sam 10-03 6 Saturday lunch service #bar !
orla 10-05 4 Draft the wedding-day timings #mf
orla 10-05 2 Venue viewing for the Hales #venue
orla 10-06 5 Contract review with the caterer #venue
orla 10-07 3 Florist brief with Lucía #mf
orla 10-07 3 Marquee site visit #venue !
orla 10-08 7 Q4 planning day #venue
orla 10-09 5 Menu tasting host #mf !
orla 10-09 3 Write up the tasting decisions #mf
dev 10-05 5 Source the wedding cheeses #kitchen
dev 10-06 5 Build the tasting shopping list #mf
dev 10-07 6 Order produce for the tasting #mf
dev 10-08 4 Sauces and stocks for the tasting #mf
dev 10-08 3 Weekly kitchen order #kitchen
dev 10-09 2 Plate tasting prep #mf
dev 10-09 5 Menu tasting service #mf !
dev 10-09 2 Kitchen close-down #kitchen !
aoife 10-05 3 Update the seating plan #mf
aoife 10-06 4 Order place cards and menus #mf
aoife 10-06 2 Timeline call with the couple #mf
aoife 10-07 5 Draft the wedding-day run-sheet #mf
aoife 10-08 3 Confirm the tasting guest list #mf
aoife 10-08 2 Send dietary forms #mf
aoife 10-09 5 Menu tasting welcome #mf !
aoife 10-09 3 Photographer shot list #mf
sam 10-06 4 Bar glassware order #bar
sam 10-07 3 Cocktail list for the wedding #bar
sam 10-08 6 Wine pairing for the tasting #mf
sam 10-09 4 Front of house at the tasting #mf !
sam 10-09 3 Sort the returns crates #bar
sam 10-10 6 Saturday dinner service #bar !
orla 10-13 1 Call Mara & Finn about numbers #mf
orla 10-14 2 Sign off the seating plan #mf
orla 10-15 6 Catch up after leave #venue
orla 10-15 2 Final numbers to the kitchen #mf
orla 10-16 5 Final numbers deadline check #mf
dev 10-12 4 Wedding menu costing #mf
dev 10-13 5 Staff briefing for the wedding #kitchen
dev 10-14 6 Weekly kitchen order #kitchen
dev 10-15 5 Wedding cake tasting with the baker #mf
dev 10-16 3 Rota for the wedding week #kitchen
aoife 10-12 6 Cover Orla's calls #venue
aoife 10-13 5 Transport plan for guests #mf
aoife 10-13 3 Confirm the hotel block #mf
aoife 10-14 7 Seating plan, second pass #mf
aoife 10-15 4 Order the signage #mf
aoife 10-16 6 Collect final numbers #mf
sam 10-13 3 Bar staff rota for the wedding #bar
sam 10-14 4 Order the wedding wines #bar
sam 10-15 3 Ice and glass hire #bar
sam 10-16 5 Friday dinner service #bar !
sam 10-17 6 Saturday lunch service #bar !
none 10-15 1.5 Linen count for the wedding #venue
orla 10-19 4 Final walk-through with the couple #mf !
orla 10-19 3 Supplier arrival times #mf
orla 10-20 5 Confirm every supplier #mf
orla 10-20 3 Wet-weather plan #mf
orla 10-21 6 Wedding rehearsal plan #mf
orla 10-21 3 Brief the whole team #mf
orla 10-22 6 Ceremony rehearsal #mf !
orla 10-22 4 Welcome pack printing #mf
orla 10-23 6 Marquee dressing #mf
orla 10-23 5 Guest arrival plan #mf
orla 10-24 6 Wedding day lead #mf !
dev 10-19 6 Wedding produce order #mf
dev 10-20 4 Prep list for 140 covers #mf
dev 10-20 4 Canapé prep #mf
dev 10-21 5 Stocks, sauces and dough #mf
dev 10-21 3 Kitchen staff briefing #kitchen
dev 10-22 5 Dessert prep #mf
dev 10-22 4 Receive the fish delivery #mf !
dev 10-23 6 Main course mise en place #mf
dev 10-23 4 Cake collection and storage #mf
dev 10-24 8 Wedding kitchen service #mf !
aoife 10-19 5 Seating plan, final #mf
aoife 10-19 3 Print the table plan #mf
aoife 10-20 4 Chase last RSVPs #mf
aoife 10-20 3 Order the favours #mf
aoife 10-21 5 Pack the welcome bags #mf
aoife 10-21 3 Name cards for the top table #mf
aoife 10-22 6 Room set with the florist #mf !
aoife 10-22 3 Ceremony rehearsal notes #mf
aoife 10-23 8 Set the reception room #mf
aoife 10-24 6 Ceremony and speeches #mf !
sam 10-20 6 Tuesday dinner service #bar !
sam 10-21 4 Bar set-up for the reception #mf
sam 10-21 4 Wedding staff briefing #bar
sam 10-22 5 Welcome drinks stock #mf
sam 10-22 3 Keg change and line clean #bar
sam 10-23 6 Friday dinner service #bar !
sam 10-23 3 Lay the tables #mf
sam 10-24 11 Wedding bar service #mf !
none 10-21 2 Print place cards #mf
none 10-22 2 Make the buttonholes #mf
none 10-23 3 Collect the arch from the hire company #mf
orla 10-26 3 Thank-you note to Mara & Finn #mf
orla 10-27 3 Wedding debrief #venue
orla 10-28 4 November planning #venue
orla 10-29 2 Review for the website #venue
orla 11-02 4 Christmas party enquiries #venue
orla 11-03 3 Supplier invoices #venue
orla 11-05 4 Winter menu launch plan #venue
dev 10-26 4 Deep clean after the wedding #kitchen
dev 10-27 3 Stock count #kitchen
dev 10-28 2 Winter menu ideas #kitchen
dev 10-30 3 Weekly kitchen order #kitchen
dev 11-03 4 Christmas menu tasting #kitchen
dev 11-05 3 Game supplier visit #kitchen
aoife 10-26 4 Return the hire items #mf
aoife 10-27 2 Photo selection for the couple #mf
aoife 10-29 3 Final invoice to Mara & Finn #mf
aoife 11-02 3 New enquiries follow-up #venue
aoife 11-04 4 Plan the Kelly christening #venue
sam 10-27 3 Bar stock after the wedding #bar
sam 10-28 2 Return the ice and glass hire #bar
sam 10-31 6 Halloween party service #bar !
sam 11-04 3 Staff reviews #bar
sam 11-07 6 Saturday dinner service #bar !
`,
);

const orchard: Project = {
  id: "orchard",
  name: "The Orchard",
  kind: "events",
  tone: 1,
  tags: [
    { key: "mf", label: "Mara & Finn", tone: 8 },
    { key: "venue", label: "Venue", tone: 3 },
    { key: "kitchen", label: "Kitchen", tone: 5 },
    { key: "bar", label: "Bar", tone: 2 },
  ],
  people: [
    {
      id: "orla",
      name: "Orla Byrne",
      first: "Orla",
      initials: "OB",
      role: "Events lead",
      tone: 1,
      days: MON_FRI,
      hoursPerDay: 8,
      away: { from: "2026-10-12", to: "2026-10-14", note: "Annual leave" },
      extra: [{ date: "2026-10-24", note: "Working the wedding" }],
      pattern: "Mon to Fri, 8h a day",
    },
    {
      id: "dev",
      name: "Dev Patel",
      first: "Dev",
      initials: "DP",
      role: "Head chef",
      tone: 6,
      days: MON_FRI,
      hoursPerDay: 8,
      extra: [{ date: "2026-10-24", note: "Working the wedding" }],
      pattern: "Mon to Fri, 8h a day",
    },
    {
      id: "aoife",
      name: "Aoife Walsh",
      first: "Aoife",
      initials: "AW",
      role: "Wedding coordinator",
      tone: 3,
      days: MON_FRI,
      hoursPerDay: 8,
      extra: [{ date: "2026-10-24", note: "Working the wedding" }],
      pattern: "Mon to Fri, 8h a day",
    },
    {
      id: "sam",
      name: "Sam Kiely",
      first: "Sam",
      initials: "SK",
      role: "Front of house",
      tone: 2,
      days: [2, 3, 4, 5, 6],
      hoursPerDay: 8,
      pattern: "Tue to Sat, 8h a day",
    },
    {
      id: "lucia",
      name: "Lucía Moreno",
      first: "Lucía",
      initials: "LM",
      role: "Florist",
      tone: 8,
      days: [4],
      hoursPerDay: 6,
      guest: true,
      takes: ["buttonhole", "flower", "floral", "arch", "florist", "bouquet"],
      pattern: "Thursdays only, 6h",
    },
  ],
  milestones: [
    { date: "2026-10-09", label: "Menu tasting", kind: "event" },
    { date: "2026-10-16", label: "Final numbers due", kind: "deadline" },
    { date: "2026-10-22", label: "Rehearsal", kind: "milestone" },
    { date: "2026-10-24", label: "Wedding day", kind: "event" },
    { date: "2026-11-06", label: "Invoices out", kind: "deadline" },
  ],
  tasks: orchardTasks,
};

/* ── Urban heat islands (a school research project) ──────────────── */

const heatTasks = parse(
  "h",
  `
niamh 09-28 3 Plan the sensor routes #field
niamh 09-29 2 Ethics form sign-off #report
niamh 09-30 4 Class briefing on the method #class !
niamh 10-01 3 Book the minibus #field
niamh 10-02 2 Parent letters #class
tomas 09-29 5 Calibrate the thermometers #field
tomas 09-30 4 Build the sensor mounts #field
tomas 10-01 5 Test logging overnight #field
tomas 10-02 3 Label every sensor #field
priya 09-28 4 Set up the data sheet #data
priya 09-30 3 Last year's readings #data
priya 10-01 4 Weather station data #data
ben 09-28 2 Street map print-outs #field
ben 09-30 3 Photo survey of the square #field
niamh 10-05 3 Risk assessment #field
niamh 10-06 7 Sensor install day #field !
niamh 10-07 3 Mark the install sites #field
niamh 10-08 4 Mid-term check-in #class !
tomas 10-05 4 Pack the install kit #field
tomas 10-06 8 Sensor install day #field !
tomas 10-07 4 First readings check #data
tomas 10-09 4 Replace the faulty logger #field
priya 10-05 5 Clean the first readings #data
priya 10-07 6 Heat map, first draft #data
priya 10-08 5 Compare with the park #data
priya 10-09 3 Charts for the class #data
ben 10-06 4 Sensor install day #field !
ben 10-09 3 Shade survey #field
niamh 10-12 5 Report outline #report
niamh 10-13 4 Literature review #report
niamh 10-14 6 Write the method section #report
niamh 10-15 6 Edit the draft #report
niamh 10-16 8 Final read and submit #report !
tomas 10-12 4 Collect the sensors #field
tomas 10-13 5 Download every logger #data
tomas 10-15 3 Photos for the report #report
priya 10-12 7 Full data clean #data
priya 10-13 8 Statistics for the report #data
priya 10-14 7 Results section #report
priya 10-14 3 Check the charts #data
priya 10-15 6 Maps and figures #report
priya 10-15 3 Figure captions #report
priya 10-16 6 Check every number #report
ben 10-12 3 Survey notes typed up #report
ben 10-14 3 Glossary for the report #report
none 10-14 2 Reference list #report
none 10-15 3 Proofread the results #report
niamh 10-19 3 Feedback to the class #class
niamh 10-22 3 Presentation outline #class
tomas 10-20 3 Return the loan kit #field
priya 10-21 3 Tidy the data sheet #data
ben 10-23 3 Poster layout #class
niamh 10-29 4 Class presentation #class !
priya 10-28 4 Presentation slides #class
ben 10-28 3 Print the poster #class
`,
);

const heat: Project = {
  id: "heat",
  name: "Urban heat islands",
  kind: "research",
  tone: 5,
  tags: [
    { key: "field", label: "Fieldwork", tone: 4 },
    { key: "data", label: "Data", tone: 2 },
    { key: "report", label: "Report", tone: 1 },
    { key: "class", label: "Class", tone: 6 },
  ],
  people: [
    { id: "niamh", name: "Niamh Duffy", first: "Niamh", initials: "ND", role: "Lead researcher", tone: 1, days: MON_FRI, hoursPerDay: 8, pattern: "Mon to Fri, 8h a day" },
    { id: "tomas", name: "Tomás Ó Briain", first: "Tomás", initials: "TÓ", role: "Sensors and kit", tone: 3, days: MON_FRI, hoursPerDay: 8, pattern: "Mon to Fri, 8h a day" },
    { id: "priya", name: "Priya Nair", first: "Priya", initials: "PN", role: "Data and maps", tone: 6, days: MON_FRI, hoursPerDay: 8, pattern: "Mon to Fri, 8h a day" },
    { id: "ben", name: "Ben Carter", first: "Ben", initials: "BC", role: "Student researcher", tone: 2, days: [1, 2, 3, 4, 5], hoursPerDay: 4, pattern: "Mon to Fri, 4h a day" },
  ],
  milestones: [
    { date: "2026-10-06", label: "Sensor install", kind: "event" },
    { date: "2026-10-16", label: "Draft report due", kind: "deadline" },
    { date: "2026-10-29", label: "Class presentation", kind: "event" },
  ],
  tasks: heatTasks,
};

/* ── Fieldwork (two people, one survey) ───────────────────────────── */

const fieldTasks = parse(
  "f",
  `
jess 09-28 4 Landowner permissions #plan
jess 09-29 3 Route plan for Ballyhoura #plan
jess 10-01 5 Kit check #kit
kofi 09-29 4 Drone licence renewal #plan
kofi 09-30 5 Service the GPS units #kit
kofi 10-02 3 Weather window check #plan
jess 10-06 4 Pack the van #kit
jess 10-07 9 Site visit: Ballyhoura #site !
jess 10-08 9 Site visit: Ballyhoura #site !
kofi 10-07 9 Site visit: Ballyhoura #site !
kofi 10-08 9 Site visit: Ballyhoura #site !
kofi 10-09 6 Process the drone survey #lab
jess 10-12 5 Label the samples #lab
jess 10-13 6 Field notes write-up #lab
kofi 10-12 6 Point-cloud clean-up #lab
kofi 10-14 5 Survey maps #lab
jess 10-16 3 Courier booking #kit
jess 10-19 4 Samples to the lab #lab !
kofi 10-21 4 Map review with the council #plan
jess 10-26 4 Lab results review #lab
kofi 10-28 5 Final survey report #lab
`,
);

const field: Project = {
  id: "field",
  name: "Fieldwork",
  kind: "survey",
  tone: 4,
  tags: [
    { key: "plan", label: "Planning", tone: 1 },
    { key: "kit", label: "Kit", tone: 5 },
    { key: "site", label: "On site", tone: 4 },
    { key: "lab", label: "Lab", tone: 2 },
  ],
  people: [
    { id: "jess", name: "Jess Moran", first: "Jess", initials: "JM", role: "Site lead", tone: 4, days: MON_FRI, hoursPerDay: 8, pattern: "Mon to Fri, 8h a day" },
    { id: "kofi", name: "Kofi Mensah", first: "Kofi", initials: "KM", role: "Surveyor", tone: 7, days: MON_FRI, hoursPerDay: 8, pattern: "Mon to Fri, 8h a day" },
  ],
  milestones: [
    { date: "2026-10-07", label: "Site visit", kind: "event" },
    { date: "2026-10-19", label: "Samples to lab", kind: "deadline" },
  ],
  tasks: fieldTasks,
};

export const PROJECTS: Project[] = [orchard, heat, field];
