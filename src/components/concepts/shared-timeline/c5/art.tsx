/* Photo stand-ins, drawn by hand in SVG. Colours come from the --dp-art-*
   properties on the root so each scene softens for the dark theme. They
   are decorative: the caption beneath carries the meaning. */

import type { Art } from "./data";
import s from "./c5.module.css";

export function Scene({ art }: { art: Art }) {
  return (
    <svg viewBox="0 0 640 300" className={s.sceneSvg} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {art === "river" && <River />}
      {art === "band" && <Band />}
      {art === "table" && <Table />}
      {art === "wheel" && <Wheel />}
      {art === "post" && <Post />}
      {art === "hall" && <River />}
    </svg>
  );
}

function River() {
  return (
    <g>
      <defs>
        <linearGradient id="dp-river-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--dp-art-sky-hi)" />
          <stop offset="1" stopColor="var(--dp-art-sky)" />
        </linearGradient>
        <linearGradient id="dp-river-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--dp-art-water-hi)" />
          <stop offset="1" stopColor="var(--dp-art-water)" />
        </linearGradient>
      </defs>
      <rect width="640" height="300" fill="url(#dp-river-sky)" />
      {/* rain */}
      <g stroke="var(--dp-art-rain)" strokeWidth="1.2" strokeLinecap="round">
        {Array.from({ length: 34 }, (_, i) => {
          const x = (i * 83) % 640;
          const y = (i * 37) % 120;
          return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} />;
        })}
      </g>
      <path d="M0 150 C 90 104 150 118 230 96 S 380 70 460 104 S 590 96 640 84 V 300 H 0 Z" fill="var(--dp-art-far)" />
      <path d="M0 184 C 110 150 200 170 300 150 S 500 140 640 158 V 300 H 0 Z" fill="var(--dp-art-mid)" />
      {/* trees */}
      <g fill="var(--dp-art-tree)">
        {[40, 72, 100, 486, 520, 556, 600].map((x, i) => (
          <path key={x} d={`M${x} ${176 - (i % 3) * 6} l14 -${40 + (i % 2) * 12} l14 ${40 + (i % 2) * 12} z`} />
        ))}
      </g>
      {/* bridge */}
      <path d="M372 168 H 558 V 204 H 540 C 534 184 506 174 465 174 C 424 174 396 184 390 204 H 372 Z" fill="var(--dp-art-stone)" />
      <path d="M362 166 H 568 V 172 H 362 Z" fill="var(--dp-art-stone-dk)" />
      {/* river */}
      <path d="M-10 300 C 120 250 240 236 330 210 S 470 184 600 188 L 640 190 V 206 C 520 206 420 222 380 244 S 280 300 250 300 Z" fill="url(#dp-river-water)" />
      <g stroke="var(--dp-art-glint)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M120 272 q 20 -6 40 0" />
        <path d="M232 244 q 16 -5 32 0" />
        <path d="M340 222 q 14 -4 28 0" />
        <path d="M450 204 q 12 -3 24 0" />
      </g>
      <path d="M0 300 C 90 262 200 250 250 300 Z" fill="var(--dp-art-near)" />
      <path d="M640 212 C 560 214 480 236 430 300 H 640 Z" fill="var(--dp-art-near)" />
      {/* the tape across the water */}
      <path d="M214 250 L 470 226" stroke="var(--dp-art-tape)" strokeWidth="2.5" />
      <g stroke="var(--dp-art-ink)" strokeWidth="1">
        {Array.from({ length: 12 }, (_, i) => {
          const x = 226 + i * 20.5;
          const y = 250 - (i + 0.6) * 1.93;
          return <line key={i} x1={x} y1={y - 3} x2={x} y2={y + 3} />;
        })}
      </g>
      <Student x={206} y={250} coat="var(--dp-art-coat-a)" />
      <Student x={478} y={226} coat="var(--dp-art-coat-b)" flip />
      <Student x={560} y={238} coat="var(--dp-art-coat-c)" />
    </g>
  );
}

