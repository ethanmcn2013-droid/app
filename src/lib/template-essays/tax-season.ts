import type { TemplateEssay } from "./types";

export const essay: TemplateEssay = {
  templateId: "tax-season",
  seoTitle: "Freelancer Tax Season Checklist, 1099s, S-Corp, Estimated",
  seoDescription:
    "The tax checklist for freelance devs and one-person S-corps. 1099s, expenses, 1120-S, Q1 estimated, apply it to a free workspace and stop dreading April.",
  heroline: "Tax season is just a list you’ve been avoiding since November.",
  intro:
    "It’s late February. A 1099 from a client you forgot about shows up in the mail. Your CPA emailed last week and you haven’t replied. The Stripe export and the Mercury export are both open in tabs and neither of them matches your books. You owe an estimated payment in six weeks. None of this is hard. All of it is loud, and the loudness is what makes freelancers file in April at 11pm instead of in March on a Tuesday afternoon.",
  sections: [
    {
      heading: "What goes wrong without a list",
      body:
        "Three things, every year. A 1099 doesn’t arrive and you don’t notice until the IRS does, most clients send them, some don’t, and the income is yours to track regardless. Expenses get categorized in one frantic weekend instead of four calm ones, which is how a software subscription becomes “misc” and a real deduction becomes nothing. The 1120-S deadline is March 15, not April 15, and the S-corp freelancer who learns that on March 12 pays a late-filing penalty for something that took an afternoon. None of this is a tax problem. It’s a list problem.",
    },
    {
      heading: "What’s in this template",
      body:
        "Seven tasks, in the order a one-person S-corp actually moves through them. Collect 1099s from every client (pinned P0, due today, because chasing them in March is worse than chasing them in February). Categorize Q1–Q4 expenses. Reconcile Stripe and Mercury so the books match the bank before the CPA sees either. File the 1120-S, that’s the March 15 one. Draft the personal return with your CPA. Set Q1 estimated for next year while the numbers are fresh, not in a panic on April 14. And the quietly important last one: stash receipts in a single folder for next year, so the next version of you starts ten hours ahead.",
    },
    {
      heading: "Why drop it into Tasks instead of a spreadsheet",
      body:
        "Most freelancers run this in a Google Sheet that has eight tabs and one truth, and the truth is in someone’s head. A workspace gives you priorities, due dates, and tags that survive the year, “income,” “expenses,” “filing,” “future-me”, instead of a tab graveyard. If you run five clients, you already know one workspace isn’t enough; the Workspace tier is €12 a month for unlimited workspaces, which is roughly the cost of forgetting one deductible lunch. Your accountant can come in as a guest. Three guests are free.",
    },
  ],
  closer:
    "Apply it in 30 seconds. The tasks land in your active workspace; April stops being the cliff.",
};
