import { type ReactNode, useId } from "react";
import type { FileKind, Preview as PreviewSpec } from "./data";
import s from "./preview.module.css";

/**
 * Rich mini previews drawn as one portrait page (120 x 156). They scale from
 * a 34px row thumbnail to the full peek panel without losing their character.
 */

const W = 120;
const H = 156;

export const KIND_VAR: Record<FileKind, string> = {
  doc: "var(--v3-kind-doc)",
  pdf: "var(--v3-kind-slides)",
  sheet: "var(--v3-kind-sheet)",
  image: "var(--v3-kind-image)",
  slides: "var(--v3-kind-slides)",
  design: "var(--v3-kind-design)",
  link: "var(--v3-kind-link)",
};

const line = { fill: "var(--pv-line)" } as const;
const lineSoft = { fill: "var(--pv-line-soft)" } as const;
const ink = { fill: "var(--pv-ink)" } as const;

function Lines({ x, y, widths, gap = 7, h = 3 }: { x: number; y: number; widths: number[]; gap?: number; h?: number }) {
  return (
    <>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height={h} rx={h / 2} style={i === 0 ? line : lineSoft} />
      ))}
    </>
  );
}

function Doc({ label, accent }: { label?: string; accent: string }) {
  return (
    <>
      <rect x={14} y={16} width={16} height={4} rx={2} style={{ fill: accent }} />
      <text x={14} y={36} className={s.title} style={ink}>
        {label ?? "Untitled"}
      </text>
      <Lines x={14} y={48} widths={[92, 86, 90, 64]} />
      <Lines x={14} y={84} widths={[88, 92, 70]} />
      <rect x={14} y={110} width={40} height={24} rx={3} style={{ fill: accent, opacity: 0.18 }} />
      <Lines x={60} y={112} widths={[46, 40, 44]} />
    </>
  );
}

function Menu({ label }: { label?: string }) {
  const courses = [52, 64, 44, 58];
  return (
    <>
      <circle cx={60} cy={20} r={3} style={{ fill: "var(--pv-gold)" }} />
      <text x={60} y={38} textAnchor="middle" className={s.serif} style={ink}>
        {label ?? "Menu"}
      </text>
      <rect x={44} y={45} width={32} height={1.2} style={{ fill: "var(--pv-gold)" }} />
      {courses.map((w, i) => (
        <g key={i}>
          <rect x={60 - w / 2} y={58 + i * 22} width={w} height={3.4} rx={1.7} style={line} />
          <rect x={60 - (w - 18) / 2} y={65 + i * 22} width={w - 18} height={2.4} rx={1.2} style={lineSoft} />
        </g>
      ))}
    </>
  );
}

function Sheet({ v = 0, accent }: { v?: number; accent: string }) {
  const cols = [10, 38, 62, 86, 110];
  const rows = Array.from({ length: 12 }, (_, i) => 26 + i * 10);
  const hi = [2, 5, 8, 3, 6][v % 5];
  return (
    <>
      <rect x={10} y={12} width={100} height={12} style={{ fill: accent, opacity: 0.22 }} />
      {cols.map((x) => (
        <rect key={x} x={x} y={12} width={0.8} height={134} style={lineSoft} />
      ))}
      {rows.map((y) => (
        <rect key={y} x={10} y={y} width={100} height={0.8} style={lineSoft} />
      ))}
      <rect x={10} y={16 + hi * 10} width={100} height={10} style={{ fill: accent, opacity: 0.12 }} />
      {rows.slice(0, 11).map((y, i) => (
        <g key={`c${y}`}>
          <rect x={13} y={y + 3.2} width={18 + ((i * 7) % 8)} height={3} rx={1.5} style={line} />
          <rect x={41} y={y + 3.2} width={10 + ((i * 5) % 10)} height={3} rx={1.5} style={lineSoft} />
          <rect x={65} y={y + 3.2} width={14 - ((i * 3) % 6)} height={3} rx={1.5} style={lineSoft} />
          <rect x={98 - ((i * 4) % 8)} y={y + 3.2} width={8 + ((i * 4) % 8)} height={3} rx={1.5} style={lineSoft} />
        </g>
      ))}
    </>
  );
}

