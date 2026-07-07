import { resolveUser, USERS, type UserId } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Avatar({
  user,
  name,
  size = 22,
  ring = false,
  className,
  tone = "color",
  active = false,
}: {
  user: UserId;
  /** Optional display name, passed when known from DB join (resolveUser).
   *  Omit in showcase/seeded contexts where USERS map is sufficient. */
  name?: string;
  size?: number;
  ring?: boolean;
  className?: string;
  /** "ink" renders neutral ink-tone initials on paper (marketing demo
   *  canon: ink / paper / one indigo). Default "color" keeps the
   *  per-user seed colors used across the app surfaces. */
  tone?: "color" | "ink";
  /** The single actively-working person carries the indigo. Only
   *  meaningful with tone="ink". */
  active?: boolean;
}) {
  // M1: use resolveUser so a real Clerk id with a known name gets proper
  // initials rather than "?" from the USERS proxy fallback.
  const u = name ? resolveUser(user, name) : USERS[user];
  const ink = tone === "ink" && !active;
  return (
    <span
      role="img"
      aria-label={u.name}
      title={u.name}
      className={cn(
        "inline-flex flex-shrink-0 select-none items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-tight",
        ink ? "text-ink-soft" : "text-white",
        ring && "ring-2 ring-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: active
          ? "var(--brand)"
          : ink
            ? "var(--bg-sunken)"
            : u.color,
        fontSize: Math.max(9, size * 0.42),
        boxShadow: ink
          ? "inset 0 0 0 1px var(--line)"
          : "inset 0 0 0 1px rgba(255,255,255,0.2)",
      }}
    >
      {u.initials}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 22,
  max = 4,
  tone = "color",
  activeUser = null,
}: {
  users: UserId[];
  size?: number;
  max?: number;
  tone?: "color" | "ink";
  activeUser?: UserId | null;
}) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <div
      className="flex items-center -space-x-0.5"
      role="group"
      aria-label={`Assignees: ${users.length}`}
    >
      {visible.map((u) => (
        <Avatar
          key={u}
          user={u}
          size={size}
          ring
          tone={tone}
          active={activeUser !== null && u === activeUser}
        />
      ))}
      {overflow > 0 ? (
        <span
          role="img"
          className="inline-flex items-center justify-center rounded-full bg-bg-sunken text-[10px] font-medium text-ink-soft ring-2 ring-white"
          style={{ width: size, height: size }}
          aria-label={`${overflow} more assignees`}
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
