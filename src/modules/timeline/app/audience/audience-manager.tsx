"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  connectSuiteWorkspaceAction,
  createAudiencePublicationAction,
  publishAudiencePublicationAction,
  refreshAudienceDivergenceAction,
  revokeAudienceShareAction,
  rotateAudienceShareAction,
  unpublishAudiencePublicationAction,
  updateAudiencePublicationItemAction,
  type AudienceActionState,
} from "@/modules/timeline/server/actions/audience-timeline";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";

const INITIAL: AudienceActionState = { status: "idle" };
const fieldClass =
  "min-h-10 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const quietButton =
  "min-h-10 rounded-lg border border-line-soft bg-white px-3 text-sm font-medium text-ink-soft hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
const primaryButton =
  "min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

type SourceNode = Readonly<{
  id: string;
  title: string;
  targetDate: string | null;
  lane: string;
}>;

function ActionNotice({ state }: { state: AudienceActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role="status"
      className="mt-3 text-sm leading-6"
      style={{ color: state.status === "error" ? "var(--status-waiting, var(--ink))" : "var(--ink-soft)" }}
    >
      {state.message}
    </p>
  );
}

function ShareReceipt({ state }: { state: AudienceActionState }) {
  const [copied, setCopied] = useState(false);
  if (!state.shareUrl) return null;
  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
        One-time share link
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="New Audience Timeline share link"
          readOnly
          value={state.shareUrl}
          className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className={quietButton}
          onClick={async () => {
            await navigator.clipboard.writeText(state.shareUrl!);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-indigo-800">
        Only a protected fingerprint is stored. If this receipt is lost, rotate the link.
      </p>
    </div>
  );
}

export function AudienceManager({
  workspaceSlug,
  suiteWorkspaceId,
  enabled,
  sourceNodes,
  publications,
  defaultLabel,
  projectName,
}: {
  workspaceSlug: string;
  suiteWorkspaceId: string | null;
  enabled: boolean;
  sourceNodes: readonly SourceNode[];
  publications: readonly AudienceOwnerPublication[];
  defaultLabel?: string;
  projectName?: string;
}) {
  const [connectState, connectAction, connectPending] = useActionState(
    connectSuiteWorkspaceAction,
    INITIAL,
  );
  const [createState, createAction, createPending] = useActionState(
    createAudiencePublicationAction,
    INITIAL,
  );
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
  const [updateState, updateAction, updatePending] = useActionState(
    updateAudiencePublicationItemAction,
    INITIAL,
  );
  const [divergenceState, divergenceAction, divergencePending] = useActionState(
    refreshAudienceDivergenceAction,
    INITIAL,
  );

  return (
    <div className="space-y-10">
      {!suiteWorkspaceId ? (
        <section className="rounded-xl border border-line-soft bg-white p-5" aria-labelledby="connect-heading">
          <h2 id="connect-heading" className="text-lg font-semibold tracking-tight text-ink">
            Connect the canonical workspace
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
            Use the immutable Signal Tasks workspace ID. Labels and slugs are never used as a suite join key.
          </p>
          <form action={connectAction} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <label className="flex-1">
              <span className="sr-only">Signal Tasks workspace ID</span>
              <input
                name="suiteWorkspaceId"
                required
                maxLength={120}
                autoComplete="off"
                className={fieldClass}
                placeholder="Signal Tasks workspace ID"
              />
            </label>
            <button disabled={connectPending} className={primaryButton}>
              Connect
            </button>
          </form>
          <ActionNotice state={connectState} />
        </section>
      ) : (
        <p className="text-sm text-ink-soft">
          Canonical workspace <code className="rounded bg-bg-deep px-1.5 py-0.5 text-xs">{suiteWorkspaceId}</code>
        </p>
      )}

      {!enabled ? (
        <div className="rounded-xl border border-line-soft bg-bg-deep p-5">
          <p className="text-sm font-medium text-ink">New Audience Timelines are paused.</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Existing links and their revoke, rotate, and unpublish controls remain available.
          </p>
        </div>
      ) : suiteWorkspaceId ? (
        <section aria-labelledby="new-audience-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">Frozen projection</p>
            <h2 id="new-audience-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {projectName ? `Publish ${projectName}` : "Create a shared timeline"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Choose the exact milestone labels, dates, and completion states to copy. Notes, people, attachments, and source IDs never appear to viewers.
            </p>
          </div>
          <form action={createAction} className="mt-5 rounded-xl border border-line-soft bg-white p-5">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-ink-soft">
                Timeline title
                <input
                  className={`${fieldClass} mt-1.5`}
                  name="label"
                  required
                  maxLength={120}
                  placeholder="Project timeline"
                  defaultValue={defaultLabel}
                />
              </label>
              <label className="text-sm font-medium text-ink-soft">
                Named audience
                <select className={`${fieldClass} mt-1.5`} name="audienceKind" defaultValue="class">
                  <option value="class">Class</option>
                  <option value="module">Module</option>
                  <option value="couple">Couple</option>
                </select>
              </label>
              <label className="text-sm font-medium text-ink-soft">
                Owner display label <span className="font-normal text-ink-quiet">(optional)</span>
                <input className={`${fieldClass} mt-1.5`} name="ownerDisplayLabel" maxLength={80} placeholder="Shared by Dr Byrne" />
              </label>
              <div className="grid grid-cols-[1fr_9rem] gap-2">
                <label className="text-sm font-medium text-ink-soft">
                  Primary date label
                  <input className={`${fieldClass} mt-1.5`} name="primaryDateLabel" maxLength={40} placeholder="Exam" />
                </label>
                <label className="text-sm font-medium text-ink-soft">
                  Date
                  <input className={`${fieldClass} mt-1.5`} type="date" name="primaryDate" />
                </label>
              </div>
              <label className="text-sm font-medium text-ink-soft">
                Calendar timezone
                <select className={`${fieldClass} mt-1.5`} name="timezone" defaultValue="Europe/Dublin">
                  <option value="Europe/Dublin">Europe/Dublin</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-ink">Fields to copy</legend>
              <div className="mt-2 divide-y divide-line-soft rounded-lg border border-line-soft">
                {sourceNodes.length === 0 ? (
                  <p className="p-4 text-sm text-ink-quiet">Add visible milestones to the plan first.</p>
                ) : (
                  sourceNodes.map((node) => (
                    <label key={node.id} className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-bg-deep">
                      <input
                        type="checkbox"
                        name="sourceId"
                        value={node.id}
                        defaultChecked={Boolean(projectName)}
                        className="h-4 w-4 rounded border-line-soft accent-indigo-600"
                      />
                      <span className="min-w-0 flex-1 text-sm text-ink">{node.title}</span>
                      <span className="text-xs tabular-nums text-ink-quiet">{node.targetDate ?? node.lane}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <button disabled={createPending || sourceNodes.length === 0} className={`${primaryButton} mt-4`}>
              Create private preview
            </button>
            <ActionNotice state={createState} />
          </form>
        </section>
      ) : null}

      <section aria-labelledby="audience-publications-heading">
        <h2 id="audience-publications-heading" className="text-2xl font-semibold tracking-tight text-ink">
          Previews and links
        </h2>
        {publications.length === 0 ? (
          <p className="mt-3 text-sm text-ink-quiet">No Audience Timeline drafts yet.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {publications.map((publication) => (
              <article key={publication.id} className="overflow-hidden rounded-xl border border-line-soft bg-white">
                <header className="border-b border-line-soft p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                        {publication.audienceKind} · {publication.state}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">{publication.label}</h3>
                      <p className="mt-1 text-xs text-ink-quiet">
                        {publication.items.length} shared milestone{publication.items.length === 1 ? "" : "s"} · {publication.activeShareCount} active link{publication.activeShareCount === 1 ? "" : "s"} · {publication.qualifiedViewCount.toLocaleString("en-GB")} view{publication.qualifiedViewCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/app/timeline/audience/${encodeURIComponent(publication.id)}`}
                        className={primaryButton}
                      >
                        View artifact studio
                      </Link>
                      <form action={divergenceAction}>
                        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <button disabled={divergencePending} className={quietButton}>Check source changes</button>
                      </form>
                    </div>
                  </div>
                  {divergenceState.publicationId === publication.id ? <ActionNotice state={divergenceState} /> : null}
                </header>

                <div className="p-5">
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                    {publication.ownerDisplayLabel ? <span>{publication.ownerDisplayLabel}</span> : null}
                    {publication.primaryDate && publication.primaryDateLabel ? (
                      <span>{publication.primaryDateLabel}: <time dateTime={publication.primaryDate}>{publication.primaryDate}</time></span>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {publication.items.map((item) => (
                      <form key={item.publicId} action={updateAction} className="grid gap-2 rounded-lg border border-line-soft p-3 sm:grid-cols-[1fr_10rem_8rem_auto] sm:items-end">
                        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <input type="hidden" name="publicId" value={item.publicId} />
                        <label className="text-xs font-medium text-ink-quiet">
                          Shared title
                          <input className={`${fieldClass} mt-1`} name="title" required maxLength={180} defaultValue={item.title} />
                        </label>
                        <label className="text-xs font-medium text-ink-quiet">
                          Calendar date
                          <input className={`${fieldClass} mt-1`} type="date" name="calendarDate" defaultValue={item.calendarDate ?? ""} />
                        </label>
                        <label className="text-xs font-medium text-ink-quiet">
                          Shared state
                          <select className={`${fieldClass} mt-1`} name="state" defaultValue={item.state}>
                            <option value="covered">Covered</option>
                            <option value="now">Now</option>
                            <option value="next">Next</option>
                            <option value="later">Later</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </label>
                        <button disabled={updatePending} className={quietButton}>Save public copy</button>
                        {item.divergedAt ? (
                          <p className="text-xs text-ink-quiet sm:col-span-4">
                            The source changed after copying. This shared milestone stayed frozen.
                          </p>
                        ) : null}
                      </form>
                    ))}
                  </div>
                  {updateState.publicationId === publication.id ? <ActionNotice state={updateState} /> : null}

                  <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line-soft pt-5">
                    {publication.state !== "published" ? (
                      <form action={publishAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                        <input type="hidden" name="publicationId" value={publication.id} />
                        <label className="text-xs font-medium text-ink-quiet">
                          Link expiry <span className="font-normal">(optional)</span>
                          <input className={`${fieldClass} mt-1 w-40`} type="date" name="expiresOn" />
                        </label>
                        <button disabled={publishPending} className={primaryButton}>Publish and create link</button>
                      </form>
                    ) : (
                      <>
                        <form action={rotateAction} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <label className="text-xs font-medium text-ink-quiet">
                            New expiry <span className="font-normal">(optional)</span>
                            <input className={`${fieldClass} mt-1 w-40`} type="date" name="expiresOn" />
                          </label>
                          <button disabled={rotatePending} className={quietButton}>Rotate link</button>
                        </form>
                        <form action={revokeAction}>
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <button disabled={revokePending} className={quietButton}>Revoke links</button>
                        </form>
                        <form action={unpublishAction}>
                          <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                          <input type="hidden" name="publicationId" value={publication.id} />
                          <button disabled={unpublishPending} className={quietButton}>Unpublish</button>
                        </form>
                      </>
                    )}
                  </div>
                  {publishState.publicationId === publication.id ? (
                    <><ActionNotice state={publishState} /><ShareReceipt state={publishState} /></>
                  ) : null}
                  {rotateState.publicationId === publication.id ? (
                    <><ActionNotice state={rotateState} /><ShareReceipt state={rotateState} /></>
                  ) : null}
                  {revokeState.publicationId === publication.id ? <ActionNotice state={revokeState} /> : null}
                  {unpublishState.publicationId === publication.id ? <ActionNotice state={unpublishState} /> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
