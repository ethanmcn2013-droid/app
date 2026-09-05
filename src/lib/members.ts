/**
 * Minimal member identity for client surfaces: the assign menu, avatar
 * stacks, and (later) owner-by-name filtering. Resolved server-side from
 * workspace_members ⋈ users by `getWorkspaceMemberMeta` and handed to the
 * client through DomainProvider — client code never queries membership.
 */
export type WorkspaceMemberMeta = {
  /** users.id — the value stored in tasks.assignees. */
  id: string;
  name: string;
  /** Known profile name, or null when `name` is a neutral display fallback. */
  knownName: string | null;
  initials: string;
  /** CSS color value for the avatar chip. */
  color: string;
  role: "owner" | "member";
};
