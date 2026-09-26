import type { CSSProperties } from "react";
import { Icon } from "./icons";
import { PEOPLE, statusWord, type FileKind, type Health, type PersonId, type Project } from "./data";
import s from "./map.module.css";

export function Avatar({ id, size = 20, ring = true }: { id: PersonId; size?: number; ring?: boolean }) {
  const p = PEOPLE[id];
  return (
    <span
      className={s.avatar}
      data-ring={ring ? "" : undefined}
      style={{ "--av": p.color, width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.44)) } as CSSProperties}
      title={p.name}
      aria-hidden="true"
    >
      {p.initials}
    </span>
  );
}

export function AvatarStack({ ids, size = 18 }: { ids: PersonId[]; size?: number }) {
  return (
    <span className={s.avatarStack}>
      {ids.map((id) => (
        <Avatar key={id} id={id} size={size} />
      ))}
    </span>
  );
}

/**
 * The project glyph: size is open work, the wedge is progress. Colour carries
 * one meaning per view, chosen by the caller: how it is going (a neutral ring
 * with a health-coloured wedge) or who owns it (ring and wedge in the owner's
 * colour).
 */
export function NodeGlyph({
  p,
  r,
  ring,
  fill,
  muted,
}: {
  p: Project;
  r: number;
  ring: string;
  fill: string;
  muted?: boolean;
}) {
  const size = r * 2;
  const c = r;
  const inner = r - 4;
  const frac = Math.max(0, Math.min(1, p.progress / 100));
  const angle = frac * Math.PI * 2;
  const ex = c + inner * Math.sin(angle);
  const ey = c - inner * Math.cos(angle);
  const large = angle > Math.PI ? 1 : 0;
  const wedge =
    frac >= 0.999
      ? null
      : frac <= 0.001
        ? null
        : `M ${c} ${c} L ${c} ${c - inner} A ${inner} ${inner} 0 ${large} 1 ${ex} ${ey} Z`;
  return (
    <svg className={s.glyph} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" data-muted={muted ? "" : undefined}>
      <circle cx={c} cy={c} r={r - 1.25} className={s.glyphBody} />
      {frac >= 0.999 ? <circle cx={c} cy={c} r={inner} style={{ fill }} className={s.glyphWedge} /> : null}
      {wedge ? <path d={wedge} style={{ fill }} className={s.glyphWedge} /> : null}
      <circle cx={c} cy={c} r={r - 1.25} fill="none" style={{ stroke: ring }} strokeWidth={2.25} />
    </svg>
  );
}

export function HealthDot({ health }: { health: Health }) {
  return <span className={s.healthDot} data-health={health} aria-hidden="true" />;
}

export function StatusPill({ p }: { p: Project }) {
  return (
    <span className={s.statusPill} data-health={p.unwrapped ? "past" : p.health}>
      <HealthDot health={p.health} />
      {statusWord(p)}
    </span>
  );
}

export function FileIcon({ kind }: { kind: FileKind }) {
  return (
    <span className={s.fileIcon} data-kind={kind} aria-hidden="true">
      <Icon name={kind} size={14} />
    </span>
  );
}

export function IdTile({ p, size = 28 }: { p: Project; size?: number }) {
  const initials = p.name
    .replace(/[^A-Za-z0-9 &]/g, "")
    .split(/\s+/)
    .filter((w) => w && w !== "&")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className={s.idTile} style={{ background: p.color, width: size, height: size, fontSize: Math.round(size * 0.38) } as CSSProperties} aria-hidden="true">
      {initials}
    </span>
  );
}
