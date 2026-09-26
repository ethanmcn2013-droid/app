import { useId } from "react";
import type { Scene } from "./data";

/**
 * "Photographs" drawn in SVG. They are image content, so their colours are
 * fixed (a photo does not change with the app theme).
 */
export function PhotoScene({ scene }: { scene: Scene }) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `${uid}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const box = { viewBox: "0 0 600 400", preserveAspectRatio: "xMidYMid slice", width: "100%", height: "100%", role: "img" } as const;

  if (scene === "terrace") {
    const bulbs = Array.from({ length: 15 }, (_, i) => {
      const x = 20 + i * 40;
      const t = (x % 300) / 300;
      const y = 118 + Math.sin(t * Math.PI) * 48 + (x > 300 ? 2 : 0);
      return { x, y };
    });
    return (
      <svg {...box} aria-label="The terrace at golden hour">
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#35295a" />
            <stop offset="0.32" stopColor="#8f4468" />
            <stop offset="0.56" stopColor="#e37a57" />
            <stop offset="0.7" stopColor="#f6b865" />
            <stop offset="0.78" stopColor="#f9d38a" />
          </linearGradient>
          <radialGradient id={id("sun")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fffbe8" />
            <stop offset="0.25" stopColor="#ffe3a0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffb86a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("bulb")} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff7d6" />
            <stop offset="0.35" stopColor="#ffd98a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffb14a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("deck")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b4130" />
            <stop offset="1" stopColor="#24140f" />
          </linearGradient>
          <radialGradient id={id("vig")} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#1a0d12" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        <rect width="600" height="400" fill={url("sky")} />
        <circle cx="408" cy="262" r="150" fill={url("sun")} />
        <circle cx="408" cy="262" r="24" fill="#fff6d4" />
        <path d="M0 268 Q120 236 250 258 T470 248 T600 256 V400 H0Z" fill="#7a3f5d" opacity="0.75" />
        {[30, 70, 118, 160, 205, 250, 292, 338, 380, 440, 486, 530, 574].map((x, i) => (
          <ellipse key={x} cx={x} cy={270 - (i % 3) * 4} rx={20 + (i % 4) * 5} ry={16 + (i % 3) * 4} fill="#3e2340" />
        ))}
        <path d="M0 280 H600 V400 H0Z" fill="#2c1729" />
        <path d="M0 318 H600 V400 H0Z" fill={url("deck")} />
        {[-240, -150, -60, 30, 120, 210, 300, 390, 480, 570, 660, 750, 840].map((x) => (
          <path key={x} d={`M${300 + (x - 300) * 0.35} 318 L${x} 400`} stroke="#1b0e0a" strokeOpacity="0.55" strokeWidth="1.2" />
        ))}
        <rect x="0" y="292" width="600" height="6" fill="#170c0c" />
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={i * 40 + 8} y="296" width="5" height="30" fill="#170c0c" />
        ))}
        <path d="M0 110 Q150 172 300 118 Q450 172 600 112" stroke="#1d1010" strokeWidth="1.4" fill="none" />
        {bulbs.map((b) => (
          <g key={b.x}>
            <circle cx={b.x} cy={b.y + 6} r="14" fill={url("bulb")} />
            <circle cx={b.x} cy={b.y + 6} r="3" fill="#fff4cf" />
          </g>
        ))}
        <g fill="#140a0a">
          <rect x="86" y="330" width="120" height="7" rx="2" />
          <rect x="96" y="336" width="5" height="46" />
          <rect x="190" y="336" width="5" height="46" />
          <path d="M126 312 h7 v14 h-7Z M160 316 h6 v10 h-6Z" />
        </g>
        <rect width="600" height="400" fill={url("vig")} />
      </svg>
    );
  }

  if (scene === "snowbarn") {
    const flakes = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 600, y: (i * 61) % 400, r: 0.8 + (i % 4) * 0.5 }));
    return (
      <svg {...box} aria-label="The barn in the snow">
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#aebfd1" />
            <stop offset="1" stopColor="#e7edf3" />
          </linearGradient>
          <linearGradient id={id("snow")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6f8fb" />
            <stop offset="1" stopColor="#dbe4ee" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill={url("sky")} />
        {[20, 60, 95, 140, 470, 510, 548, 585].map((x, i) => (
          <path key={x} d={`M${x} ${250 - (i % 3) * 14} l-18 60 h36Z`} fill="#8497a8" opacity="0.8" />
        ))}
        <path d="M0 290 Q300 262 600 292 V400 H0Z" fill={url("snow")} />
        <rect x="190" y="178" width="230" height="130" fill="#8c2f25" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={190 + i * 19.5} y="178" width="1.2" height="130" fill="#6d231c" />
        ))}
        <path d="M176 182 L305 106 L434 182Z" fill="#3a2d2b" />
        <path d="M172 184 L305 100 L438 184 L430 188 L305 112 L180 188Z" fill="#f5f7fa" />
        <rect x="266" y="222" width="80" height="86" fill="#a2463a" />
        <path d="M266 222 L346 308 M346 222 L266 308" stroke="#f1e4d8" strokeWidth="4" />
        <rect x="266" y="222" width="80" height="86" fill="none" stroke="#f1e4d8" strokeWidth="4" />
        <rect x="210" y="200" width="30" height="26" fill="#ffd27a" />
        <rect x="372" y="200" width="30" height="26" fill="#ffd27a" />
        <rect x="294" y="140" width="24" height="24" rx="12" fill="#ffd27a" />
        <path d="M0 312 Q200 296 600 316 V400 H0Z" fill="#eef3f8" />
        <path d="M300 400 Q310 350 306 312" stroke="#c9d5e2" strokeWidth="18" fill="none" />
        {flakes.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="#fff" opacity="0.85" />
        ))}
      </svg>
    );
  }

  if (scene === "studio") {
    const pots = [
      { x: 70, w: 50, h: 44, c: "#b8693f" },
      { x: 140, w: 36, h: 58, c: "#e7dcc6" },
      { x: 192, w: 60, h: 34, c: "#5f7563" },
      { x: 270, w: 42, h: 50, c: "#3e4a55" },
      { x: 330, w: 56, h: 40, c: "#c98f5c" },
      { x: 404, w: 34, h: 62, c: "#e9e1d1" },
      { x: 456, w: 64, h: 36, c: "#9a4f33" },
    ];
    return (
      <svg {...box} aria-label="The studio drying shelves">
        <defs>
          <linearGradient id={id("wall")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e6d4b8" />
            <stop offset="1" stopColor="#b99a74" />
          </linearGradient>
          <linearGradient id={id("light")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff8e6" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff8e6" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill={url("wall")} />
        {[150, 280].map((y, row) => (
          <g key={y}>
            {pots.map((p, i) => {
              const x = p.x + row * 18 - (i % 2) * 6;
              const h = p.h - row * 6;
              return (
                <g key={i}>
                  <path d={`M${x} ${y} q-4 ${-h * 0.6} ${p.w * 0.18} ${-h} h${p.w * 0.64} q${p.w * 0.22} ${h * 0.4} ${p.w * 0.18} ${h}Z`} fill={row ? p.c : pots[(i + 3) % pots.length].c} />
                  <ellipse cx={x + p.w / 2} cy={y - h} rx={p.w * 0.32} ry="3.5" fill="#000" opacity="0.2" />
                </g>
              );
            })}
            <rect x="30" y={y} width="540" height="12" fill="#6e4a30" />
            <rect x="30" y={y + 12} width="540" height="6" fill="#4d3321" />
          </g>
        ))}
        <rect x="30" y="0" width="12" height="400" fill="#5b3c27" />
        <rect x="558" y="0" width="12" height="400" fill="#5b3c27" />
        <path d="M120 0 L340 0 L520 400 L300 400Z" fill={url("light")} />
        <rect y="330" width="600" height="70" fill="#7a5a40" />
        <rect y="330" width="600" height="3" fill="#5a3f2b" />
      </svg>
    );
  }

  if (scene === "shopfront") {
    return (
      <svg {...box} aria-label="The bakery shopfront at dawn">
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fb6d3" />
            <stop offset="0.7" stopColor="#f5d2b0" />
          </linearGradient>
          <pattern id={id("awn")} width="28" height="40" patternUnits="userSpaceOnUse">
            <rect width="14" height="40" fill="#f2ebdd" />
            <rect x="14" width="14" height="40" fill="#1d6b72" />
          </pattern>
          <linearGradient id={id("glow")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe0a0" />
            <stop offset="1" stopColor="#f2a654" />
          </linearGradient>
          <linearGradient id={id("wet")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5f6c78" />
            <stop offset="1" stopColor="#39424b" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill={url("sky")} />
        <rect x="60" y="40" width="480" height="280" fill="#174a50" />
        <rect x="60" y="40" width="480" height="10" fill="#0f383d" />
        <rect x="120" y="62" width="360" height="46" rx="3" fill="#efe6d4" />
        <text x="300" y="94" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fill="#174a50" fontStyle="italic">
          Harbour Bakery
        </text>
        <path d="M70 128 H530 L550 168 H50Z" fill={url("awn")} />
        <path d="M50 168 H550 V174 H50Z" fill="#12474d" />
        <rect x="90" y="186" width="170" height="124" fill={url("glow")} />
        <rect x="340" y="186" width="170" height="124" fill={url("glow")} />
        <rect x="276" y="186" width="48" height="124" fill="#0f383d" />
        <rect x="282" y="194" width="36" height="60" fill="#ffd894" opacity="0.9" />
        {[118, 156, 194, 232].map((x) => (
          <ellipse key={x} cx={x} cy="286" rx="15" ry="9" fill="#a8622c" />
        ))}
        {[368, 406, 444, 482].map((x) => (
          <circle key={x} cx={x} cy="284" r="10" fill="#c7843f" />
        ))}
        <rect x="90" y="244" width="170" height="3" fill="#0f383d" />
        <rect x="340" y="244" width="170" height="3" fill="#0f383d" />
        <rect y="320" width="600" height="80" fill={url("wet")} />
        <rect x="90" y="326" width="170" height="30" fill="#f2a654" opacity="0.25" />
        <rect x="340" y="326" width="170" height="30" fill="#f2a654" opacity="0.25" />
        <path d="M0 360 H600" stroke="#8a97a3" strokeOpacity="0.4" />
      </svg>
    );
  }

  if (scene === "sourdough") {
    return (
      <svg {...box} aria-label="A sourdough loaf, close up">
        <defs>
          <radialGradient id={id("loaf")} cx="0.45" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#d69a5a" />
            <stop offset="0.6" stopColor="#a4612e" />
            <stop offset="1" stopColor="#5e3417" />
          </radialGradient>
        </defs>
        <rect width="600" height="400" fill="#2a211b" />
        <ellipse cx="300" cy="215" rx="230" ry="150" fill="#3a2d24" />
        <ellipse cx="300" cy="205" rx="200" ry="130" fill={url("loaf")} />
        <path d="M160 170 Q300 110 440 190" stroke="#efcf9c" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d="M160 170 Q300 110 440 190" stroke="#fff3da" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={130 + ((i * 53) % 340)} cy={110 + ((i * 37) % 190)} r={1 + (i % 3)} fill="#fff" opacity="0.35" />
        ))}
      </svg>
    );
  }

  /* oldsign: a phone photo of the faded sign at the gate (portrait). */
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="img" aria-label="The old welcome sign by the gate">
      <defs>
        <radialGradient id={id("hedge")} cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#6f8c4e" />
          <stop offset="1" stopColor="#2f4424" />
        </radialGradient>
      </defs>
      <rect width="300" height="400" fill={url("hedge")} />
      {Array.from({ length: 60 }, (_, i) => (
        <circle key={i} cx={(i * 47) % 300} cy={(i * 29) % 400} r={6 + (i % 5) * 3} fill={i % 2 ? "#3f5b2d" : "#86a35f"} opacity="0.5" />
      ))}
      <rect x="140" y="250" width="20" height="150" fill="#5a4330" />
      <rect x="44" y="92" width="212" height="170" rx="4" fill="#d9ccae" />
      <rect x="44" y="92" width="212" height="170" rx="4" fill="none" stroke="#9c8a68" strokeWidth="4" />
      <path d="M70 130 l30 6 M200 230 l26 -8 M120 250 l40 -2" stroke="#b3a27f" strokeWidth="1.5" />
      <text x="150" y="152" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="30" fill="#b09a78">
        Welcome
      </text>
      <text x="150" y="196" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fill="#b8a585">
        Mara &amp; Finn
      </text>
      <text x="150" y="226" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fill="#c1b090">
        17 · 10 · 2026
      </text>
      <rect width="300" height="400" fill="#fff5dd" opacity="0.08" />
    </svg>
  );
}

/** The welcome sign artwork. Both looks share one frame so a wipe lines up. */
export function SignArt({ look }: { look: "first" | "reprint" }) {
  const uid = useId().replace(/:/g, "");
  if (look === "first") {
    return (
      <svg viewBox="0 0 400 560" width="100%" height="100%" role="img" aria-label="Welcome sign, first print">
        <rect width="400" height="560" fill="#f1eadb" />
        <rect x="22" y="22" width="356" height="516" fill="none" stroke="#c8baa0" strokeWidth="1.5" />
        <g stroke="#9fae8f" strokeWidth="2" fill="none" opacity="0.8">
          <path d="M150 120 Q200 90 250 120" />
          <path d="M170 110 q-6 -14 -18 -16 M188 102 q-2 -14 -12 -20 M212 102 q2 -14 12 -20 M230 110 q6 -14 18 -16" />
        </g>
        <text x="200" y="210" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="52" fill="#9a8466">
          Welcome
        </text>
        <text x="200" y="258" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fill="#a59274" letterSpacing="1">
          to the wedding of
        </text>
        <text x="200" y="330" textAnchor="middle" fontFamily="Georgia, serif" fontSize="40" fill="#8f7b5f">
          Mara &amp; Finn
        </text>
        <path d="M150 370 H250" stroke="#c8baa0" strokeWidth="1.5" />
        <text x="200" y="404" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fill="#a59274">
          17 · 10 · 2026
        </text>
        <text x="200" y="470" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="14" fill="#b3a386">
          The Orchard
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 560" width="100%" height="100%" role="img" aria-label="Welcome sign, reprint">
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f4232" />
          <stop offset="1" stopColor="#15301f" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6c77e" />
          <stop offset="1" stopColor="#b68a3e" />
        </linearGradient>
      </defs>
      <rect width="400" height="560" fill={`url(#${uid}-g)`} />
      <path d="M52 520 V200 A148 148 0 0 1 348 200 V520Z" fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="3" />
      <path d="M64 510 V204 A136 136 0 0 1 336 204 V510Z" fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="1" opacity="0.7" />
      <g stroke={`url(#${uid}-gold)`} strokeWidth="2.4" fill="none">
        <path d="M140 132 Q200 96 260 132" />
        <path d="M162 120 q-8 -18 -22 -20 M184 110 q-3 -18 -15 -26 M216 110 q3 -18 15 -26 M238 120 q8 -18 22 -20" />
      </g>
      <text x="200" y="210" textAnchor="middle" fontFamily="Georgia, serif" fontSize="17" fill="#e9dfc6" letterSpacing="1">
        Welcome to the wedding of
      </text>
      <text x="200" y="290" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="64" fill="#f4ecd8">
        Mara
      </text>
      <text x="200" y="336" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="34" fill={`url(#${uid}-gold)`}>
        &amp;
      </text>
      <text x="200" y="400" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="64" fill="#f4ecd8">
        Finn
      </text>
      <path d="M150 436 H250" stroke={`url(#${uid}-gold)`} strokeWidth="1.5" />
      <text x="200" y="470" textAnchor="middle" fontFamily="Georgia, serif" fontSize="16" fill="#e6c77e">
        Saturday 17 October 2026
      </text>
      <text x="200" y="494" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="14" fill="#cdbf9f">
        The Orchard
      </text>
    </svg>
  );
}
