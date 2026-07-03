import type { TemplateEssay } from "./types";

export const essay: TemplateEssay = {
  templateId: "trip-planning",
  seoTitle: "Trip Planning Checklist, Free Travel Template",
  seoDescription:
    "A travel planning template for non-trivial trips. Flights, hotel, itinerary, passport, packing, the boring tasks that ruin trips when you skip them.",
  heroline: "Trips don’t get ruined at the destination. They get ruined at the gate.",
  intro:
    "The hotel was great. The restaurant on night two was, allegedly, transcendent. You wouldn’t know, you were on a phone with the embassy because your passport expires in four months and Schengen wants six. The trip people remember as a disaster usually wasn’t the destination’s fault. It was a 30-second admin task that nobody owned, and now it’s 11pm in a terminal and the rebooking desk has closed.",
  sections: [
    {
      heading: "The boring task is the one that compounds",
      body:
        "Every trip has a glamorous list and a boring list. The glamorous list is dinners, neighborhoods, the day you rent a car and drive to the coast. The boring list is passport expiry, visa rules, travel insurance, the airport transfer at 5am on landing day. Nobody forgets the glamorous list, it’s the entire reason you’re going. The boring list is what you remember at the gate. Miss the visa window and the trip doesn’t happen. Skip the airport transfer and you eat a $90 cab and a missed reservation. The boring tasks aren’t hard; they’re just easy to assume someone else is handling.",
    },
    {
      heading: "What’s in this template",
      body:
        "Eight tasks in roughly the order they bite. Dates and budget locked first (marked done, you’ve done that part). Flights as P0 because prices move and award seats vanish. Hotel or Airbnb the day after, before the good options on the right block sell out. A 3-day itinerary draft that explicitly leaves room to wander, because over-planning is its own failure mode. A short list of standout dinners reserved early, the places worth the trip book out four weeks ahead. Passport expiry and visa check as P1 admin, not P3, because this is the one that ends trips before they start. Travel insurance and a stashed list of emergency contacts. And a pack list split into checked and carry-on, so the medication and the chargers don’t end up in the bag you can’t reach.",
    },
    {
      heading: "Why a workspace beats a Notes app",
      body:
        "Two people plan most trips, sometimes three. One books flights, the other handles the hotel, the friend joining for the back half wants visibility without bothering anyone. A Notes doc shared over iMessage gets stale the moment one person edits it on a plane. In Tasks, the list is live, you reassign, reprioritize, and the airport transfer task moves with the flight time. Free covers one workspace and three editing guests, which is exactly a couple plus a friend. If you take more than one trip a year and want a workspace per trip without them tangling together, the Workspace tier is €12 a month for unlimited workspaces.",
    },
  ],
  closer:
    "Apply the template, drag the dates onto your real calendar, and check the passport expiry first, it’s the one task you’ll be glad you didn’t leave for later.",
};
