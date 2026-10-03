/**
 * The demo's one world. Every surface in /demo tells the same story, so the
 * same names, dates and colours appear wherever a thing appears. Surfaces keep
 * their own richer sample data, but anything that names the workspace, a
 * project, a person or today follows this file.
 */

/** Today in the demo: Friday 25 September 2026, 11:40 in the morning. */
export const DEMO_TODAY = "2026-09-25";
export const DEMO_NOW = "11:40";

export const WORKSPACE = { name: "The Orchard, events", short: "The Orchard", place: "Kinsale, Co. Cork" } as const;

/** The person using the demo. "You" and "yours" always mean Orla. */
export const VIEWER = "orla" as const;

/**
 * The Orchard's projects. Colours are --v3-project-n (never amber, orange or
 * red). Health uses On track / At risk / Off track.
 */
export const PROJECTS = [
  { id: "mara-finn", name: "Mara & Finn's wedding", short: "Mara & Finn", hue: 9, date: "2026-10-03", health: "at_risk", lead: "aoife", note: "Saturday 3 October, 118 guests in the long barn and the orchard marquee" },
  { id: "harvest", name: "Harvest supper club", short: "Harvest supper", hue: 3, date: "2026-10-17", health: "on_track", lead: "dev", note: "Forty seats at one long table" },
  { id: "kavanagh", name: "Kavanagh 40th", short: "Kavanagh 40th", hue: 1, date: "2026-11-14", health: "on_track", lead: "orla", note: "Surprise party for Lena, 70 guests in the barn" },
  { id: "barn-roof", name: "Barn roof and heating works", short: "Barn roof", hue: 2, date: "2026-10-30", health: "off_track", lead: "tomas", note: "New slate, insulation and underfloor heating before winter" },
  { id: "winter-launch", name: "Winter season launch", short: "Winter launch", hue: 4, date: "2026-10-12", health: "off_track", lead: "siobhan", note: "Brochure, website and socials for the winter weddings" },
  { id: "christmas", name: "Christmas markets at The Orchard", short: "Christmas markets", hue: 2, date: "2026-12-05", health: "on_track", lead: "niamh", note: "Two weekends, thirty stalls" },
  { id: "ada-theo", name: "Ada & Theo's winter micro-wedding", short: "Ada & Theo", hue: 3, date: "2026-12-12", health: "on_track", lead: "aoife", note: "Twenty guests by the fire" },
] as const;

/** The team and the couple. Colours are --v3-project-n. */
export const PEOPLE = [
  { id: "orla", name: "Orla Byrne", first: "Orla", initials: "OB", role: "Owner", hue: 1 },
  { id: "aoife", name: "Aoife Brennan", first: "Aoife", initials: "AB", role: "Wedding coordinator", hue: 9 },
  { id: "dara", name: "Dara Hegarty", first: "Dara", initials: "DH", role: "Venue manager", hue: 4 },
  { id: "tomas", name: "Tomás Ryan", first: "Tomás", initials: "TR", role: "Venue and works", hue: 2 },
  { id: "dev", name: "Dev Patel", first: "Dev", initials: "DP", role: "Head chef", hue: 3 },
  { id: "niamh", name: "Niamh Walsh", first: "Niamh", initials: "NW", role: "Front of house", hue: 3 },
  { id: "siobhan", name: "Siobhán Kelly", first: "Siobhán", initials: "SK", role: "Sales and marketing", hue: 2 },
  { id: "mara", name: "Mara Quinn", first: "Mara", initials: "MQ", role: "Client", hue: 1 },
  { id: "finn", name: "Finn Walsh", first: "Finn", initials: "FW", role: "Client", hue: 2 },
] as const;

/** Suppliers that recur across surfaces. */
export const SUPPLIERS = ["Fern and Furrow (florist)", "Lawlor Hire (marquee)", "The Lindens (band)", "Kinsale Wine Co", "Tolland & Sons (rings)", "Harbour Coaches"] as const;
