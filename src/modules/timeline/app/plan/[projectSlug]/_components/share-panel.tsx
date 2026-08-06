"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { Dialog } from "@/components/primitives/dialog";
import {
  ActionNotice,
  ArmedSubmitButton,
  ShareReceipt,
  fieldClass,
  primaryButton,
  quietButton,
} from "@/modules/timeline/app/audience/share-controls";
import { publicationStateLabel } from "@/modules/timeline/lib/format";
import {
  publishAudiencePublicationAction,
  rotateAudienceShareAction,
  unpublishAudiencePublicationAction,
  revokeAudienceShareAction,
  type AudienceActionState,
} from "@/modules/timeline/server/actions/audience-timeline";

const INITIAL: AudienceActionState = { status: "idle" };

/**
 * Everything this surface is allowed to say about a share, in one shape.
 * Plain data so the server page can hand it straight to the client without
 * dragging a `server-only` type across the boundary.
 */
export type SharePublicationSummary = Readonly<{
  id: string;
  label: string;
  state: "draft" | "published" | "unpublished";
  /** Shares that a viewer could actually open right now. */
  activeShareCount: number;
  /** The publication's own calendar zone — expiry dates are read in it. */
  timezone: string;
  /** Milestones whose source changed after they were copied, by title. */
  divergedTitles: readonly string[];
}>;

/**
 * Share, separated from Preview.
 *
 * THE LINK IS THE PANEL. It opens on the URL and a control that copies it;
 * everything that can destroy a link — make a new one, switch them off,
 * unpublish — sits below a rule in a second group of its own. It used to open
 * on those three, with the link itself appearing only as a receipt beneath the
 * form that had just minted it, so the one thing an owner comes here to do was
 * the one thing the panel did not offer.
 *
 * Where the link genuinely cannot be handed over, this says so in those words.
 * Publishing stores `sha256(token)` and nothing else (see
 * `server/audience-timeline.ts`), so a link that was not written down at the
 * moment it was made is gone — not hidden behind a control, gone. The panel
 * does not imply otherwise, and it names the only real move: make a new link,
 * which stops the old one working. That is a limit of the data model, recorded
 * here rather than papered over with copy.
 *
 * Every word here keys off `linkLive` — published AND at least one share still
 * active — never the raw state column. Revoking kills the links without
 * touching `state`, so a row can read "published" while nothing opens; keying
 * off `state` alone would tell the owner their timeline is reachable when it
 * is not. This is the same derivation the shared-timelines manager uses.
 *
 * The vocabulary is the one that already exists in lib/format.ts — Link live,
 * Private draft, Unpublished, Links revoked — reached through
 * publicationStateLabel so a new word cannot be invented here.
 *
 * What sharing does NOT do is as load-bearing as what it does. There are no
 * passwords, no named recipients, no limit on how many people open a link, and
 * no count of who opened it. There is also no way to push a batch of edits to
 * an already-published page: divergence is recorded per milestone, so this
 * surface names the milestones and stops — it must never offer a bulk update
 * that the server has no action for.
 */
