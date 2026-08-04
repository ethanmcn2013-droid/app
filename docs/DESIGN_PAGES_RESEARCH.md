# Design pages — field research

**Status: research. Commissioned by the operator 2026-07-31.**

The brief: find the best "design pages" in the world — pages where a company
shows off design craft itself. Not brand-guideline documentation. Pages that
make people feel something. Rank them, extract why they work, and ideate what
a Signal Studio design page could be.

**Register note.** The in-repo motion contracts
(`docs/design/TASKS_DELIGHT_MOTION_CONTRACT.md`, the DELIGHT_CATALOG ground
rules) encode the restraint-first register. Operator direction on the day this
research was commissioned: that register is being re-engineered — it went too
restrained, too early, and is holding back creativity. This document therefore
ranks for **feel first** and ideates past the current motion budgets. The
contracts remain authoritative for shipped product surfaces until the register
revision lands; when that revision is decided, it needs its HQ decision record
in `studio/content/hq/decisions/`.

**Method.** Four parallel research passes (company flex pages · design-team and
SaaS craft sites · award-tier interactive work · type specimens, individual
craft pages, curation platforms), ~70 sites, verified 2026-07-31. This
environment's egress proxy blocks direct page fetches, so statuses are
search-verified against current coverage rather than live-browsed; interaction
details that rest on pre-2026 firsthand knowledge are marked *(verify)*.
Weakest verifications are listed in Appendix B.

---

## 1. The genre

A design page is a page whose subject is the company's own taste, and whose
argument is made by the page's behavior rather than its copy. The genre test:
could you delete every sentence and still come away convinced? On the best of
these, yes.

Four lineages feed it:

1. **Scrollytelling** — NYT "Snow Fall" (2012) through Apple's product pages:
   scroll as a film scrubber.
2. **The wonder sites** — the Flash-era spectacle tradition, reborn as WebGL
   award work (Active Theory, Lusion, Abeto).
3. **The design-team magazine** — airbnb.design, spotify.design, dropbox.design
   (2016–2019). Mostly dormant now; see §5.
4. **The craft page** — rauno.me/craft, Family's values page, Vercel's design
   pages: small, obsessive, interaction-first. The current center of gravity.

---

## 2. The canon, ranked

Ranking criteria, in order: does it make you feel something (feel), execution
quality (craft), genre fit (is the page itself the flex), durability (still
worth studying today). Scores are 1–10, synthesized from the field passes.

### 1 · Family — family.co/values

**Feel 9 · Craft 9.** The purest specimen of the genre. Each company value is a
bespoke interactive 3D vignette: iridescent objects you drag and spin, buttons
that physically depress *(verify — founder Benji Taylor left Oct 2025; the
famous version is at risk of quiet change; his companion essay lives at
benji.org/family-values)*. "Delight in the details" is demonstrated, not
claimed. A wallet company proving it sweats details by making a values page
you play with. The single best reference for what `/principles` could become.

### 2 · Igloo Inc — igloo.inc

**Feel 10 · Craft 10.** Awwwards Site of the Year 2024, by Abeto. Scroll bores
you down a drilled ice-core shaft; each portfolio company sits physically
encased in a block of ice; procedural crystals grow and frost creeps over the
UI itself. The reason it matters here: it is the current proof that spectacle
and discipline are not opposites — WebGL wonder with ~1s LCP, compressed
textures, and real `prefers-reduced-motion` fallbacks. Wonder that janks reads
as incompetence; this doesn't.

### 3 · Stripe — press.stripe.com + stripe.dev

**Feel 8 · Craft 10 / Feel 8 · Craft 9.** Stripe flexes sideways, on adjacent
properties rather than the money pages. Stripe Press: the book catalog as a
physical 3D shelf — scroll runs your finger along it, spines slide past,
covers rotate to face you; the 3D serves the merchandise, zero gimmick
residue. stripe.dev: the infinite footer that redraws "DEVELOPERS" on every
scroll tick while a Shepard tone rises forever, with a Ferris Bueller gag if
you keep going, plus a theme switcher including a berkshirehathaway.com
brutalist mode. Lesson: the flex page doesn't have to be the homepage.

