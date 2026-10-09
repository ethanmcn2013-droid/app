import { LABELS, PEOPLE, PRIORITIES, STATUSES, type LabelId, type PersonId, type Priority, type StatusId } from "./data";
import s from "./list.module.css";

/* One status vocabulary: empty ring, amber half, accent three-quarter,
   clock, green tick. Strokes meet 3:1 against the surface. */
export function StatusGlyph({ status, size = 16 }: { status: StatusId; size?: number }) {
  const name = STATUSES.find((x) => x.id === status)!.name;
  return (
    <svg className={s.glyph} width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={name}>
      {status === "todo" && <circle cx="8" cy="8" r="6" fill="none" stroke="var(--v3-control-border)" strokeWidth="1.5" />}
      {status === "progress" && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--v3-warning-stroke)" strokeWidth="1.5" />
          <path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="var(--v3-warning-stroke)" />
        </>
      )}
      {status === "review" && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--v3-accent)" strokeWidth="1.5" />
          <path d="M8 4.5a3.5 3.5 0 1 1 -3.5 3.5H8z" fill="var(--v3-accent)" />
        </>
      )}
      {status === "waiting" && (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--v3-control-border)" strokeWidth="1.5" strokeDasharray="2.2 1.8" />
          <path d="M8 5.2V8l1.9 1.3" fill="none" stroke="var(--v3-text-2)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {status === "done" && (
        <>
          <circle cx="8" cy="8" r="7" fill="var(--v3-success)" />
          <path className={s.tick} d="M5 8.2l2 2 4-4.2" fill="none" stroke="var(--v3-surface)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export function PriorityIcon({ p }: { p: Priority }) {
  const name = PRIORITIES.find((x) => x.p === p)!.name;
  if (p === 0) return <span className={s.prioNone} aria-label={name} title={name} />;
  if (p === 4)
    return (
      <svg className={s.glyph} width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={name}>
        <title>{name}</title>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="var(--v3-danger)" />
        <path d="M8 4.6v4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.3" r="1.05" fill="#fff" />
      </svg>
    );
  return (
    <svg className={s.glyph} width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={name}>
      <title>{name}</title>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.4}
          y={10 - i * 3.4}
          width="3"
          height={4 + i * 3.4}
          rx="1"
          fill={i < p ? "var(--v3-text-2)" : "var(--v3-border-strong)"}
        />
      ))}
    </svg>
  );
}

export function Avatar({ person, size = 22 }: { person: PersonId | null; size?: number }) {
  if (!person)
    return (
      <span className={s.avatarEmpty} style={{ width: size, height: size }} aria-label="No one" title="No one assigned">
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="4.2" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2.2 10.5c.6-1.9 2-2.8 3.8-2.8s3.2.9 3.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
    );
  const p = PEOPLE[person];
  return (
    <span
      className={s.avatar}
      style={{ width: size, height: size, background: p.tone, fontSize: Math.round(size * 0.46) }}
      aria-label={p.name}
      title={`${p.full}, ${p.role}`}
    >
      {p.name[0]}
    </span>
  );
}

export function LabelDots({ labels }: { labels: LabelId[] }) {
  if (!labels.length) return null;
  const names = labels.map((l) => LABELS[l].name).join(", ");
  return (
    <span className={s.dots} title={names} aria-label={`Labels: ${names}`}>
      {labels.map((l) => (
        <span key={l} className={s.dot} style={{ background: LABELS[l].tone }} />
      ))}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

type IconName = "command" | "close" | "chevron" | "enter" | "check" | "plus" | "calendar" | "person" | "flag" | "arrow" | "trash" | "tag" | "keyboard" | "filter" | "spark" | "undo" | "sort";

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className={s.icon}>
      {name === "command" && <path {...common} d="M3 5.5 6 8l-3 2.5M7.5 11H13" />}
      {name === "close" && <path {...common} d="M4 4l8 8M12 4l-8 8" />}
      {name === "chevron" && <path {...common} d="M4.5 6.5 8 10l3.5-3.5" />}
      {name === "enter" && <path {...common} d="M12.5 4v4.5a1.5 1.5 0 0 1-1.5 1.5H4m2.5-2.5L4 10l2.5 2.5" />}
      {name === "check" && <path {...common} d="M3.5 8.5l3 3 6-7" />}
      {name === "plus" && <path {...common} d="M8 3v10M3 8h10" />}
      {name === "calendar" && (
        <>
          <rect {...common} x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path {...common} d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </>
      )}
      {name === "person" && (
        <>
          <circle {...common} cx="8" cy="5.5" r="2.5" />
          <path {...common} d="M3 13.5c.8-2.4 2.6-3.5 5-3.5s4.2 1.1 5 3.5" />
        </>
      )}
      {name === "flag" && <path {...common} d="M4 14V2.5h7.5L10 5.5l1.5 3H4" />}
      {name === "arrow" && <path {...common} d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />}
      {name === "trash" && <path {...common} d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />}
      {name === "tag" && (
        <>
          <path {...common} d="M2.5 2.5h5l6 6-5 5-6-6z" />
          <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
        </>
      )}
      {name === "keyboard" && (
        <>
          <rect {...common} x="1.5" y="4" width="13" height="8.5" rx="2" />
          <path {...common} d="M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5 10h6" />
        </>
      )}
      {name === "filter" && <path {...common} d="M2.5 4h11M4.5 8h7M6.5 12h3" />}
      {name === "spark" && <path {...common} d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.8 1.8M10.2 10.2 12 12M12 4l-1.8 1.8M5.8 10.2 4 12" />}
      {name === "undo" && <path {...common} d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7" />}
      {name === "sort" && <path {...common} d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" />}
    </svg>
  );
}
