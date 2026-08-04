"use client";

import { useState } from "react";
import type { EntitlementTier } from "@/lib/data";
import type { MemberCapacity } from "@/server/db/membership";
import type { ThemeMode } from "@/server/db/preferences";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import { WorkspaceSection } from "./sections/workspace";
import { MembersSection } from "./sections/members";
import { BillingSection } from "./sections/billing";
import { NotificationsSection } from "./sections/notifications";
import { SecuritySection } from "./sections/security";
import { AppearanceSection } from "./sections/appearance";
import { StorageSection } from "./sections/storage";
import { PrivacySection } from "./sections/privacy";
import { DangerSection } from "./sections/danger";
import type { SecurityData } from "@/server/actions/security";

export type SettingsMember = {
  userId: string;
  role: "owner" | "member";
  joinedAt: string | null;
  name: string | null;
  email: string | null;
  handle: string | null;
  color: string | null;
  initials: string | null;
};

export type SettingsWorkspace = {
  id: string;
  slug: string;
  name: string;
  activeDomain: string | null;
  primaryUseCase: string | null;
  secondaryContext: string | null;
  /** T·124: the project currency label (null = USD default) and the
   *  operator budget in cents (null = unset). */
  currency: string | null;
  budgetCents: number | null;
  createdAt: string | null;
  ownerUserId: string | null;
  /** Phase 3 publishable workspaces. Null = private; ISO string =
   *  publicly available at `/p/{slug}` since that timestamp. */
  publishedAt: string | null;
};

type Tab =
  | "workspace"
  | "members"
  | "notifications"
  | "appearance"
  | "security"
  | "storage"
  | "billing"
  | "privacy"
  | "danger";

const TABS: Array<{ id: Tab; label: string; eyebrow: string }> = [
  { id: "workspace",     label: "Workspace",     eyebrow: "01" },
  { id: "members",       label: "Members",        eyebrow: "02" },
  { id: "notifications", label: "Notifications",  eyebrow: "03" },
  { id: "appearance",    label: "Appearance",     eyebrow: "04" },
  { id: "security",      label: "Security",       eyebrow: "05" },
  { id: "storage",       label: "Storage",        eyebrow: "06" },
  { id: "billing",       label: "Billing",        eyebrow: "07" },
  { id: "privacy",       label: "Privacy and data", eyebrow: "08" },
  { id: "danger",        label: "Danger zone",    eyebrow: "09" },
];

/**
 * Settings app shell. Sub-surfaces in a single client-rendered page;
 * tab state lives here so the URL stays clean and back/forward does
 * not fight the user. Each section is a thin client component that
 * wraps its own server actions.
 *
 * Why one page (not nine routes): each section's mutations affect
 * shared state (workspace name appears in chrome, member role gates
 * danger zone, tier gates billing copy), re-fetching across route
 * boundaries would either flicker or require a parent layout that
 * does the same work this page does. Tabbed-in-page is leaner.
 */
export function SettingsApp({
  currentUserId,
  currentUserEmail,
  myRole,
  workspace,
  members,
  tier,
  memberCapacity,
  notificationPrefs,
  pendingInvites,
  recentActivity,
  securityData,
  initialThemeMode,
  storageUsageBytes,
  initialPersonalityPrefs,
}: {
  currentUserId: string;
  currentUserEmail: string;
  myRole: "owner" | "member" | "none";
  workspace: SettingsWorkspace | null;
  members: SettingsMember[];
  tier: EntitlementTier;
  memberCapacity: MemberCapacity;
  notificationPrefs: {
    dailyDigest: boolean;
    mentions: boolean;
    commentReplies: boolean;
    nudges: boolean;
  };
  pendingInvites: Array<{
    token: string;
    email: string;
    role: "owner" | "member";
    createdAt: string;
    expiresAt: string;
    invitedByUserId: string;
  }>;
  recentActivity: Array<{
    id: string;
    sentence: string;
    relative: string;
    createdAt: string;
  }>;
  securityData: SecurityData;
  initialThemeMode: ThemeMode;
  storageUsageBytes: number;
  initialPersonalityPrefs: PersonalityPrefs;
}) {
  const [tab, setTab] = useState<Tab>("workspace");

  return (
    <div className="thin-scroll flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1080px] gap-10 px-8 py-10">
        {/* Side rail */}
        <nav
          aria-label="Settings sections"
          className="sticky top-0 hidden w-[180px] flex-shrink-0 self-start lg:block"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
            Settings
          </div>
          <ul className="mt-3 space-y-px">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const isDanger = t.id === "danger";
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={
                      "group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors " +
                      (isActive
                        ? isDanger
                          ? "bg-rose-50 text-rose-700"
                          : "bg-white text-ink shadow-sm ring-1 ring-line-soft"
                        : isDanger
                          ? "text-rose-600/80 hover:bg-rose-50/60 hover:text-rose-700"
                          : "text-ink-soft hover:bg-line-soft/60 hover:text-ink")
                    }
                  >
                    <span
                      className={
                        "font-mono text-[10.5px] tabular-nums " +
                        (isActive
                          ? isDanger
                            ? "text-rose-500"
                            : "text-brand"
                          : "text-ink-faint group-hover:text-ink-quiet")
                      }
                    >
                      {t.eyebrow}
                    </span>
                    <span className="flex-1">{t.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-lg border border-line-soft bg-bg-elevated p-3 text-[11.5px] leading-[1.55] text-ink-quiet">
            Changes save the moment you make them. No save button, we
            don&apos;t do save buttons here.
          </div>
        </nav>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Mobile-friendly horizontal tab strip; lg:hidden so the
              rail above is the only nav on wider screens. */}
          <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-full border border-line-soft bg-bg-sunken/70 p-0.5 lg:hidden">
            {TABS.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    "whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors " +
                    (isActive
                      ? t.id === "danger"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-white text-ink shadow-sm"
                      : t.id === "danger"
                        ? "text-rose-600/80"
                        : "text-ink-quiet hover:text-ink-soft")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "workspace" ? (
            <WorkspaceSection workspace={workspace} myRole={myRole} />
          ) : null}
          {tab === "members" ? (
            <MembersSection
              members={members}
              myRole={myRole}
              currentUserId={currentUserId}
              memberCapacity={memberCapacity}
              pendingInvites={pendingInvites}
              recentActivity={recentActivity}
            />
          ) : null}
          {tab === "notifications" ? (
            <NotificationsSection prefs={notificationPrefs} />
          ) : null}
          {tab === "appearance" ? (
            <AppearanceSection
              initialThemeMode={initialThemeMode}
              initialPersonalityPrefs={initialPersonalityPrefs}
            />
          ) : null}
          {tab === "security" ? (
            <SecuritySection data={securityData} />
          ) : null}
          {tab === "storage" ? (
            <StorageSection tier={tier} usageBytes={storageUsageBytes} />
          ) : null}
          {tab === "billing" ? (
            <BillingSection tier={tier} />
          ) : null}
          {tab === "privacy" ? (
            <PrivacySection userEmail={currentUserEmail} />
          ) : null}
          {tab === "danger" ? (
            <DangerSection
              myRole={myRole}
              workspaceName={workspace?.name ?? "this workspace"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Shared header component for each section. Exported so sections
 *  stay visually consistent. */
export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
        {eyebrow}
      </div>
      <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[13px] leading-[1.55] text-ink-soft">
        {description}
      </p>
    </header>
  );
}
