import { USERS, type UserId } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Avatar({
  user,
  size = 22,
  ring = false,
  className,
}: {
  user: UserId;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const u = USERS[user];
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 select-none items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-tight text-white",
        ring && "ring-2 ring-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: u.color,
        fontSize: Math.max(9, size * 0.42),
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
      }}
      aria-label={u.name}
      title={u.name}
    >
      {u.initials}
    </span>
  );
}

export function AvatarStack({
  users,
  size = 22,
  max = 4,
}: {
  users: UserId[];
  size?: number;
  max?: number;
}) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <Avatar key={u} user={u} size={size} ring />
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full bg-bg-sunken text-[10px] font-medium text-ink-soft ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