function Student({ x, y, coat, flip }: { x: number; y: number; coat: string; flip?: boolean }) {
  const f = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${f} 1)`}>
      <rect x="-5" y="4" width="4.5" height="16" rx="2" fill="var(--dp-art-boot)" />
      <rect x="1" y="4" width="4.5" height="16" rx="2" fill="var(--dp-art-boot)" />
      <path d="M-9 6 C -9 -14 9 -14 9 6 Z" fill={coat} />
      <path d="M8 -4 L 16 0" stroke={coat} strokeWidth="4" strokeLinecap="round" />
      <circle cx="0" cy="-17" r="6.5" fill="var(--dp-art-skin)" />
      <path d="M-7 -18 C -7 -27 7 -27 7 -18 Z" fill={coat} />
    </g>
  );
}

function Band() {
  const bulbs = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    const x = 30 + t * 580;
    const y = 50 + Math.sin(t * Math.PI) * 44 - (i % 2) * 2;
    return { x, y };
  });
  return (
    <g>
      <defs>
        <radialGradient id="dp-band-glow" cx="0.5" cy="0.62" r="0.6">
          <stop offset="0" stopColor="var(--dp-art-warm)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--dp-art-barn)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="300" fill="var(--dp-art-barn)" />
      {/* barn beams */}
      <g stroke="var(--dp-art-beam)" strokeWidth="10">
        <path d="M0 40 L 320 -30 L 640 40" fill="none" />
        <line x1="120" y1="0" x2="120" y2="300" />
        <line x1="520" y1="0" x2="520" y2="300" />
      </g>
      <rect width="640" height="300" fill="url(#dp-band-glow)" />
      <path d={`M30 50 ${bulbs.map((b) => `L${b.x} ${b.y}`).join(" ")}`} stroke="var(--dp-art-wire)" strokeWidth="1.2" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y + 6} r="9" fill="var(--dp-art-warm)" opacity="0.25" />
          <circle cx={b.x} cy={b.y + 6} r="3.6" fill="var(--dp-art-bulb)" />
        </g>
      ))}
      {/* stage */}
      <path d="M40 236 H 600 L 620 300 H 20 Z" fill="var(--dp-art-stage)" />
      <rect x="40" y="228" width="560" height="10" fill="var(--dp-art-stage-hi)" />
      {/* players */}
      <Player x={130} kind="fiddle" />
      <Player x={235} kind="guitar" />
      <Player x={320} kind="mic" />
      <Player x={410} kind="bass" />
      <g transform="translate(508 0)">
        <ellipse cx="0" cy="214" rx="30" ry="8" fill="var(--dp-art-drum)" />
        <rect x="-30" y="196" width="60" height="18" fill="var(--dp-art-drum-side)" />
        <ellipse cx="0" cy="196" rx="30" ry="8" fill="var(--dp-art-drum)" />
        <line x1="-40" y1="176" x2="-22" y2="176" stroke="var(--dp-art-bulb)" strokeWidth="3" />
        <path d="M-6 190 C -6 150 22 150 22 190 Z" fill="var(--dp-art-silhouette)" />
        <circle cx="8" cy="146" r="10" fill="var(--dp-art-silhouette)" />
      </g>
    </g>
  );
}

function Player({ x, kind }: { x: number; kind: "fiddle" | "guitar" | "mic" | "bass" }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M-16 232 L -12 176 C -12 150 12 150 12 176 L 16 232 Z" fill="var(--dp-art-silhouette)" />
      <circle cx="0" cy="138" r="12" fill="var(--dp-art-silhouette)" />
      {kind === "guitar" && (
        <g>
          <ellipse cx="-2" cy="196" rx="16" ry="13" fill="var(--dp-art-wood)" />
          <line x1="8" y1="190" x2="40" y2="160" stroke="var(--dp-art-wood)" strokeWidth="4" />
        </g>
      )}
      {kind === "bass" && (
        <g>
          <ellipse cx="0" cy="200" rx="14" ry="16" fill="var(--dp-art-wood)" />
          <line x1="4" y1="186" x2="30" y2="140" stroke="var(--dp-art-wood)" strokeWidth="4" />
        </g>
      )}
      {kind === "fiddle" && <path d="M10 156 l 26 -12 l 3 6 l -26 12 z" fill="var(--dp-art-wood)" />}
      {kind === "mic" && (
        <g>
          <line x1="0" y1="232" x2="0" y2="150" stroke="var(--dp-art-wire)" strokeWidth="2" transform="translate(22 0)" />
          <circle cx="22" cy="146" r="4" fill="var(--dp-art-bulb)" />
        </g>
      )}
    </g>
  );
}

function Table() {
  const places = [110, 210, 310, 410, 510];
  return (
    <g>
      <rect width="640" height="300" fill="var(--dp-art-linen-bg)" />
      <path d="M0 0 H 640 V 60 C 520 76 120 76 0 60 Z" fill="var(--dp-art-orchard)" />
      <g fill="var(--dp-art-tree)">
        {[40, 130, 230, 330, 430, 530, 610].map((x, i) => (
          <circle key={x} cx={x} cy={30 + (i % 2) * 8} r={34} opacity={0.9} />
        ))}
      </g>
      <g fill="var(--dp-art-apple)">
        {[58, 144, 250, 342, 452, 544].map((x, i) => (
          <circle key={x} cx={x} cy={40 + (i % 3) * 7} r={4} />
        ))}
      </g>
      {/* table */}
      <path d="M40 110 H 600 L 640 300 H 0 Z" fill="var(--dp-art-linen)" />
      <path d="M40 110 H 600" stroke="var(--dp-art-linen-edge)" strokeWidth="2" />
      <path d="M320 110 L 320 300" stroke="var(--dp-art-runner)" strokeWidth="60" opacity="0.5" />
      {places.map((x, i) => (
        <g key={x}>
          <ellipse cx={x + (x - 320) * 0.25} cy={172} rx={34} ry={14} fill="var(--dp-art-plate)" stroke="var(--dp-art-linen-edge)" />
          <ellipse cx={x + (x - 320) * 0.25} cy={172} rx={20} ry={8} fill={i % 2 ? "var(--dp-art-food-a)" : "var(--dp-art-food-b)"} />
          <ellipse cx={x + (x - 320) * 0.5} cy={252} rx={46} ry={19} fill="var(--dp-art-plate)" stroke="var(--dp-art-linen-edge)" />
          <ellipse cx={x + (x - 320) * 0.5} cy={252} rx={26} ry={10} fill={i % 2 ? "var(--dp-art-food-b)" : "var(--dp-art-food-a)"} />
          <path d={`M${x + (x - 320) * 0.35 + 40} 190 v 26`} stroke="var(--dp-art-glass)" strokeWidth="2" />
          <path d={`M${x + (x - 320) * 0.35 + 32} 178 h 16 l -3 14 h -10 z`} fill="var(--dp-art-cider)" opacity="0.8" />
        </g>
      ))}
      {/* candles */}
      {[260, 380].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={112} width={6} height={34} fill="var(--dp-art-plate)" />
          <path d={`M${x} 100 c 4 5 4 9 0 12 c -4 -3 -4 -7 0 -12 z`} fill="var(--dp-art-bulb)" />
        </g>
      ))}
    </g>
  );
}

function Wheel() {
  return (
    <g>
      <rect width="640" height="300" fill="var(--dp-art-studio)" />
      {/* shelves of pots */}
      <g>
        {[70, 150].map((y) => (
          <g key={y}>
            <rect x="30" y={y} width="580" height="6" fill="var(--dp-art-shelf)" />
            {Array.from({ length: 9 }, (_, i) => {
              const x = 60 + i * 64;
              const h = 24 + ((i * 7 + y) % 3) * 8;
              return (
                <path
                  key={i}
                  d={`M${x - 12} ${y} C ${x - 18} ${y - h * 0.5} ${x - 10} ${y - h} ${x - 6} ${y - h} H ${x + 6} C ${x + 10} ${y - h} ${x + 18} ${y - h * 0.5} ${x + 12} ${y} Z`}
                  fill={i % 3 === 0 ? "var(--dp-art-glaze-a)" : i % 3 === 1 ? "var(--dp-art-glaze-b)" : "var(--dp-art-clay)"}
                />
              );
            })}
          </g>
        ))}
      </g>
      <rect x="0" y="210" width="640" height="90" fill="var(--dp-art-bench)" />
      {/* wheel */}
      <ellipse cx="320" cy="238" rx="120" ry="22" fill="var(--dp-art-wheel)" />
      <ellipse cx="320" cy="230" rx="100" ry="16" fill="var(--dp-art-wheel-top)" />
      {/* the pot */}
      <path d="M280 230 C 270 196 284 176 300 170 C 306 162 334 162 340 170 C 356 176 370 196 360 230 Z" fill="var(--dp-art-clay)" />
      <ellipse cx="320" cy="169" rx="21" ry="5" fill="var(--dp-art-clay-dk)" />
      <g stroke="var(--dp-art-clay-dk)" strokeWidth="1" fill="none" opacity="0.6">
        <path d="M284 206 q 36 8 72 0" />
        <path d="M280 190 q 40 8 80 0" />
      </g>
      {/* hands */}
      <path d="M200 206 C 240 196 262 196 280 202 C 286 206 284 214 276 214 C 256 214 236 220 210 226 Z" fill="var(--dp-art-skin)" />
      <path d="M440 206 C 400 196 378 196 360 202 C 354 206 356 214 364 214 C 384 214 404 220 430 226 Z" fill="var(--dp-art-skin)" />
      <g stroke="var(--dp-art-motion)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M214 252 q 106 22 212 0" />
        <path d="M240 262 q 80 14 160 0" opacity="0.6" />
      </g>
    </g>
  );
}

function Post() {
  return (
    <g>
      <rect width="640" height="300" fill="var(--dp-art-sky)" />
      <path d="M0 210 H 640 V 300 H 0 Z" fill="var(--dp-art-path)" />
      {/* post box */}
      <g transform="translate(420 0)">
        <rect x="0" y="70" width="110" height="180" rx="10" fill="var(--dp-art-postbox)" />
        <path d="M0 90 C 0 44 110 44 110 90 Z" fill="var(--dp-art-postbox)" />
        <rect x="20" y="110" width="70" height="10" rx="5" fill="var(--dp-art-ink)" />
        <rect x="30" y="150" width="50" height="34" rx="3" fill="var(--dp-art-plate)" opacity="0.9" />
        <rect x="-6" y="244" width="122" height="14" rx="3" fill="var(--dp-art-postbox-dk)" />
      </g>
      {/* bundle of envelopes */}
      <g transform="translate(120 132) rotate(-6)">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${i * 6} ${-i * 12})`}>
            <rect x="0" y="0" width="200" height="120" rx="4" fill="var(--dp-art-env)" stroke="var(--dp-art-env-edge)" />
            <path d="M0 0 L 100 64 L 200 0" fill="none" stroke="var(--dp-art-env-edge)" />
          </g>
        ))}
        <rect x="24" y="-48" width="80" height="6" rx="3" fill="var(--dp-art-env-edge)" transform="translate(0 0)" />
        <rect x="24" y="-36" width="120" height="6" rx="3" fill="var(--dp-art-env-edge)" />
        <rect x="170" y="-40" width="26" height="30" rx="2" fill="var(--dp-art-stamp)" />
        <path d="M0 26 H 224" stroke="var(--dp-art-twine)" strokeWidth="3" transform="translate(0 -30)" />
        <path d="M112 -60 V 120" stroke="var(--dp-art-twine)" strokeWidth="3" />
      </g>
    </g>
  );
}
