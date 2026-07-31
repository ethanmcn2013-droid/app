# Product Hunt · taskshq launch page draft

**URL slug:** producthunt.com/products/taskshq
**Launch:** Tue 2026-06-23, 3:01am PT (= 6:01am ET)
**Hunter:** [TBD — Chris Messina / wedding-vertical maker — line up by 2026-06-08]
**Maker:** Ethan McNamara (@ethanmcn — confirm PH handle)
**Status before launch:** "Coming soon" page live by 2026-05-11; switch to "Launching today" Tue 06-23 at 3am PT.

---

## Tagline (60 char max — shows under product name)

Project management without the vocabulary tax.

---

## Description (260 char max — the elevator pitch on the product card)

Four views — board, list, timeline, calendar. Per-workspace pricing, not per-seat. A published list of eight features we'll never ship. Built for wedding planners, students, freelancers, trades, families — the 80% who don't work in tech.

---

## Topics (PH categories — pick 3-5, in priority order)

- Productivity
- Project Management
- SaaS
- Design Tools
- No-Code

---

## Gallery (4-6 image briefs, each labeled with what to render and how)

### Image 1 · Hero (1270×760) — strikethrough manifesto

Center the /about page strikethrough block on the studio off-white. Ten words with rose strike lines: sprint planning · epic refinement · ticket triage · issue grooming · story points · burndown reviews · stand-up rituals · backlog dependencies · gantt cascades · OKR alignment. To the right, the emerald "tasks" pill stands. Below in display weight: "You don't need a vocabulary. You need a list." Asset reference: `src/components/marketing/about-manifesto.tsx` Strikethroughs section. Capture: navigate to tasks-nu-hazel.vercel.app/about, screenshot the strikethrough block at 2x, crop to 1270×760, export PNG.

### Image 2 · Four-view montage (1270×760)

Two-by-two grid of the same wedding workspace data rendered four ways: top-left board (lanes), top-right list (lines), bottom-left timeline (shape), bottom-right calendar (days). Each tile labeled in the corner with its view name in 11px caps. Hairline border between tiles. Below the grid in 14px ink-soft: "Same tasks, four lenses. No re-entering anything." Capture: render each view from /app/board, /app/list, /app/timeline, /app/calendar at 1270×760 each, composite in Figma to a single 1270×760 frame.

### Image 3 · Refusal list — the 8 verbatim refusals on cream

The /principles page refusal block, vertical list, numbered 01–08. Each item: rose pill number, title in ink, one-line summary in ink-soft. Header reads "Eight features we'll never ship." Sub-line: "Most product roadmaps are a list of yeses. This is the other list." Pull text verbatim from `src/components/marketing/principles-manifesto.tsx`. Capture: navigate to tasks-nu-hazel.vercel.app/principles, screenshot the eight-item ul block at 2x, crop to 1270×760.

### Image 4 · Pricing math (1270×760)

Side-by-side comparison frame. Left column header: "Per-seat tools." Below: "Asana · $11–25/seat × 5 collaborators = $55–125/mo." Right column header: "Per-workspace Tasks." Below: "$9.95/workspace flat. Add the bride, groom, both moms, the DJ. Same price." Bottom line in display weight: "Inviting a collaborator shouldn't be a budget decision." Footer micro-copy: "Studio tier $14.95/operator for freelancers with five clients." Use the pricing-page color tokens. Capture: build in Figma using brand tokens from `src/app/globals.css`, export 1270×760 PNG.

### Image 5 · A real published /p/{slug} workspace screenshot (1270×760)

A live published workspace page rendered for the wedding domain pack — serif headline, blush florals, read-only view of the wedding workspace. Shows the 3-month countdown checklist with a couple of items checked. Demonstrates that "every shared workspace is a marketing asset." Capture command — `mcp__plugin_playwright_playwright__browser_navigate` to https://tasks-nu-hazel.vercel.app/p/wedding-2026-public, then `mcp__plugin_playwright_playwright__browser_take_screenshot` at viewport 1270×760, full page false, save PNG.

### (Optional) Image 6 · 30s hero loop — looped MP4 (1080×1080)

The 30-second silent hero loop. Opens on the strikethrough manifesto resolving to the emerald "tasks" pill, dissolves into the four-view morph (board → list → timeline → calendar), holds on the refusal list, ends on the wordmark with the green pulse dot. No voiceover. PH supports MP4 in gallery. Asset: `public/hero-loop.30s.mp4`. Confirm aspect — if the file is 16:9, letterbox to 1080×1080 with the studio off-white bars.

---

## First comment (the founder's pinned reply, 200-280 words)

Solo founder here. Tasks is a small bet against vocabulary.

The shortest pitch is the refusal list. We publish — on a public URL — eight features we'll never ship. No per-seat pricing. No Gantt charts. No SSO as a marketing line. No AI agent that runs your tasks for you. No real-time push notifications. No story points or burndown or OKR alignment. No paid template marketplace. No threaded comments-on-comments. The full list is at /principles, with the reasoning under each one.

Most roadmaps are a list of yeses. This is the other list. The features competitors keep asking for, the ones enterprise sales would pay us to add, the ones a clever PM could justify in a one-pager. We keep saying no, and we keep the no in plain English on a URL so future cycles can be held to it.

Who it's for: the wedding planner three months out, the college student writing a thesis, the freelance developer juggling four clients, the contractor running a jobsite punchlist, the parent organizing a 200-guest event from a Google Sheet. Not the 200-person ops team — Linear already has them.

Per-workspace pricing, not per-seat. The wedding workspace fits the bride, groom, both moms, and the DJ for $9.95/mo flat. Free tier is honest: one workspace, all four views, three editing guests, no card.

One question for the room — which feature on the refusal list would you have argued hardest to keep?

---

## Maker comment cadence (Tue 06-23 + Wed 06-24)

| Time (ET) | Comment focus | Notes |
|---|---|---|
| 7:00am Tue | Launch announce + first principles excerpt | Set the tone. |
| 11:30am Tue | Pricing-math drilldown | Front-run the "isn't $9.95 too cheap?" question. |
| 3:00pm Tue | Cinematic-demo deep-dive | Hook the design crowd. |
| 9:00am Wed | "What surprised me overnight" | Acknowledge top comment. |
| 10:30am Wed | One spec / cycle-narrative excerpt | Pull from CHANGELOG cycle 30 — the Google bridges thesis (CSV / Markdown / iCal subscribe instead of OAuth). |

---

## Topics + tagline rationale (≤80 words, internal note for review)

Productivity and Project Management are the two unavoidable home categories — PH's algorithm rewards correct primary placement. SaaS broadens reach without misrepresenting. Design Tools opens the design-crowd surface that the cinematic demo and refusal list speak to most directly. No-Code is a slight stretch but accurate — the audience is non-technical operators. Tagline is verbatim from gtm-plan §6 (46 chars, fits 60). Description is verbatim from gtm-plan §6 (241 chars, fits 260). Zero edits required.

---

## Pre-launch ops checklist

- [ ] PH "Coming soon" page live (2026-05-11)
- [ ] Hunter confirmed (≤ 2026-06-08)
- [ ] First comment finalized (2026-06-22)
- [ ] Gallery images rendered + uploaded (2026-06-22)
- [ ] Maker comment drafts in `docs/posts-week-7.md` Tue/Wed slots (handled by W7 post drafter)
- [ ] Maker handle on PH confirms `@ethanmcn` or alternative
- [ ] /pricing page reviewed for screenshot freshness
- [ ] At least one published /p/ workspace verified live