### 4 · Poolsuite — poolsuite.net

**Feel 10 · Craft 8.** A full retro Mac OS desktop simulation — draggable
windows, VHS-grain pool footage, cassette-deck player — wrapped around a 24/7
disco stream. The highest sustained feel on this list, achieved through total
commitment to a bit. The rare marketing site people leave open for hours.
Lesson: commitment, not budget, is what reads as taste.

### 5 · Panic — play.date

**Feel 9 · Craft 8.** The site behaves like the product: small, silly,
tactile. The console wobbles with your cursor and scroll acts as the crank,
cranking a game scene forward; UI beeps echo the device's sound design
*(verify)*. You understand the crank before you've read a word.

### 6 · Oxide Computer — oxide.computer

**Feel 9 · Craft 9.** Pentagram identity rooted in terminal culture: a custom
cut of GT America Mono with extended characters generates the site's
illustrations as live ASCII — the typeface literally draws the pictures.
Perfect audience mirror (rack buyers live in terminals). The deep-nerd flex:
identity system as engineering values made visible.

### 7 · Cash App — design.cash.app

**Feel 7 · Craft 9.** Brand guidelines rebuilt as an immersive showcase (Index
Studio; Awwwards SOTD). Guideline chapters behave like product drops —
oversized $ glyphs and sticker-like elements you scrub through; motion, voice,
and illustration each demoed in situ *(verify)*. Proof the most boring genre in
design can carry swagger when it performs its own rules.

### 8 · PostHog — posthog.com

**Feel 9 · Craft 8.** A cream-paper textbook overrun by hand-drawn hedgehogs
in lab coats; the entire company handbook published as the website. Their own
framing: un-copyable because it's a reflection of the people who made it.
Personality as moat — the anti-SaaS-sameness strategy, sustained for years.

### 9 · Shopify — editions.shopify.com

