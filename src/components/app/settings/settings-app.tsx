"use client";

import { useRef, useState, type ReactNode } from "react";
import type { EntitlementTier } from "@/lib/data";
import type { MemberCapacity } from "@/server/db/membership";
import type { ThemeMode } from "@/server/db/preferences";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import { CONTEXT_TERMINOLOGY } from "@/lib/planning/context";
import { WorkspaceSection } from "./sections/workspace";
import { MembersSection } from "./sections/members";
import { BillingSection } from "./sections/billing";
import { NotificationsSection } from "./sections/notifications";
import { SecuritySection } from "./sections/security";
import { AppearanceSection } from "./sections/appearance";
import { StorageSection } from "./sections/storage";
import { ConnectionsSection } from "./sections/connections";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import { isDemoMode } from "@/lib/access-mode";
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

type NavItem = { id: Tab; label: string; icon: ReactNode };

// ── Nav icons: 16px, 1.5 stroke, the shell's line family ─────────────

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  general: (
    <Glyph>
      <path d="M2 4.75A1.25 1.25 0 0 1 3.25 3.5h2.7l1.4 1.5h5.4A1.25 1.25 0 0 1 14 6.25v5.5A1.25 1.25 0 0 1 12.75 13h-9.5A1.25 1.25 0 0 1 2 11.75Z" />
    </Glyph>
  ),
  members: (
    <Glyph>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M1.75 13c.45-2.15 2.1-3.5 4.25-3.5s3.8 1.35 4.25 3.5" />
      <path d="M10.6 3.4a2.25 2.25 0 0 1 0 4.2M11.9 9.75c1.2.45 2 1.6 2.35 3.25" />
    </Glyph>
  ),
  storage: (
    <Glyph>
      <ellipse cx="8" cy="4" rx="5.25" ry="1.75" />
      <path d="M2.75 4v8c0 .97 2.35 1.75 5.25 1.75s5.25-.78 5.25-1.75V4" />
      <path d="M2.75 8c0 .97 2.35 1.75 5.25 1.75S13.25 8.97 13.25 8" />
    </Glyph>
  ),
  connections: (
    <Glyph>
      <path d="M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2-2a2.5 2.5 0 0 0-3.54-3.54l-.5.5" />
      <path d="M9.25 6.75a2.5 2.5 0 0 0-3.54 0l-2 2a2.5 2.5 0 0 0 3.54 3.54l.5-.5" />
    </Glyph>
  ),
  danger: (
    <Glyph>
      <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.4 9.5a1 1 0 0 1-.87 1.5H2.6a1 1 0 0 1-.87-1.5Z" />
      <path d="M8 6.25v2.75M8 11.1v.01" />
    </Glyph>
  ),
  notifications: (
    <Glyph>
      <path d="M4 11.5V7.25a4 4 0 0 1 8 0v4.25l1 1H3Z" />
      <path d="M6.75 13.75a1.4 1.4 0 0 0 2.5 0" />
    </Glyph>
  ),
  appearance: (
    <Glyph>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 2.25a5.75 5.75 0 0 1 0 11.5Z" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  security: (
    <Glyph>
      <path d="M8 1.75 13 3.5v4c0 3.1-2.1 5.5-5 6.75-2.9-1.25-5-3.65-5-6.75v-4Z" />
      <path d="m5.9 8 1.45 1.45L10.2 6.6" />
    </Glyph>
  ),
  billing: (
    <Glyph>
      <rect x="1.75" y="3.5" width="12.5" height="9" rx="1.5" />
      <path d="M1.75 6.5h12.5M4.5 10h2" />
    </Glyph>
  ),
  privacy: (
    <Glyph>
      <path d="M9 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5.5Z" />
      <path d="M9 1.75V5.5h3.75" />
      <path d="M8 7.5v4M6.25 9.75 8 11.5l1.75-1.75" />
    </Glyph>
  ),
} as const;