export function SharePanel({
  workspaceSlug,
  projectName,
  publication,
  manageHref,
  canManage,
}: {
  workspaceSlug: string;
  projectName: string;
  publication: SharePublicationSummary | null;
  manageHref: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const settingsId = `${headingId}-settings`;
  const router = useRouter();

  const [publishState, publishAction, publishPending] = useActionState(
    publishAudiencePublicationAction,
    INITIAL,
  );
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateAudienceShareAction,
    INITIAL,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeAudienceShareAction,
    INITIAL,
  );
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(
    unpublishAudiencePublicationAction,
    INITIAL,
  );

  // The share actions revalidate the shared-timelines path, not this project
  // page, so without this refresh the panel would keep describing the state
  // the page was rendered with — the exact stale-truth failure this surface
  // exists to prevent.
  useEffect(() => {
    if (
      publishState.status === "success" ||
      rotateState.status === "success" ||
      revokeState.status === "success" ||
      unpublishState.status === "success"
    ) {
      router.refresh();
    }
  }, [publishState, rotateState, revokeState, unpublishState, router]);

  const linkLive =
    publication !== null &&
    publication.state === "published" &&
    publication.activeShareCount > 0;
  // "Links revoked" is a real, reachable condition that no column records:
  // published with every share killed. Name it rather than repeating
  // "published" at an owner whose link is dead.
  const effectiveState = publication
    ? linkLive
      ? "published"
      : publication.state === "published"
        ? "revoked"
        : publication.state
    : null;
  // A URL only exists in this session, in the reply from the action that just
  // minted it. Nothing on the server can produce one, because only the hash is
  // stored. Whichever action ran most recently is the one holding it.
  const mintedState =
    rotateState.shareUrl ? rotateState : publishState.shareUrl ? publishState : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Share
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy={headingId}
        width={560}
      >
        <div data-timeline-module className="max-h-[76vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id={headingId}
                className="text-lg font-semibold tracking-tight text-ink"
              >
                Share {projectName}
              </h2>
              {effectiveState ? (
                <p className="mt-1.5 flex items-center gap-2 text-xs font-medium text-ink-quiet">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: linkLive ? "var(--accent)" : "var(--ink-ghost)",
                    }}
                  />
                  {publicationStateLabel(effectiveState)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-ink-quiet hover:bg-bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="sr-only">Close</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {publication === null ? (
            <NothingPublished manageHref={manageHref} />
          ) : (
            <div className="mt-4 space-y-4">
              {/* First, and largest: the link, or the plain truth about why
                  there is not one to hand over. */}
              {mintedState ? (
                <ShareReceipt state={mintedState} />
              ) : (
                <div className="rounded-lg border border-line-soft bg-bg-deep p-4">
                  <p className="text-sm leading-6 text-ink">
                    {linkLive
                      ? publication.activeShareCount === 1
                        ? "One link is working. Anyone holding it can open this timeline. There is no sign-in, and it is not tied to a named person."
                        : `${publication.activeShareCount} links are working. Anyone holding one can open this timeline. There is no sign-in, and they are not tied to a named person.`
                      : publication.state === "published"
                        ? "Every link was switched off, so nobody can open this timeline. The page itself is still here."
                        : publication.state === "unpublished"
                          ? "This timeline is not published, and no link opens it."
                          : "This is a private draft. No link exists yet, and publishing makes one in the same step."}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {linkLive
                      ? "A link is shown once, when it is made. It is not kept here afterwards, so this page cannot show it to you again. If you no longer have it, make a new one below. Making a new one stops the old link working."
                      : "Making a link shows it to you once. Copy it then; this page cannot show it again."}
                  </p>
                  {canManage ? (
                    <div className="mt-3">
                      {publication.state === "published" ? (
                        <form action={rotateAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <button disabled={rotatePending} className={primaryButton}>
                            Make a new link
                          </button>
                        </form>
                      ) : (
                        <form action={publishAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <button disabled={publishPending} className={primaryButton}>
                            Publish and make the link
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              <ActionNotice state={publishState} />
              <ActionNotice state={rotateState} />
              <ActionNotice state={revokeState} />
              <ActionNotice state={unpublishState} />

              <Divergence titles={publication.divergedTitles} manageHref={manageHref} />

              {canManage ? (
                /* Demoted, not hidden. A disclosure was tried and measured
                   badly: a closed <details> inside a dialog that clips its own
                   overflow reports its contents as silently cut off at every
                   viewport, and a control an owner cannot see is not obviously
                   better than one they must scroll to. So the second group
                   keeps its own quiet heading below a rule, and the link
                   stays the thing the panel opens on. */
                <section aria-labelledby={settingsId} className="border-t border-line-soft pt-4">
                  <h3 id={settingsId} className="text-sm font-medium text-ink">
                    Link settings
                  </h3>
                  <div className="mt-3 space-y-3">
                    <form
                      action={publication.state === "published" ? rotateAction : publishAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                      <input type="hidden" name="publicationId" value={publication.id} />
                      <label className="text-xs font-medium text-ink-quiet">
                        Stop the link working after
                        <span className="font-normal"> (optional)</span>
                        <input className={`${fieldClass} mt-1 w-40`} type="date" name="expiresOn" />
                      </label>
                      <button
                        disabled={publication.state === "published" ? rotatePending : publishPending}
                        className={quietButton}
                      >
                        {publication.state === "published"
                          ? "Make a new link"
                          : "Publish and make the link"}
                      </button>
                    </form>
                    {publication.state === "published" ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={revokeAction}>
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <ArmedSubmitButton
                            label="Switch every link off"
                            armedLabel="Confirm: switch every link off"
                            disabled={revokePending}
                          />
                        </form>
                        <form action={unpublishAction}>
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <ArmedSubmitButton
                            label="Unpublish"
                            armedLabel="Confirm: unpublish and switch links off"
                            disabled={unpublishPending}
                          />
                        </form>
                      </div>
                    ) : null}
                    <p className="text-xs leading-5 text-ink-quiet">
                      A new link switches every earlier link off. Dates end at the
                      close of that day in {publication.timezone}.
                    </p>
                    <p className="text-sm">
                      <Link
                        href={manageHref}
                        className="font-medium text-ink underline decoration-line-soft underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Choose what the shared page shows
                      </Link>
                    </p>
                  </div>
                </section>
              ) : (
                <p className="border-t border-line-soft pt-4 text-sm leading-6 text-ink-soft">
                  Only the person who owns this workspace can change sharing.
                </p>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

function NothingPublished({ manageHref }: { manageHref: string }) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm leading-6 text-ink-soft">
        Nothing is published yet, so there is no link. Publishing copies the
        milestones you pick into a page of their own and makes the link in the
        same step. Your plan keeps moving afterwards; the copy stays where you
        left it.
      </p>
      <Link href={manageHref} className={primaryButton}>
        Pick what to publish
      </Link>
    </div>
  );
}

function Divergence({
  titles,
  manageHref,
}: {
  titles: readonly string[];
  manageHref: string;
}) {
  if (titles.length === 0) return null;
  return (
    <div className="rounded-lg border border-line-soft bg-bg-deep p-4">
      <p className="text-sm font-medium text-ink">
        {titles.length === 1
          ? "One milestone changed after it was copied"
          : `${titles.length} milestones changed after they were copied`}
      </p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-ink-soft">
        {titles.map((title) => (
          <li key={title}>
            {title} · the shared copy is unchanged.
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        Each shared copy is edited on its own.{" "}
        <Link
          href={manageHref}
          className="font-medium text-ink underline decoration-line-soft underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Open the shared copies
        </Link>
      </p>
    </div>
  );
}