function Invoice({ label, accent }: { label?: string; accent: string }) {
  return (
    <>
      <rect x={12} y={14} width={14} height={14} rx={3} style={{ fill: accent }} />
      <text x={32} y={25} className={s.small} style={ink}>
        {label ?? "Invoice"}
      </text>
      <Lines x={78} y={15} widths={[30, 24, 28]} gap={5} h={2.4} />
      <rect x={12} y={44} width={96} height={9} style={{ fill: "var(--pv-line-soft)" }} />
      {[58, 68, 78, 88, 98].map((y, i) => (
        <g key={y}>
          <rect x={14} y={y} width={46 - (i % 3) * 8} height={3} rx={1.5} style={lineSoft} />
          <rect x={90 - (i % 2) * 4} y={y} width={16 + (i % 2) * 4} height={3} rx={1.5} style={line} />
        </g>
      ))}
      <rect x={60} y={114} width={48} height={1} style={line} />
      <rect x={62} y={120} width={20} height={4} rx={2} style={line} />
      <rect x={88} y={119} width={20} height={6} rx={2} style={ink} />
      <Lines x={12} y={138} widths={[60, 44]} gap={5} h={2.2} />
    </>
  );
}

function Contract({ label }: { label?: string }) {
  return (
    <>
      <text x={60} y={26} textAnchor="middle" className={s.serifSmall} style={ink}>
        {label ?? "Agreement"}
      </text>
      <Lines x={14} y={38} widths={[92, 88, 92, 76]} gap={6.5} h={2.6} />
      <Lines x={14} y={68} widths={[90, 92, 60]} gap={6.5} h={2.6} />
      <path
        d="M16 128 C 22 116, 28 138, 34 124 S 44 118, 48 128 S 58 132, 64 122"
        style={{ fill: "none", stroke: "var(--pv-sign)", strokeWidth: 1.6, strokeLinecap: "round" }}
      />
      <rect x={14} y={134} width={52} height={0.8} style={line} />
      <circle cx={92} cy={124} r={11} style={{ fill: "none", stroke: "var(--pv-gold)", strokeWidth: 1.4 }} />
      <circle cx={92} cy={124} r={6} style={{ fill: "var(--pv-gold)", opacity: 0.35 }} />
    </>
  );
}

function Form() {
  return (
    <>
      <rect x={12} y={14} width={60} height={5} rx={2.5} style={line} />
      <Lines x={12} y={26} widths={[80]} gap={6} h={2.4} />
      {[40, 58, 76, 94, 112, 130].map((y, i) => (
        <g key={y}>
          <rect x={12} y={y} width={8} height={8} rx={2} style={{ fill: "none", stroke: "var(--pv-line)", strokeWidth: 1 }} />
          {i % 3 !== 2 && (
            <path d={`M14 ${y + 4} l2 2 l3.5 -4`} style={{ fill: "none", stroke: "var(--v3-success)", strokeWidth: 1.4, strokeLinecap: "round" }} />
          )}
          <rect x={26} y={y + 2.5} width={56 - (i % 3) * 10} height={3} rx={1.5} style={lineSoft} />
          <rect x={86} y={y + 7} width={22} height={0.8} style={lineSoft} />
        </g>
      ))}
    </>
  );
}

function Plan({ v = 0, label }: { v?: number; label?: string }) {
  const wall = { fill: "none", stroke: "var(--pv-ink)", strokeWidth: 2.2 } as const;
  const thin = { fill: "none", stroke: "var(--pv-line)", strokeWidth: 0.9 } as const;
  return (
    <>
      <rect x={0} y={0} width={W} height={H} style={{ fill: "var(--pv-blueprint)" }} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={`g${i}`} x={i * 10} y={0} width={0.4} height={H} style={{ fill: "var(--pv-grid)" }} />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={`h${i}`} x={0} y={i * 10} width={W} height={0.4} style={{ fill: "var(--pv-grid)" }} />
      ))}
      {v === 3 ? (
        <>
          <path d="M14 24 H106 V132 H14 Z" style={wall} />
          {[0, 1, 2, 3, 4].map((r) => (
            <g key={r}>
              {[0, 1, 2, 3, 4, 5].map((c) => (
                <rect key={c} x={20 + c * 14} y={32 + r * 18} width={10} height={12} rx={1} style={thin} />
              ))}
            </g>
          ))}
          <path d="M14 124 H40" style={{ ...wall, stroke: "var(--v3-success)" }} />
        </>
      ) : (
        <>
          <path d="M12 22 H108 V134 H12 Z M12 86 H52 M76 86 H108 M52 86 V134" style={wall} />
          <path d="M60 22 V40" style={wall} />
          {v === 2
            ? Array.from({ length: 8 }, (_, i) => (
                <g key={i}>
                  <rect x={20} y={30 + i * 6.4} width={30} height={3} rx={1} style={thin} />
                  <rect x={70} y={30 + i * 6.4} width={30} height={3} rx={1} style={thin} />
                </g>
              ))
            : [
                [30, 44],
                [58, 58],
                [88, 44],
                [30, 70],
                [88, 70],
              ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={7} style={thin} />)}
          <rect x={60} y={100} width={40} height={14} rx={2} style={thin} />
          {v === 1 && (
            <>
              <path d="M22 128 H40 M100 30 V48" style={{ fill: "none", stroke: "var(--v3-success)", strokeWidth: 3 }} />
              <path d="M40 110 L30 124 M34 124 H30 V120" style={{ fill: "none", stroke: "var(--v3-success)", strokeWidth: 1.3 }} />
            </>
          )}
        </>
      )}
      {label && (
        <text x={14} y={148} className={s.tiny} style={ink}>
          {label}
        </text>
      )}
    </>
  );
}