/**
 * Two groups, because the page holds two kinds of setting: things that belong
 * to this Project (shared with everyone in it) and things that belong to you
 * (the same in every Project). The group label is the user-facing noun from
 * the one translation point, never a literal.
 */
function navGroups(driveEnabled: boolean): Array<{ label: string; items: NavItem[] }> {
  return [
    {
      label: CONTEXT_TERMINOLOGY.general.workspace,
      items: [
        { id: "workspace", label: "General", icon: ICONS.general },
        { id: "members", label: "Members", icon: ICONS.members },
        driveEnabled
          ? { id: "storage", label: "Connections", icon: ICONS.connections }
          : { id: "storage", label: "Storage", icon: ICONS.storage },
        { id: "danger", label: "Danger zone", icon: ICONS.danger },
      ],
    },
    {
      label: "Account",
      items: [
        { id: "notifications", label: "Notifications", icon: ICONS.notifications },
        { id: "appearance", label: "Appearance", icon: ICONS.appearance },
        { id: "security", label: "Security", icon: ICONS.security },
        { id: "billing", label: "Billing", icon: ICONS.billing },
        { id: "privacy", label: "Privacy and data", icon: ICONS.privacy },
      ],
    },
  ];
}

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
 *
 * v3 layout: the nav and the content share the page header's 1180px column
 * and left edge. The nav is a sticky rail from `lg`, and a sticky row of
 * scrollable tabs below it.
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
  readOnly = false,
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
    lastSentAt: number | null;
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
  /**
   * Review/demo mode: the sections are for looking at, not for writing to.
   * The inert boundary lives HERE, around the section content only, because
   * when the page put it around the whole app the nine-item navigation died
   * with the forms — eight sections unreachable behind controls that still
   * looked clickable, and the new theme control along with them. Navigation
   * is not a mutation; it stays alive in every mode.
   */
  readOnly?: boolean;
}) {
  const driveEnabled = projectDriveUiEnabled();
  const [tab, setTab] = useState<Tab>(driveEnabled && isDemoMode() ? "storage" : "workspace");
  const interactiveDriveReview = readOnly && isDemoMode() && tab === "storage" && driveEnabled;
  const sectionReadOnly = readOnly && !interactiveDriveReview;
  const groups = navGroups(driveEnabled);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  function selectTab(next: Tab, trigger?: HTMLElement) {
    setTab(next);
    // A new section starts at its own top, not wherever the last one was
    // scrolled to. Only scroll back when the reader is already below it.
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (scroller && content) {
      const contentTop = content.offsetTop - 24;
      if (scroller.scrollTop > contentTop) scroller.scrollTo({ top: Math.max(0, contentTop) });
    }
    // Keep the chosen tab in view in the narrow, scrolling tab row.
    trigger?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div ref={scrollRef} className="thin-scroll flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[1180px] px-4 md:px-8 lg:flex lg:items-start lg:gap-[56px]">
        {/* Rail, from lg */}
        <nav
          aria-label="Settings sections"
          className="sticky top-0 hidden w-[212px] shrink-0 self-start pb-8 pt-6 lg:block"
        >
          {groups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-6" : undefined}>
              <p className="px-2.5 pb-1.5 text-[12px] font-medium text-[color:var(--v3-text-3)]">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <RailItem
                      item={item}
                      active={tab === item.id}
                      onSelect={(el) => selectTab(item.id, el)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!readOnly ? (
            <div className="mt-6 px-2.5">
              <SaveNote />
            </div>
          ) : null}
        </nav>

        {/* Tabs, below lg */}
        <nav
          aria-label="Settings sections"
          className="sticky top-0 z-10 -mx-4 border-b border-[color:var(--v3-border)] bg-[color-mix(in_srgb,var(--v3-canvas)_92%,transparent)] backdrop-blur-md md:-mx-8 lg:hidden"
        >
          <div className="thin-scroll flex items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
            {groups.map((group, gi) => (
              <div key={group.label} className="flex shrink-0 items-center gap-1">
                {gi > 0 ? (
                  <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-[var(--v3-border-strong)]" />
                ) : null}
                {group.items.map((item) => (
                  <TabItem
                    key={item.id}
                    item={item}
                    active={tab === item.id}
                    onSelect={(el) => selectTab(item.id, el)}
                  />
                ))}
              </div>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div ref={contentRef} className="min-w-0 flex-1 pb-20 pt-6 lg:max-w-[760px]">
          {!readOnly ? (
            <div className="mb-5 lg:hidden">
              <SaveNote />
            </div>
          ) : null}
          <div inert={sectionReadOnly || undefined} aria-disabled={sectionReadOnly || undefined}>
          {/* Keyed so each section arrives with the suite rise, motion-safe only. */}
          <div key={tab} className="motion-safe:animate-[suite-content-arrive_240ms_var(--v3-ease)_both]">
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
              projectId={workspace?.id ?? null}
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
            <div className="space-y-[48px]">
              {driveEnabled ? <ConnectionsSection projectId={workspace?.id ?? null} canManage={myRole === "owner"} /> : null}
              <StorageSection tier={tier} usageBytes={storageUsageBytes} driveEnabled={driveEnabled} />
            </div>
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
              workspaceName={workspace?.name ?? "this project"}
              projectId={workspace?.id ?? null}
            />
          ) : null}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailItem({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (el: HTMLElement) => void;
}) {
  const danger = item.id === "danger";
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={(event) => onSelect(event.currentTarget)}
      className={
        "flex h-[32px] w-full items-center gap-2.5 rounded-[var(--v3-radius)] border px-2.5 text-left text-[13.5px] font-medium transition-[background-color,color,border-color] duration-150 focus-visible:rounded-[var(--v3-radius)]! " +
        (active
          ? "border-[color:var(--v3-border)] bg-[var(--v3-selected)] shadow-[var(--v3-shadow-1)] " +
            (danger ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text)]")
          : "border-transparent hover:bg-[var(--v3-hover)] " +
            (danger
              ? "text-[color:var(--v3-danger)]"
              : "text-[color:var(--v3-text-2)] hover:text-[color:var(--v3-text)]"))
      }
    >
      <span
        className={
          danger
            ? "text-[color:var(--v3-danger)]"
            : active
              ? "text-[color:var(--v3-text)]"
              : "text-[color:var(--v3-text-3)]"
        }
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  );
}

function TabItem({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (el: HTMLElement) => void;
}) {
  const danger = item.id === "danger";
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={(event) => onSelect(event.currentTarget)}
      className={
        "inline-flex h-[32px] shrink-0 items-center whitespace-nowrap rounded-[var(--v3-radius)] border px-3 text-[13px] font-medium transition-[background-color,color,border-color] duration-150 focus-visible:rounded-[var(--v3-radius)]! pointer-coarse:h-[40px] " +
        (active
          ? "border-[color:var(--v3-border)] bg-[var(--v3-selected)] shadow-[var(--v3-shadow-1)] " +
            (danger ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text)]")
          : "border-transparent hover:bg-[var(--v3-hover)] " +
            (danger ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text-2)]"))
      }
    >
      {item.label}
    </button>
  );
}

/** The no-save-button promise, said once, quietly. */
function SaveNote() {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-[color:var(--v3-text-3)]">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className="mt-px shrink-0"
      >
        <circle cx="8" cy="8" r="5.5" />
        <path d="m5.75 8.1 1.6 1.6 2.9-3.2" />
      </svg>
      Changes save the moment you make them.
    </p>
  );
}

/** Shared header for each section: a sentence-case title and one plain
 *  line. Exported so sections stay visually consistent. Self-contained on
 *  purpose (no imports): the Drive acceptance harness compiles it alone. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 [&+section]:mt-0">
      <div className="min-w-0 max-w-[620px]">
        <h2 className="text-[18px] font-semibold leading-7 tracking-[-0.015em] text-[color:var(--v3-text)]">
          {title}
        </h2>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-[color:var(--v3-text-2)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
