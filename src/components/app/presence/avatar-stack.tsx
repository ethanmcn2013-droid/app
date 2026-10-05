/**
 * AvatarStack: who is here, as a compact row of overlapping faces.
 *
 * Shared by Messages (conversation header, thread summaries) and the Tasks
 * board header. It renders people and nothing else: it never loads members,
 * never decides who may see what, and shows an online dot only when the
 * caller passes `online` (no presence data means no dot, never a guess).
 *
 * Usage
 *
 *   import { AvatarStack, type PresenceMember } from "@/components/app/presence/avatar-stack";
 *
 *   const members: PresenceMember[] = [
 *     { id: "u1", name: "Niamh Kelly", online: true },
 *     { id: "u2", name: "Dara Quinn", avatarUrl: "https://…" },
 *     { id: "u3", name: "Aoife Walsh", initials: "AW", colour: "#14b8a6" },
 *   ];
 *
 *   <AvatarStack members={members} />                       // static, md, 3 faces then +N
 *   <AvatarStack members={members} size="sm" max={4} />     // denser rows
 *   <AvatarStack members={members} showCount onClick={openMembers} pressed={open} />
 *
 * Props
 * - members   People in order of importance. `initials` falls back to the
 *             name; `colour` overrides the token tone (identity data, e.g. a
 *             project hue); `avatarUrl` shows a photo; `online` adds a dot.
 * - max       Faces before the "+N" chip (default 3). The chip names the rest.
 * - size      "sm" (22px) or "md" (26px, default).
 * - label     Accessible name for the group. Defaults to "Members: A, B and 2 more".
 * - showCount Trailing total, for a header ("5").
 * - onClick / pressed  Render as a toggle button (e.g. open a members panel).
 *
 * Accessibility: the stack is one labelled element. Each face carries a
 * `title` tooltip; faces are decorative to assistive tech, the label speaks.
 * Colours come from v3 tokens and pass AA for initials in light and dark.
 */

import styles from "./avatar-stack.module.css";

export type PresenceMember = Readonly<{
  id: string;
  name: string;
  initials?: string;
  /** An identity colour, e.g. a project hue. Omit to use a token tone. */
  colour?: string;
  avatarUrl?: string | null;
  /** Only when real presence data exists. */
  online?: boolean;
}>;

export type AvatarStackProps = Readonly<{
  members: readonly PresenceMember[];
  max?: number;
  size?: "sm" | "md";
  label?: string;
  showCount?: boolean;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
}>;

export function presenceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Stable identity tone from the id: six token-derived hues, never status. */
export function presenceTone(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % 6;
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Members: Orla, Niamh Kelly and 3 more" */
export function presenceLabel(members: readonly PresenceMember[], max = 3): string {
  if (!members.length) return "No members";
  const shown = members.slice(0, max).map((member) => `${member.name}${member.online ? " (online)" : ""}`);
  const rest = members.length - shown.length;
  return `Members: ${listNames(rest > 0 ? [...shown, `${rest} more`] : shown)}`;
}

export function PresenceAvatar({ member, size = "md" }: { member: PresenceMember; size?: "sm" | "md" }) {
  return <span
    aria-hidden="true"
    className={styles.face}
    data-size={size}
    data-tone={member.colour ? undefined : presenceTone(member.id)}
    style={member.colour ? ({ "--tone": member.colour } as React.CSSProperties) : undefined}
    title={`${member.name}${member.online ? " · online" : ""}`}
  >
    {member.avatarUrl
      // Decorative; the stack's label names everyone. Remote hosts vary, so a plain img.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img alt="" className={styles.photo} src={member.avatarUrl} />
      : member.initials ?? presenceInitials(member.name)}
    {member.online ? <span className={styles.online} /> : null}
  </span>;
}

export function AvatarStack({ members, max = 3, size = "md", label, showCount, onClick, pressed, className }: AvatarStackProps) {
  const visible = members.slice(0, Math.max(1, max));
  const rest = members.length - visible.length;
  const name = label ?? presenceLabel(members, max);
  const hidden = members.slice(visible.length).map((member) => member.name).join(", ");
  const content = <>
    <span className={styles.faces}>
      {visible.map((member) => <PresenceAvatar key={member.id} member={member} size={size} />)}
      {rest > 0 ? <span aria-hidden="true" className={styles.more} data-size={size} title={hidden}>+{rest}</span> : null}
    </span>
    {showCount ? <span aria-hidden="true" className={styles.count}>{members.length}</span> : null}
  </>;
  const classes = [styles.stack, onClick ? styles.button : "", className ?? ""].filter(Boolean).join(" ");
  if (onClick) return <button aria-label={name} aria-pressed={pressed} className={classes} data-size={size} onClick={onClick} type="button">{content}</button>;
  return <span aria-label={name} className={classes} data-size={size} role="img">{content}</span>;
}
