# Tasks · launch-eve checklist

The single page to read on Mon 2026-06-15 evening, after the dry-run, before bed. Every line maps to a row in `/roadmap` so the morning's actions are tracked, not lost.

Last revised: 2026-05-07.

---

## The night before — Mon 2026-06-15

### Product (P0)

- [ ] All marketing routes return 200. Run: `for r in / /pricing /principles /about /changelog /press /privacy /terms /security; do curl -sI http://<domain>$r | head -1; done`
- [ ] All `/app/*` routes work signed-in. Manual walk-through: board → list → timeline → calendar → inbox → settings.
- [ ] `/app/*` redirect to `/sign-in` when signed-out. Incognito test.
- [ ] One real $79 Wedding purchase tested in prod (refund yourself after).
- [ ] One real $9.95 Team purchase tested in prod (refund after).
- [ ] One published `/p/{slug}` workspace verified live with valid OG card.
- [ ] Sentry alert rule live, on-call destination set.
- [ ] `/status` shows green.
- [ ] Rollback plan rehearsed once (`vercel rollback` to last-known-good commit).

### Auth + Stripe (P0)

- [ ] Sign-up via email + Google OAuth tested in prod.
- [ ] Friend tested Google SSO end-to-end on independent device.
- [ ] Stripe webhook re-delivery tested (idempotency holds).
- [ ] Failed-card scenario tested.
- [ ] `getEffectiveTier` returns the right tier for every test purchase.

### Promo codes (P0)

- [ ] Test comp code minted, redeemed at `/redeem/<code>`, entitlement granted, quantity decremented.
- [ ] Expired code path returns the refusal screen.
- [ ] `.edu` auto-Pro grant tested.

### File attachments (P0)

- [ ] Drag-drop upload works, optimistic placeholder replaced cleanly.
- [ ] 25 MB cap rejects gracefully.
- [ ] Mime blocklist rejects `.exe`.
- [ ] Cross-workspace download returns 404 (not 403 — opacity).
- [ ] Attached file shows in conversation feed.

### Mobile (P0)

- [ ] All marketing pages audited at 390px width.
- [ ] `/app/board` mobile drag-drop disabled, "Move to" popover works.
- [ ] Detail panel slide-up doesn't overlay tabbar.
- [ ] iPhone notch safe-area respected.

### SEO + security (P0)

- [ ] Sitemap.xml includes every marketing route + the four new legal/info pages.
- [ ] Robots.txt blocks `/app`, `/share`, `/redeem`, `/welcome`, `/api`.
- [ ] HSTS header present in prod responses.
- [ ] CSP header restricts script-src + img-src.
- [ ] No sk_/whsec_ in `.next/static`.
- [ ] Webhook signature verification works (Clerk Svix + Stripe sig).

### Email + comms (P0)

- [ ] Daily digest cron actually fires (verified via `/api/cron/digest?send=1`).
- [ ] Resend SPF/DKIM/DMARC verified — press emails land in inbox, not spam.
- [ ] Support email forwards to ethanmcn2013@gmail.com.

### Legal + compliance (P0)

- [ ] `/privacy` published.
- [ ] `/terms` published.
- [ ] `/press` published.
- [ ] `/security` published with disclosure email.
- [ ] Trademark search done; no infringing wordmark exists in Class 9.

---

## The pre-stage — Mon 2026-06-15 evening, 8pm onwards

Per `docs/launch-day-show-hn.md` 8:00pm section:

- [ ] Open browser tabs ready: HN submit page, X composer, Bluesky composer.
- [ ] `docs/show-hn.md` body memorised.
- [ ] X 8-thread from `docs/posts-week-6.md` Tue 09:30 staged.
- [ ] `docs/kpi-log.md` open in editor for the morning's pulse checks.
- [ ] Phone in another room from 9pm onwards.

---

## Tue 2026-06-16 morning — Show HN

The full hour-by-hour is `docs/launch-day-show-hn.md`. Don't improvise.

- [ ] **9:00am ET — paste Show HN body. Hit submit. Note the timestamp.**
- [ ] 9:01–9:15 — open in incognito to confirm visible.
- [ ] 9:15 — start replying. 5–10 min reply gaps for the first hour.
- [ ] **9:30am ET — post the X narrative thread (8 posts).**
- [ ] 10:00 — post the Bluesky announce single.
- [ ] 11:30 — first KPI pulse check (write to `kpi-log.md`).

The five things that don't happen on Show HN day:

1. No new feature ships. The launch is the product as it stands.
2. No reply that argues. Acknowledge "looks like Notion" and point at `/principles`.
3. No metric tracking beyond the five KPIs. No vanity counters.
4. No social outside HN/X/Bluesky. LinkedIn waits until W7.
5. No Slack distraction. Phone in another room.

---

## Wed 2026-06-17 — Recap

- [ ] X 5-thread recap with HN numbers (placeholders in `posts-week-6.md` Wed 10am — fill in).
- [ ] Press nudge to 3 newsletter writers with HN data.
- [ ] YouTube short reaction recap (60 sec).

---

## After Show HN, before PH (Thu–Sun W6)

- [ ] Carousel/thread: top 5 HN questions answered (Thu).
- [ ] Press follow-ups to Dense Discovery / Sherwood / Stratechery with HN numbers (Thu).
- [ ] IH cross-post "what Show HN taught us in 72 hours" (Fri 06-19).
- [ ] Refusal-list traveling thread on X (Fri).
- [ ] Sat REST. Mandatory.
- [ ] Sun PH back-channel: brief 8 hunter-friends.

---

## Tue 2026-06-23 — Product Hunt (3:01am PT)

The full hour-by-hour is `docs/launch-day-product-hunt.md`. Same drill as Show HN, different cadence.

- [ ] **6:01am ET — submit at producthunt.com/products/taskshq.**
- [ ] 6:02am — paste first comment from `docs/product-hunt-page.md`.
- [ ] 7:00am — X launch thread (10 posts).
- [ ] 8:00am — Bluesky 4-thread + r/SideProject.
- [ ] Maker-comment cadence: 7am, 11:30am, 3pm Tue + 9am, 10:30am Wed.
- [ ] Reply within 15 min of every comment for first 6 hrs.

---

## Wed 2026-06-24 — IH milestone

- [ ] 9:00am ET — IH milestone post (body in `docs/posts-week-7.md` Wed).
- [ ] X recap thread (6 posts) with PH numbers.
- [ ] YouTube "PH launch day" short.

---

## After both launches — Thu 06-25 onwards

- [ ] "Launch week by the numbers" post (LinkedIn / X).
- [ ] Thank-you email to every press writer who covered.
- [ ] /changelog: ship one small thing visible to the first wave (Fri 06-26).
- [ ] W6 + W7 retros in `kpi-log.md`.

---

## What this checklist does NOT cover

- The 233 other action items in `/roadmap`. Those are the comprehensive engineering/QA/security/compliance lattice. P0 items there should also be closed before 06-16; this checklist is the on-the-day version, not the comprehensive one.
- Phase 3 user-blocked items (domain purchase, ElevenLabs subscription, handle claims, ScreenStudio recordings, paid spend authorization). Those should resolve before launch day — see `/roadmap`'s Blockers strip.
- The post-launch sustainment cycle. Cycles 32+ in `CHANGELOG.md` will pick that up.

---

## Closing note

By the time this checklist matters, every line on it has already been read at least three times. That's the point — the launch beat is not the place to learn anything new. Read it once now. Read it once Mon evening. The third read is on the day, sentence by sentence, ticking as you go.