function Seating({ v = 0 }: { v?: number }) {
  const thin = { fill: "none", stroke: "var(--pv-line)", strokeWidth: 1 } as const;
  if (v === 1) {
    return (
      <>
        <rect x={30} y={40} width={60} height={76} rx={6} style={thin} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx={22} cy={56 + i * 22} r={4.5} style={{ fill: "var(--v3-kind-sheet)", opacity: 0.6 }} />
            <circle cx={98} cy={56 + i * 22} r={4.5} style={{ fill: "var(--v3-kind-sheet)", opacity: 0.6 }} />
          </g>
        ))}
        <text x={60} y={140} textAnchor="middle" className={s.tiny} style={ink}>
          Window table
        </text>
      </>
    );
  }
  if (v === 3) {
    return (
      <>
        {Array.from({ length: 7 }, (_, r) => (
          <g key={r}>
            <rect x={24} y={18 + r * 18} width={24} height={12} rx={3} style={thin} />
            <rect x={72} y={18 + r * 18} width={24} height={12} rx={3} style={thin} />
            <rect x={28} y={22 + r * 18} width={16} height={4} rx={2} style={lineSoft} />
            <rect x={76} y={22 + r * 18} width={14} height={4} rx={2} style={lineSoft} />
          </g>
        ))}
      </>
    );
  }
  const tables = [
    [34, 36],
    [86, 36],
    [34, 78],
    [86, 78],
    [34, 120],
    [86, 120],
  ];
  return (
    <>
      {tables.map(([cx, cy], t) => (
        <g key={t}>
          <circle cx={cx} cy={cy} r={11} style={thin} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const filled = v !== 2 || t < 4 || i < 5;
            return (
              <circle
                key={i}
                cx={cx + Math.cos(a) * 16}
                cy={cy + Math.sin(a) * 16}
                r={2.6}
                style={{ fill: filled ? "var(--v3-kind-sheet)" : "var(--pv-line-soft)", opacity: filled ? 0.7 : 1 }}
              />
            );
          })}
          <text x={cx} y={cy + 2.6} textAnchor="middle" className={s.tiny} style={ink}>
            {t + 1}
          </text>
        </g>
      ))}
    </>
  );
}