**Feel 7 · Craft 9.** Twice a year, ~150 release notes get a fully
re-art-directed interactive world (past editions: scroll-through 3D corridors,
collectible-card UIs; latest: Summer '26 "Everywhere Edition"). The changelog
— the least glamorous artifact in software — turned into an event people
anticipate. The recurring reinvention is the flex.

### 10 · Notion — faces.notion.com

**Feel 8 · Craft 8.** An avatar builder that renders you in Notion's
hand-inked illustration style, launched Jan 2025. Identity play as
distribution: people share self-portraits, so the brand style ships itself.
The design page as a toy with a share loop.

**Near misses, one line each:** Mercury (8/9 — the full product demo on the
homepage, no signup); Raycast (8/9 — the site navigates by ⌘K like the
product); Resend (8/9 — the spinnable chromed R; email infra made
collectible); Liveblocks (8/8 — other live visitors' cursors float across the
marketing page); Daylight (9/8 — the page shifts into amber "sunset mode" to
demo the display in your browser); Amie (8/7 — the hero is a fidget toy);
Supabase Launch Week (8/8 — generative claimable tickets from your GitHub
identity); Rive (7/9 — the site runs on its own tool, graphics respond to
input); Attio (7/9 — the hero flips dark→light as you scroll); Duolingo brand
site (8/8 — guidelines that scold you in the owl's voice).

**The restraint pole, for calibration:** Linear (7/10 — so influential it
named a trend; the 2025 refresh went even quieter) and Vercel Geist (4/9 —
admiration, not delight; discipline as the flex). Both are craft benchmarks.
Neither makes anyone *feel* much — which is the operator's point about where
the register drifted, and equally a warning about what over-copying them does.

**The origin house:** Apple's flagship pages (7/10 — scroll-scrubbed hero
films, cuts landing exactly on scroll stops). Awe, not warmth; the technique
canon everyone else adapted. GTA VI's Leonida travelogue (8/9) is the current
big-budget peak of the same form.

---

## 3. The wider field

### Studios whose own sites are the portfolio piece

Reference tier for "how far can a page go" — most of these build the canon
above for clients.

| Studio | Site | The move | F/C |
|---|---|---|---|
| Abeto | (see igloo.inc, Messenger) | Two-time Awwwards annual winner; Messenger (Developer SOTY 2025) is a free multiplayer WebGL game — you deliver mail on a tiny planet while real players wave in emojis | 9/10 |
| Lusion | lusion.co | Soft-body blobs you poke and fling; hidden achievements layer rewards playing with everything | 9/10 |
| Unseen | unseen.co | Hover smears the page like ink in water (fluid-sim distortion); ambient sound | 9/9 |
| Active Theory | activetheory.net · paperplanes.world | Portfolio as continuous WebGL space; Paper Planes: fold a paper plane, flick your phone to throw it into a shared global sky — still magical ten years on | 9–10/9 |
| Exo Ape | exoape.com | Nothing ever cuts — case-study images physically travel with you into the next page | 8/10 |
| basement.studio | basement.studio | Shipped a full pixel-art point-and-click adventure (Basement Chronicles) as self-promo | 8/9 |
| OFF+BRAND | lando-norris.com | Site of the Year 2025: helmet Hall of Fame as spinnable 3D objects with inertia; Rive + WebGL inside Webflow, aggressively lazy-loaded | 8/10 |
| Obys | obys.agency | 2025/26 redesign built around a custom typeface drawn first — type is the interface | 8/9 |
| Phantom | phantom.land | The whole portfolio is one infinite draggable canvas you grab and throw | 8/8 |
| makemepulse | makemepulse.com | Annual New Year WebGL arcade-game "wishes"; FWA Hall of Fame 2026 | 8/9 |
| Locomotive | locomotive.ca | The reference demo for their own locomotive-scroll library | 7/9 |
| Cuberto | cuberto.com | Canonized the gooey cursor, then open-sourced it (Mouse Follower) | 7/8 |
| darkroom.engineering | lenis.darkroom.engineering | "Get smooth or die trying" — the page is the library demo; Lenis now underpins half the award sites above | 7/9 |

### Individuals — the bar for feel

- **rauno.me/craft** (10/10) — the canonical craft page and the genre's
  manifesto ("make it fast… make it soulful"): silent, chrome-less studies
  recreating OS-grade physics on the web.
- **neal.fun** (10/9) — Internet Roadtrip (thousands of strangers vote every
  few seconds to steer a car through Street View); Stimulation Clicker (the
  attention economy satirized by escalation, then released to ocean sounds).
  One joke, perfectly scoped, every time.
- **bruno-simon.com** (10/9) — rebuilt end-2025, SOTM Jan 2026: still the
  drive-a-truck-through-my-resume portfolio, now multiplayer — other visitors
  drive around you. Open-sourced, devlogs public.
- **joshwcomeau.com** (9/9) — whimsy as a designed, toggleable system:
  boopable mascot, opt-in sound, playground-in-every-post.
- **emilkowal.ski / animations.dev** (9/9) — essays with replayable
  bad-vs-good easing demos; his motion taste now ships as an agent skill
  (Jan 2026) — craft pedagogy gone tooling.
- **wattenberger.com** (9/9) — "Our interfaces have lost their senses"
  (2025): the essay argues chat UIs strip texture while demonstrating the
  tactile alternative under your fingers.
- **henryheffernan.com** (9/8) — a 90s beige PC on a 3D desk; the CRT boots a
  working faux-OS with real apps texture-mapped onto curved glass.
- **jesse-zhou.com** (8/7) — the neon ramen-shop portfolio; resume rendered
  on in-world CRT screens with steam rising off the broth.

### Type foundries — specimen pages as pure interaction

- **gt-flexa.com** (9/9) — cursor position drives the width/weight axes of
  the live headlines; you feel the design space instead of reading about it.
- **ABC Dinamo** (8/9) — the pre-purchase Font Customizer; licensing turned
  into play.
- **OH no Type** (9/8) — voice as UI ("Life's a thrill, fonts are chill!");
  monthly experimental toys in The Drawer.
- **Klim** (7/10) — print-grade essays; Söhne as "the memory of
  Akzidenz-Grotesk." The writing is the delight.
- **Pangram Pangram** (7/8) — full-bleed editable testers, instant trial
  downloads.
- **Displaay** (7/8) — catalog-wide live tester; merch site "offline for
  summer," a human touch. (Roobert = OpenAI's typeface.)

### The dormant tier — cautionary

airbnb.design (dormant), dropbox.design (abandoned after the 2017 rebrand
argument ended), slack.design (quiet post-Salesforce), thebrowser.company's
letters era (diluted post-Atlassian acquisition), hellomonday (less weird
post-DEPT), fey.com (dead — acquired). Two failure modes: **no metabolism**
(a manifesto with no reason to return) and **acquisition** (voice is the first
casualty). design.google survives on real ongoing work; intercom.design
survives by arguing about AI-era process; spotify.design survives on the one
gimmick that is the product (playable designer playlists).

---

## 4. What separates the top one percent

Ten principles, each earned by multiple sites above.

1. **The page is the argument.** Family demonstrates values as toys; Rive runs
   on Rive; Liveblocks shows you other visitors' cursors; Mercury opens the
   real product; Daylight turns the screen amber; Lenis scrolls its own proof.
   If the page's behavior doesn't demonstrate the claim, it's a brochure.

2. **One signature moment, fully committed.** Stripe Press is one idea (the
   shelf). play.date is one idea (the crank). stripe.dev's footer, Attio's
   theme flip, Oxide's ASCII typeface. The canon is remembered one moment per
   site. Ten nice animations < one unforgettable one.

3. **Scroll is a timeline, not a trigger.** The top tier choreographs scroll
   as narrative scrubbing — Apple's frame-exact cuts, igloo's descent, GTA
   VI's travelogue. Fade-in-on-scroll is decoration, not choreography.

4. **Play beats polish for memory.** Every 10-feel score is a toy: Poolsuite,
   Paper Planes, Bruno Simon, neal.fun, Family's draggable orbs, Lusion's
   pokeable blobs. Letting people *do something impractical* is what gets
   screenshotted and shared.

5. **Reward curiosity.** Cartier hides cursor gestures in its alcoves; Lusion
   hides achievements; stripe.dev hides Ferris Bueller; Raycast and Resend
   seed easter eggs. Depth for the 1% who poke is how a page earns evangelists.

6. **Spectacle requires discipline.** igloo.inc ships wonder at ~1s LCP with
   reduced-motion fallbacks; lando-norris lazy-loads its way to Site of the
   Year; GTA VI holds at planetary traffic. Jank converts wonder into doubt.
   Performance and accessibility are part of the feel, not a tax on it.

7. **Voice is an interaction surface.** PostHog's hedgehogs, Duolingo's
   scolding owl, teenage.engineering's lowercase whisper, Ohno's "Fonts 💀".
   Copy that behaves in-register makes motion land harder. (Ours is dry and
   clean — a real asset here.)

8. **Personality compounds; polish alone doesn't.** The dormant tier died
   polished. PostHog's un-copyable weirdness, Poolsuite's bit, neal.fun's
   jokes keep compounding. Weird is a moat.

9. **Presence is the new frontier.** Bruno Simon's other drivers, Messenger's
   live players, Internet Roadtrip's collective steering, Paper Planes' shared
   sky, Liveblocks' cursors. Feeling other humans on the page is the
   2025–2026 feel-maker, and almost no company site uses it yet.

10. **Sound is the untouched dial.** stripe.dev's Shepard tone, Poolsuite's
    stream, Unseen's ambience, Josh Comeau's opt-in effects, play.date's
    beeps. Always opt-in, never autoplay — and almost nobody does it, which
    is exactly the opportunity.

---

## 5. The arc, and why the timing favors the register change

Flash-era spectacle (2000s) → scrollytelling journalism (2012) → design-team
magazines (2016–2019, now dormant) → the Linear-flavored restraint consensus
(2019–2023, since named and cloned into sameness) → the current swing:
craft pages, WebGL wonder with engineering discipline, multiplayer presence,
toys. The zeitgeist line from the research: **"In the age of slop, craft is
rebellion."** As AI-generated sameness floods the medium, handmade interactive
wonder is becoming the scarcest — and most legible — signal of a team that
cares. Loosening a too-restrained register in 2026 is moving *with* the
current, not against it.

---

## 6. Ideation — the Signal Studio design page

Grounding: the wordmark's indigo dot (already "load-bearing" per
`docs/brand.md`), the `/about` + `/principles` manifesto pair, the four-module
suite (Notes = capture, Tasks = execution, Timeline = direction, Signal =
attention), the signal/noise thesis, warm-stone + indigo, Geist, dry voice.
Concepts are sequenced roughly cheap→expensive; they compose.

