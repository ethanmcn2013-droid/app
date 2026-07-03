import type { TemplateEssay } from "./types";

export const essay: TemplateEssay = {
  templateId: "quarterly-review-prep",
  seoTitle: "Self-Review Template: Walk In With Receipts, Not Vibes",
  seoDescription:
    "A quarterly performance review prep one-pager for ICs. Wins with numbers, honest gaps, peer feedback, draft self-review, three forward goals.",
  heroline: "The self-review is due Friday and you can’t remember what you did in February.",
  intro:
    "Every quarter the same thing happens. The calendar invite lands, self-review draft due end of week, and the brain goes blank. You shipped a lot. You think. There was that thing in February. Or was that January. The Slack search bar becomes a forensic tool. Most of the templates Google serves up are HR worksheets with a box for “strengths” and a box for “areas of growth,” which is exactly the kind of prompt that produces a paragraph nobody, including you, will remember next week. The fix isn’t a better worksheet. It’s a list of six things, done in order, before the doc gets opened.",
  sections: [
    {
      heading: "Why most self-reviews read like vibes",
      body:
        "Because they’re written the night before, from memory, in the doc itself. By that point the wins have flattened into adjectives, “drove,” “led,” “partnered with”, and the gaps have either vanished or metastasized into a confession. Managers can tell. Skip-levels can really tell. The reviews that move calibration meetings are the ones with numbers attached to verbs and a clear-eyed line about what didn’t land. That doesn’t come from staring at a blank Google doc. It comes from doing the receipts work first, in a separate place, before the prose.",
    },
    {
      heading: "Wins with numbers is the load-bearing task",
      body:
        "If you do nothing else from this list, do this one. Open the list, write down every shipped thing from the last twelve weeks, and force a number next to each one. Conversion lift, tickets closed, hires made, time saved, dollars influenced, doc reads, NPS delta, whatever the unit is in your function, find it. Vague wins (“improved onboarding”) get downgraded in calibration. Specific wins (“cut onboarding from 11 days to 4, measured across the last 38 hires”) get quoted. The number is the difference between a review your manager nods at and a review your manager forwards.",
    },
    {
      heading: "What’s in this template",
      body:
        "Six tasks, sequenced for the week before the review. List wins this quarter with concrete numbers. List two places you fell short and what you actually learned, two, not five, because five reads like flagellation and one reads like dodging. Send three quick peer-feedback asks on Monday so the replies are in by Wednesday. Draft the self-review doc on Thursday, once the receipts are sitting next to you. Pick three goals for next quarter, three is the number a manager can hold in their head. Prep one-on-one talking points last, because by then you actually know what the conversation is about.",
    },
    {
      heading: "Why this lives in Tasks and not a Google doc",
      body:
        "Because a self-review one-pager is a project, not a note. It has a deadline, dependencies, and a couple of asks waiting on other humans. A Google doc can’t tell you the peer-feedback ask has been sitting unanswered for three days. A board can. The free tier gives you one workspace and three editing guests, which is enough to loop in a peer or a mentor without anyone reaching for a credit card. The Workspace tier is €12 a month if you want to run this template across every quarter, every cycle, without thinking about it again.",
    },
  ],
  closer:
    "Open the template, fill the wins column first, and the rest of the review writes itself by Thursday.",
};