const PHOTOS: { sky: [string, string, string]; body: ReactNode }[] = [
  {
    // Terrace at golden hour
    sky: ["#f6c27a", "#ee8f6a", "#b75c6d"],
    body: (
      <>
        <circle cx={82} cy={70} r={16} fill="#ffe4a8" opacity={0.9} />
        <path d="M0 100 Q30 84 60 96 T120 90 V156 H0 Z" fill="#5b3b4a" />
        <path d="M0 118 Q40 104 80 116 T120 112 V156 H0 Z" fill="#2f2330" />
        <path d="M0 40 Q60 58 120 36" fill="none" stroke="#3a2a33" strokeWidth={0.6} />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={8 + i * 13} cy={42 + Math.sin(i / 1.4) * 5 + (i > 4 ? -3 : 3)} r={1.6} fill="#fff4c9" />
        ))}
        <rect x={16} y={124} width={30} height={3} rx={1.5} fill="#e9c7a0" opacity={0.6} />
      </>
    ),
  },
  {
    // Plating on slate
    sky: ["#3a3f47", "#2c3036", "#1f2226"],
    body: (
      <>
        <circle cx={60} cy={78} r={42} fill="#f4f1ea" />
        <circle cx={60} cy={78} r={34} fill="#ebe6dc" />
        <ellipse cx={54} cy={74} rx={14} ry={10} fill="#c9793b" />
        <circle cx={70} cy={84} r={6} fill="#7a9a4c" />
        <circle cx={64} cy={66} r={3} fill="#b3314a" />
        <circle cx={44} cy={88} r={2.4} fill="#7a9a4c" />
        <path d="M40 96 Q60 104 80 94" fill="none" stroke="#8b4a2b" strokeWidth={2} strokeLinecap="round" />
      </>
    ),
  },
  {
    // Florist mood board
    sky: ["#f3e6e1", "#eadbd6", "#e2d3cd"],
    body: (
      <>
        <rect x={8} y={8} width={50} height={66} rx={3} fill="#d99aa5" />
        <circle cx={33} cy={40} r={15} fill="#f4c7cf" />
        <circle cx={27} cy={36} r={7} fill="#fbe3e7" />
        <rect x={62} y={8} width={50} height={40} rx={3} fill="#8fa888" />
        <path d="M70 40 Q84 12 104 30" fill="none" stroke="#dfe9d6" strokeWidth={2} />
        <rect x={62} y={52} width={50} height={52} rx={3} fill="#b5c4a6" />
        <circle cx={87} cy={78} r={12} fill="#f7efe4" />
        <rect x={8} y={78} width={50} height={70} rx={3} fill="#a7bf9a" />
        <circle cx={24} cy={100} r={9} fill="#f4c7cf" />
        <circle cx={42} cy={116} r={11} fill="#e8a8b4" />
        <rect x={62} y={108} width={50} height={40} rx={3} fill="#e7cfc4" />
      </>
    ),
  },
  {
    // Save the date card
    sky: ["#f5efe4", "#f2eadc", "#efe5d4"],
    body: (
      <>
        <rect x={10} y={10} width={100} height={136} rx={2} fill="none" stroke="#9fb39a" strokeWidth={0.8} />
        <text x={60} y={62} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize={15} fill="#4e6149">
          Save
        </text>
        <text x={60} y={80} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize={15} fill="#4e6149">
          the date
        </text>
        <rect x={46} y={90} width={28} height={0.8} fill="#c98f98" />
        <text x={60} y={104} textAnchor="middle" fontFamily="Georgia, serif" fontSize={7} fill="#6d5a4d">
          17 . 10 . 26
        </text>
        <path d="M30 30 q6 -10 12 0 q-6 6 -12 0" fill="#a7bf9a" />
        <path d="M78 128 q6 -10 12 0 q-6 6 -12 0" fill="#e8a8b4" />
      </>
    ),
  },
  {
    // Packaging, clay boxes
    sky: ["#e9e2d8", "#ddd4c7", "#cfc5b6"],
    body: (
      <>
        <path d="M18 76 L58 60 L98 76 L58 92 Z" fill="#c67b52" />
        <path d="M18 76 V116 L58 132 V92 Z" fill="#a8603c" />
        <path d="M98 76 V116 L58 132 V92 Z" fill="#8e4f31" />
        <text x={58} y={80} textAnchor="middle" fontFamily="Georgia, serif" fontSize={8} fill="#f6e9dc">
          kiln
        </text>
        <rect x={80} y={28} width={26} height={30} rx={2} fill="#4d6a7a" />
        <rect x={84} y={34} width={18} height={3} rx={1.5} fill="#d9e3e8" />
      </>
    ),
  },
];

