/** Build-time rollout switch. Only the literal true opts in; unset stays native. */
export function projectDriveUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI === "true";
}

export type DriveAccessPerson = Readonly<{
  name: string;
  email: string | null;
  access: "owner" | "writer" | "reader" | "unconfirmed";
}>;

/** Deliberately excludes tokens, session URLs, permission IDs and root folders. */
export type ProjectDriveStatus = Readonly<{
  ownerName: string | null;
  folderUrl: string | null;
  setup: "not_connected" | "active" | "setting_up" | "fallback" | "needs_attention" | "unavailable" | "archived";
  /** Requested named-permission removals, independent of live access or OAuth. */
  pendingRemovals: Readonly<{ currentFolder: number; previousFolders: number }>;
  ownConnection: Readonly<{
    connected: boolean;
    needsReconnect: boolean;
    accountEmail: string | null;
    affectedProjectCount: number;
  }>;
  access: Readonly<{
    state: "checked" | "unavailable" | "not_connected";
    checkedAt: string | null;
    people: readonly DriveAccessPerson[];
    otherPermissionCount: number;
  }>;
}>;

export type DriveStatusResult =
  | Readonly<{ kind: "ready"; status: ProjectDriveStatus }>
  | Readonly<{ kind: "unavailable" | "disabled" | "review" }>;

export function safeDriveFolderUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com" &&
      !url.username && !url.password && !url.port &&
      /^\/drive\/folders\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.search && !url.hash
      ? url.href : null;
  } catch { return null; }
}