**A. The refusal list, performed.** Upgrade `/principles` from typeset
manifesto to the Family-values move in our register: each of the eight
refusals gets a tiny interactive vignette that *demonstrates* the refusal.
No per-seat pricing → a seat counter you can crank to absurdity while the
price refuses to move. No AI auto-complete → a text field that pointedly
declines to finish your sentence. No push notifications → a bell you can ring
that does nothing, with one dry line. Refusals-as-toys: the dry voice makes
the jokes land drier than Family's earnestness ever could. **Strongest
concept: exact genre fit, already-written copy, page already exists.**

**B. The dot goes first.** The wordmark dot becomes the page's protagonist: a
physics object that leads the scroll — rolling along type baselines, dropping
between sections, splitting into four dots (one per module) at the suite
reveal, flickable the whole way. Family's orb energy, but derived from an
existing brand asset instead of imported decoration.

**C. Noise → Signal.** The thesis as the page's one shader: it opens as
static — type dithered, image scrambled — and scrolling tunes it into clarity,
section by section; the cursor is a local tuner. One metaphor carries the
whole narrative arc, igloo-style (one idea, fully committed), and it is *our*
idea — no competitor can copy it without describing us.

**D. Four rooms, four physics.** One scroll, four movements, each module with
its own material behavior: Notes = ink (your cursor trail becomes a captured
note), Tasks = weight (a checkbox with real spring resistance — the "first
meaningful completion" signature the motion contract already reserves),
Timeline = time (a scrubber that replays the section you just read), Signal =
attention (the page quietly notices where you linger — "we noticed you
noticed").

**E. The craft ledger.** Press `?` and the page annotates itself: every
easing curve, duration token, and animate-vs-restrained verdict exposed in
place. The design-engineer flex (rauno lineage), fed directly from the
DELIGHT_CATALOG verdicts. Receipts as flex; no other company can fake it.

**F. Plain-mode toggle.** One switch strips the page to unstyled HTML —
teenage.engineering's whisper as an easter egg: "everything off. still reads
fine." The confident inverse of concept C.

**G. Opt-in sound.** A single tuning tone that resolves as noise becomes
signal (C), a soft tick on the checkbox (D). Never autoplay. Principle 10:
the dial nobody touches.

**H. Presence, later.** Other current readers as faint indigo dots drifting
in the margin — attention made visible, which is literally what Signal sells.
The 2026 frontier move; needs infra, so v3.

**Placement.** `/about` and `/principles` live in this repo's marketing
surface, so the design page starts here (e.g. `/craft` or `/design` on the
Tasks marketing surface, per the URL contract — no retired paths). A
studio-level page at the signalstudio.ie root is a `studio`-repo decision;
same concepts port.

---

## 7. Iteration path

- **v1 — the page earns its name.** Concept A (three refusal vignettes, not
  eight — best three jokes first) + concept E lite (annotate what exists) +
  one dot moment from B at the hero. Everything else stays typeset. Bar for
  each vignette: would someone screenshot it?
- **v2 — the narrative.** Concept C's noise→signal shader as the page spine;
  remaining refusal vignettes; concept G sound; concept F toggle.
- **v3 — the frontier.** Concept D's four rooms as the suite story; concept H
  presence when infra allows.
- **Measure feel, not clicks:** scroll completion, dwell, `?`-presses (E),
  sound opt-ins (G), and the honest one — screenshots/links shared in the
  wild. Reduced-motion parity ships in v1 or the register revision loses its
  credibility (igloo does it; we don't get to skip it).

---

## 8. Sourcing pipeline

For the DELIGHT_CATALOG reference-sourcing pass, in order of signal:

- **godly.website** — 3–5 hand-picked sites/week with video previews; highest
  signal-to-noise for this exact genre.
- **60fps.design** — 1,200+ native-framerate clips filtered by interaction
  pattern; the reference library for per-site micro-interaction verdicts.
- **awwwards.com** — the daily firehose where the genre debuts; SOTD/SOTM/
  annuals as the long list.
- **hoverstat.es** — the weird end: alternative layout/navigation/typography
  with credits.
- **minimal.gallery** — the restraint benchmark to calibrate against.
- Also live and useful: curated.design, siteinspire.com, httpster.net,
  dark.design, seesaw.website, refero.design (product-UI patterns),
  land-book.com (conversion pages), footer.design (single-component
  connoisseurship), typespecimens.xyz (specimen genre analysis).

---

## Appendix A — full verified index

Feel/Craft, status search-verified 2026-07-31. †= interaction detail rests on
pre-2026 knowledge, spot-check live. Companies: family.co/values 9/9† ·
igloo.inc 10/10 · press.stripe.com 8/10 · stripe.dev 8/9 · poolsuite.net 10/8
· play.date 9/8† · oxide.computer 9/9 · design.cash.app 7/9† · posthog.com
9/8 · editions.shopify.com 7/9† · faces.notion.com 8/8 · mercury.com 8/9 ·
raycast.com 8/9† · resend.com 8/9† · liveblocks.io 8/8† · daylightcomputer.com
9/8† · amie.so 8/7† · supabase.com/launch-week 8/8 · rive.app 7/9 · attio.com
7/9 · design.duolingo.com 8/8 · linear.app 7/10 · vercel.com/geist 4/9 ·
Apple flagship 7/10 · rockstargames.com/VI 8/9 · brand.github.com 5/8 ·
brand.uber.com 6/8 · design.google 6/8 · spotify.design 8/8 ·
intercom.design 7/7 · teenage.engineering 7/8 · thebrowser.company 8/7
(historic) · lando-norris.com 8/10 · scoutmotors.com 7/9 · zentry.com 8/8
(weak verification) · clay.com 7/8† · modal.com 7/8† · cursor.com 6/8 ·
design.lyft.com 5/6 · ibm.com/design 4/7 · airbnb.design 6/7 (dormant) ·
dropbox.design 5/7 (dormant) · slack.design 6/6 (dormant). Studios:
lusion.co 9/10 · unseen.co 9/9 · activetheory.net 9/9 (paperplanes.world 10) ·
exoape.com 8/10 · basement.studio 8/9 · obys.agency 8/9 · phantom.land 8/8 ·
makemepulse.com 8/9 · locomotive.ca 7/9 · cuberto.com 7/8 ·
lenis.darkroom.engineering 7/9 · hellomonday.com 7/8 · Messenger (Abeto) 9/10.
Individuals: rauno.me/craft 10/10 · neal.fun 10/9 · bruno-simon.com 10/9 ·
joshwcomeau.com 9/9 · emilkowal.ski 9/9 · wattenberger.com 9/9 ·
henryheffernan.com 9/8 · jesse-zhou.com 8/7 · pudding.cool 9/9 ·
pentagram.com 7/9 · mschf.com 7/7. Foundries: gt-flexa.com 9/9 ·
abcdinamo.com 8/9 · ohnotype.co 9/8 · klim.co.nz 7/10 · pangrampangram.com
7/8 · displaay.net 7/8.

## Appendix B — verification caveats

Direct page fetches were blocked by this environment's egress proxy; all
statuses come from search-index evidence current to 2026-07-31, and †-marked
interaction details from pre-2026 firsthand knowledge. Weakest: zentry.com
(no 2026 coverage found), clay.com and modal.com (visual state unverified),
mschf.com (brand active, domain not directly surfaced), family.co/values
(post-founder-departure drift risk), figma-brand-page existence (unresolved).
fey.com is confirmed dead (Wealthsimple acquisition). Before copying any
specific interaction, view the live page from an unblocked connection.
