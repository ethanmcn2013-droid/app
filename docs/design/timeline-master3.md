# Timeline artifact: final Master 3

Ethan approved the final Claude Design package for full native integration on 18 October 2026. This supersedes the shared artifact's September countdown/proportional-rail layout; it does not redesign the Timeline editor or transfer milestone ownership from Tasks.

## Design authority

The supplied `Signal Timeline - Master 3 pack` was refreshed after round 6, canvas49. Current `M3-Core.dc.html`, `m3.css`, sixteen `Final-*` wrappers and the round6 laptop/phone boards define the presentation. Earlier reviews are historical design evidence. The package's DC runtime and sample wedding/school/shop data are not production dependencies or customer data.

Commit the layout, typography, colors and state rules in native React/CSS. Real project data and explicit owner-entered public settings supply the content. Keep a single shared component for published guest pages, owner previews, phone previews and Ping's current private preview.

## Direction contract

THESIS: One shared calendar story, with the next date immediately legible.

OWN-WORLD: Geist, white or near-black paper, ink actions, indigo Next; the supplied Master3 tokens and boards are binding.

STORY: Understand the main day, read the ordered milestones, then use the relevant calendar, directions, sharing or follow action.

FIRST VIEWPORT: A fitted1440×810 desktop stage: header, large title/countdown left, event panel right, full-width milestone rail, coming-up/follow columns and footer. Under1024px or unsuitable scale, use a scrolling680px column with20px gutters and milestones before calendar/follow.

FORM: Supplied final Master3 composition; no generated alternative or random direction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Product boundaries

- Tasks owns milestone existence and execution state. A date passing is a calendar fact, never proof that an assigned task or RSVP was completed.
- Published pages use frozen, strictly allowlisted public snapshots. Source descriptions, membership, comments, private identifiers and hidden milestones stay outside that boundary.
- Current private preview is read-only, never publishes, never exposes a bearer URL and never records a qualified guest view.
- Venue/address and detailed link previews require explicit owner consent. Missing dates remain missing. Generic projects never inherit sample wedding copy.
- Follow requires real double opt-in. Simulated prototype messages, follower counts and receipts are never production proof. Missing service configuration produces a truthful unavailable state.
- Calendar files/feed contain only authorized public dates; the authenticated private Tasks calendar is a separate service.

## Package discrepancies resolved

During exam weeks, suppress completed-plan copy through the configured exam interval, matching round6 intent. Use the handoff's three-cycle Next pulse, disabled for reduced motion. Keep stable date order and preserve final-day priority ahead of post-final events. Do not emit the prototype's2099 sentinel date.

Motion verdict: restrained. One finite Next marker pulse and functional focus/reveal transitions; no decorative entrance choreography.

## Verification

Source intake preserved223 file hashes and sixteen synthetic wrapper fixtures outside the customer application. Native component captures and actual Next route receiving are separate proofs. Historical round6 scores and earlier204-case product captures do not certify this new source. Release requires fresh checks, reviewed desktop/phone behavior, isolated migration rehearsal and the owning release path.

## Required release order

Migration `0002_master3_presentation` must be backed up, rehearsed and applied to the verified Timeline database **before this application revision is deployed**. The approved `timeline-db-migrate-encrypted` workflow requires dedicated Timeline credentials and an independently received target hash; Tasks credentials are never substituted. Verify the four tables and receipt-backed no-op readback before deploying. Published changes deliberately fail if durable notification intent cannot commit with the primary save. A missing migration is a deployment blocker, not permission to ignore the queue error.

Provision the independent follow signing secret and verify email, rate-limit storage and cron configuration before admitting followers. Keep the current private Timeline unpublished. Optional guest-service failure must leave the readable public artifact available; it does not establish that follow is configured.