function Photo({ v = 0, label }: { v?: number; label?: string }) {
  const p = PHOTOS[v % PHOTOS.length];
  const id = `pv-sky-${useId().replace(/:/g, "")}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
      {p.body}
      {label && v !== 3 && (
        <text x={10} y={148} className={s.tiny} fill="#ffffff">
          {label}
        </text>
      )}
    </>
  );
}

function Slides({ v = 0, label }: { v?: number; label?: string }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={H} style={{ fill: v === 1 ? "#2b2622" : "#1d1f24" }} />
      <rect x={10} y={20} width={100} height={56} rx={3} fill={v === 1 ? "#d9cbb8" : "#c67b52"} />
      <circle cx={42} cy={48} r={14} fill={v === 1 ? "#2b2622" : "#f3e6d8"} />
      <text x={62} y={52} fontFamily="Georgia, serif" fontSize={12} fill={v === 1 ? "#2b2622" : "#f3e6d8"}>
        {label ?? "Kiln"}
      </text>
      <rect x={10} y={84} width={48} height={28} rx={3} fill="#4d6a7a" />
      <rect x={62} y={84} width={48} height={28} rx={3} fill="#8e9b7a" />
      <rect x={10} y={118} width={100} height={3} rx={1.5} fill="#ffffff" opacity={0.3} />
      <rect x={10} y={126} width={70} height={3} rx={1.5} fill="#ffffff" opacity={0.18} />
    </>
  );
}

const SWATCHES: string[][] = [
  ["#8fa888", "#e8a8b4", "#f5efe4", "#4e6149"],
  ["#4e6149", "#a7bf9a", "#f2eadc", "#c98f98"],
  ["#5c8a3a", "#c3d86a", "#f4f1e6", "#2f3b26"],
  ["#c67b52", "#4d6a7a", "#e9e2d8", "#2b2622"],
];

function Design({ v = 0, label }: { v?: number; label?: string }) {
  const sw = SWATCHES[v % SWATCHES.length];
  return (
    <>
      <rect x={0} y={0} width={W} height={92} fill={sw[2]} />
      <text x={60} y={58} textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize={label && label.length > 4 ? 16 : 26} fill={sw[3]}>
        {label ?? "Aa"}
      </text>
      <rect x={42} y={68} width={36} height={0.8} fill={sw[1]} />
      {sw.map((c, i) => (
        <rect key={c} x={i * 30} y={92} width={30} height={64} fill={c} />
      ))}
    </>
  );
}

function Link({ label }: { label?: string }) {
  return (
    <>
      <rect x={0} y={0} width={W} height={18} style={{ fill: "var(--pv-line-soft)" }} />
      <circle cx={8} cy={9} r={2} style={line} />
      <circle cx={15} cy={9} r={2} style={line} />
      <rect x={24} y={5} width={88} height={8} rx={4} style={{ fill: "var(--pv-paper)" }} />
      <text x={30} y={11.2} className={s.micro} style={ink}>
        {label ?? "link"}
      </text>
      <rect x={12} y={30} width={96} height={40} rx={4} style={{ fill: "var(--v3-kind-link)", opacity: 0.2 }} />
      <circle cx={30} cy={50} r={9} style={{ fill: "var(--v3-kind-link)" }} />
      <Lines x={46} y={44} widths={[50, 36]} gap={7} h={3} />
      {[80, 104, 128].map((y) => (
        <g key={y}>
          <rect x={12} y={y} width={16} height={16} rx={3} style={lineSoft} />
          <Lines x={34} y={y + 3} widths={[60, 42]} gap={6} h={2.6} />
        </g>
      ))}
    </>
  );
}

export function Preview({ spec, kind, className }: { spec: PreviewSpec; kind: FileKind; className?: string }) {
  const accent = KIND_VAR[kind];
  let body: ReactNode;
  switch (spec.type) {
    case "doc":
      body = <Doc label={spec.label} accent={accent} />;
      break;
    case "menu":
      body = <Menu label={spec.label} />;
      break;
    case "sheet":
      body = <Sheet v={spec.v} accent={accent} />;
      break;
    case "invoice":
      body = <Invoice label={spec.label} accent={accent} />;
      break;
    case "contract":
      body = <Contract label={spec.label} />;
      break;
    case "form":
      body = <Form />;
      break;
    case "plan":
      body = <Plan v={spec.v} label={spec.label} />;
      break;
    case "seating":
      body = <Seating v={spec.v} />;
      break;
    case "photo":
      body = <Photo v={spec.v} label={spec.label} />;
      break;
    case "slides":
      body = <Slides v={spec.v} label={spec.label} />;
      break;
    case "design":
      body = <Design v={spec.v} label={spec.label} />;
      break;
    case "link":
      body = <Link label={spec.label} />;
      break;
  }
  return (
    <svg className={`${s.page}${className ? ` ${className}` : ""}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x={0} y={0} width={W} height={H} style={{ fill: "var(--pv-paper)" }} />
      {body}
    </svg>
  );
}
