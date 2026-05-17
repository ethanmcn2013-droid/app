"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  publishWorkspaceAction,
  unpublishWorkspaceAction,
  updateWorkspaceAction,
} from "@/server/actions/settings";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import { TASKS_DOMAIN } from "@/lib/product-urls";
import { SectionHeader } from "../settings-app";
import type { SettingsWorkspace } from "../settings-app";

const DOMAIN_IDS = new Set<DomainId>(DOMAIN_ORDER);

function isDomainId(s: string | null | undefined): s is DomainId {
  return !!s && DOMAIN_IDS.has(s as DomainId);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function WorkspaceSection({
  workspace,
  myRole,
}: {
  workspace: SettingsWorkspace | null;
  myRole: "owner" | "member" | "none";
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(workspace?.name ?? "");
  const [domainConfirm, setDomainConfirm] = useState<DomainId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = myRole === "owner";
  const currentDomain = workspace?.activeDomain;

  // Keep local input in sync if the workspace prop changes (e.g.
  // after a re-seed kicks off a server-side revalidate).
  useEffect(() => {
    setName(workspace?.name ?? "");
  }, [workspace?.name]);

  function commitName() {
    if (!workspace) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) return;
    startTransition(async () => {
      try {
        await updateWorkspaceAction({ name: trimmed });
        toast("Workspace renamed", { tone: "success" });
      } catch (e) {
        toast("Couldn't save", { tone: "error", body: (e as Error).message });
        setName(workspace.name);
      }
    });
  }

  function applyDomain(next: DomainId) {
    setDomainConfirm(null);
    startTransition(async () => {
      try {
        await updateWorkspaceAction({ domain: next });
        toast("Domain pack switched", {
          tone: "success",
          body: "Your tasks have been re-seeded.",
        });
      } catch (e) {
        toast("Switch failed", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  if (!workspace) {
    return (
      <div className="rounded-lg border border-line bg-bg-elevated p-6 text-[13px] text-ink-soft">
        No workspace loaded. Try refreshing.
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Workspace"
        title="The shape of your workspace"
        description="Rename it, swap the starter pack, or review your workspace details. Changes save instantly — no save button to forget."
      />

      <div className="space-y-4">
        {/* Name */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Name</Label>
          <Caption>What this workspace gets called everywhere — the header, share links, the daily digest.</Caption>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.blur();
                }
              }}
              onBlur={commitName}
              disabled={!canEdit || pending}
              className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-[13.5px] text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            />
            <span className="text-[11.5px] text-ink-quiet">
              {pending ? "Saving…" : canEdit ? "Tab or click out to save" : "Owner-only"}
            </span>
          </div>
        </div>

        {/* Domain pack */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Starter pack</Label>
          <Caption>
            Switching the pack wipes the workspace&apos;s tasks and re-seeds with the new flavor. Don&apos;t do this if you&apos;ve been working in here.
          </Caption>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DOMAIN_ORDER.map((id) => {
              const pack = DOMAINS[id];
              const isActive =
                isDomainId(currentDomain) && currentDomain === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!canEdit || pending || isActive}
                  onClick={() => setDomainConfirm(id)}
                  className={
                    "group rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed " +
                    (isActive
                      ? "border-brand/40 bg-brand-soft/60"
                      : canEdit
                        ? "border-line bg-white hover:border-ink-soft/30"
                        : "border-line-soft bg-bg-sunken/30 opacity-70")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">
                      {pack.label}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-brand">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] leading-[1.5] text-ink-quiet">
                    {pack.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Publish */}
        <PublishBlock
          workspace={workspace}
          canEdit={canEdit}
        />

        {/* Metadata */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Identity</Label>
          <Caption>For the record. None of this is editable.</Caption>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <Meta label="Workspace ID" value={workspace.id} mono />
            <Meta label="URL slug" value={workspace.slug} mono />
            <Meta label="Created" value={fmtDate(workspace.createdAt)} />
          </dl>
        </div>
      </div>

      <Dialog
        open={domainConfirm !== null}
        onClose={() => setDomainConfirm(null)}
        labelledBy="domain-confirm-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Heads up
          </div>
          <h3
            id="domain-confirm-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Re-seed with the {domainConfirm ? DOMAINS[domainConfirm].label : ""} pack?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            This wipes every task, comment, and activity in this workspace
            and re-seeds it with the new starter pack. Members and billing
            are untouched.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDomainConfirm(null)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Keep what I have
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => domainConfirm && applyDomain(domainConfirm)}
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-60"
            >
              {pending ? "Re-seeding…" : "Re-seed it"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function PublishBlock({
  workspace,
  canEdit,
}: {
  workspace: SettingsWorkspace;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const isPublished = workspace.publishedAt !== null;

  function publish() {
    startTransition(async () => {
      try {
        await publishWorkspaceAction();
        toast("Workspace published", {
          tone: "success",
          body: "Anyone with the link can read the workspace.",
        });
      } catch (e) {
        toast("Couldn't publish", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function unpublish() {
    startTransition(async () => {
      try {
        await unpublishWorkspaceAction();
        toast("Workspace unpublished", {
          tone: "info",
          body: "The public link returns 404 again.",
        });
      } catch (e) {
        toast("Couldn't unpublish", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${workspace.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy", { tone: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
      <Label>Publish to the web</Label>
      <Caption>
        Publishing makes a read-only version of this workspace visible
        at <code className="rounded bg-bg-sunken/80 px-1 py-0.5 text-[11.5px]">{TASKS_DOMAIN}/p/{workspace.slug}</code>.
        Anyone with the link can see your tasks and lanes — no signup,
        no account. Looks like a real website, not the app.
      </Caption>

      {isPublished ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <span
              className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className="text-[12px] font-medium text-emerald-800">
              Published {fmtDate(workspace.publishedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-line bg-white px-3 py-1.5 font-mono text-[12px] text-ink">
              /p/{workspace.slug}
            </code>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                disabled={pending}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={`/p/${workspace.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
              >
                Open
              </a>
              <button
                type="button"
                onClick={unpublish}
                disabled={!canEdit || pending}
                className="rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
              >
                {pending ? "…" : "Unpublish"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-ink-quiet">
            This workspace is private. Only members can see it.
          </span>
          <button
            type="button"
            onClick={publish}
            disabled={!canEdit || pending}
            className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-50"
          >
            {pending ? "Publishing…" : "Publish workspace"}
          </button>
        </div>
      )}

      {!canEdit ? (
        <p className="mt-3 text-[11.5px] text-ink-quiet">
          Only the owner can publish or unpublish.
        </p>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 max-w-[520px] text-[12.5px] leading-[1.55] text-ink-soft">
      {children}
    </p>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </dt>
      <dd
        className={
          "text-[12.5px] text-ink " +
          (mono ? "break-all font-mono" : "tabular-nums")
        }
      >
        {value}
      </dd>
    </div>
  );
}
