/**
 * Invented artwork for the concept: the welcome sign (v1 and v2), the
 * Kiln & Co mark (v4 and v5), bakery photo selects and a link preview.
 * These are pictures of files, so their colours are fixed, not themed.
 */

const SERIF = "Georgia, 'Times New Roman', serif";

function Backdrop() {
  return (
    <>
      <defs>
        <linearGradient id="c3wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ece7df" />
          <stop offset="1" stopColor="#ddd5c8" />
        </linearGradient>
        <radialGradient id="c3glow" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#fffaf1" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fffaf1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill="url(#c3wall)" />
      <rect width="640" height="360" fill="url(#c3glow)" />
      <rect y="304" width="640" height="56" fill="#cbbfab" />
      <rect y="304" width="640" height="2" fill="#b9ab94" />
      {/* easel */}
      <path d="M262 330 L300 40 M378 330 L340 40 M320 40 L320 340" stroke="#8a6a4a" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="320" cy="312" rx="120" ry="7" fill="#000" opacity="0.12" />
      {/* planters */}
      <rect x="84" y="262" width="54" height="46" rx="4" fill="#9c8468" />
      <circle cx="98" cy="246" r="20" fill="#6f8f5f" />
      <circle cx="122" cy="238" r="24" fill="#7c9d69" />
      <circle cx="112" cy="222" r="16" fill="#86a672" />
      <rect x="506" y="262" width="54" height="46" rx="4" fill="#9c8468" />
      <circle cx="520" cy="240" r="22" fill="#7c9d69" />
      <circle cx="544" cy="246" r="18" fill="#6f8f5f" />
      <circle cx="532" cy="224" r="15" fill="#86a672" />
    </>
  );
}

function Sprig({ x, y, flip = 1, color }: { x: number; y: number; flip?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <path d="M0 0 C 14 10, 30 14, 52 12" stroke={color} strokeWidth="1.6" fill="none" />
      {[8, 18, 28, 38, 48].map((d, i) => (
        <g key={d}>
          <ellipse cx={d} cy={i % 2 ? 2 : 13} rx="5" ry="2.4" fill={color} transform={`rotate(${i % 2 ? -30 : 30} ${d} ${i % 2 ? 2 : 13})`} />
        </g>
      ))}
    </g>
  );
}

export function WelcomeArt({ v }: { v: 1 | 2 }) {
  const card = v === 1 ? "#f4ede0" : "#2f4a36";
  const ink = v === 1 ? "#3d4a3a" : "#f1e6cc";
  const soft = v === 1 ? "#7a8274" : "#d7c9a6";
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img" aria-label={v === 1 ? "Welcome sign, version 1: cream card with sage sprigs" : "Welcome sign, version 2: orchard green with an apple branch and the date"}>
      <Backdrop />
      <rect x="226" y="30" width="188" height="262" rx="3" fill="#000" opacity="0.14" transform="translate(4 6)" />
      <rect x="226" y="30" width="188" height="262" rx="3" fill={card} />
      <rect x="236" y="40" width="168" height="242" rx="2" fill="none" stroke={soft} strokeWidth="0.8" opacity="0.8" />
      {v === 1 ? (
        <>
          <Sprig x={246} y={52} color="#8fa888" />
          <Sprig x={394} y={52} flip={-1} color="#8fa888" />
          <Sprig x={296} y={258} color="#a3b89c" />
        </>
      ) : (
        <g>
          <path d="M240 64 C 280 52, 330 58, 400 50" stroke="#6b4a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M300 57 C 306 66, 312 70, 318 72" stroke="#6b4a2e" strokeWidth="2" fill="none" />
          {[
            [262, 58, -20],
            [284, 50, 25],
            [330, 50, -30],
            [352, 60, 20],
            [382, 46, -15],
          ].map(([cx, cy, r]) => (
            <ellipse key={`${cx}`} cx={cx} cy={cy} rx="9" ry="4" fill="#7fa866" transform={`rotate(${r} ${cx} ${cy})`} />
          ))}
          <circle cx="318" cy="78" r="8" fill="#c8553d" />
          <circle cx="366" cy="64" r="7" fill="#d4693f" />
          <circle cx="272" cy="70" r="6.5" fill="#c8553d" />
          <circle cx="316" cy="75" r="2" fill="#f5b99a" opacity="0.7" />
        </g>
      )}
      <text x="320" y={v === 1 ? 128 : 136} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="34" fill={ink}>
        Welcome
      </text>
      <text x="320" y={v === 1 ? 152 : 160} textAnchor="middle" fontFamily={SERIF} fontSize="10.5" letterSpacing="2" fill={soft}>
        to the wedding of
      </text>
      <text x="320" y={v === 1 ? 196 : 200} textAnchor="middle" fontFamily={SERIF} fontSize={v === 1 ? 26 : 28} fill={ink}>
        Mara &amp; Finn
      </text>
      {v === 2 && (
        <>
          <line x1="292" y1="220" x2="348" y2="220" stroke={soft} strokeWidth="0.8" />
          <text x="320" y="240" textAnchor="middle" fontFamily={SERIF} fontSize="11" fill={ink}>
            Saturday 26 September 2026
          </text>
          <text x="320" y="258" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="10.5" fill={soft}>
            The Orchard
          </text>
        </>
      )}
    </svg>
  );
}

export function LogoArt({ v }: { v: 4 | 5 }) {
  const clay = "#9a4f32";
  const bg = "#efe7dc";
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img" aria-label={v === 4 ? "Kiln & Co logo, version 4: outlined arch, light serif" : "Kiln & Co logo, version 5: solid arch with a flame, heavier serif"}>
      <rect width="640" height="360" fill={bg} />
      <g opacity="0.5">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={i * 58} y1="0" x2={i * 58 - 60} y2="360" stroke="#e3d8ca" strokeWidth="1" />
        ))}
      </g>
      {v === 4 ? (
        <g fill="none" stroke={clay} strokeLinecap="round">
          <path d="M270 214 V 152 A 50 50 0 0 1 370 152 V 214" strokeWidth="7" />
          <path d="M292 214 V 156 A 28 28 0 0 1 348 156 V 214" strokeWidth="2.5" />
          <line x1="256" y1="214" x2="384" y2="214" strokeWidth="3" />
        </g>
      ) : (
        <g>
          <path d="M266 216 V 152 A 54 54 0 0 1 374 152 V 216 Z" fill={clay} />
          <path d="M320 208 C 296 196, 298 172, 312 158 C 312 172, 318 176, 322 176 C 318 162, 326 146, 338 138 C 336 156, 350 168, 346 188 C 344 200, 334 206, 320 208 Z" fill={bg} />
          <rect x="250" y="216" width="140" height="6" rx="1" fill={clay} />
        </g>
      )}
      <text x="320" y="276" textAnchor="middle" fontFamily={SERIF} fontSize={v === 4 ? 38 : 40} fontWeight={v === 4 ? 400 : 700} letterSpacing={v === 4 ? 1 : -0.5} fill="#3b2a22">
        Kiln &amp; Co
      </text>
      <text x="320" y="302" textAnchor="middle" fontFamily={SERIF} fontSize="11" letterSpacing="3" fill="#8a6f5e">
        ceramics, fired in Kilkenny
      </text>
    </svg>
  );
}

const PHOTO_BG = ["#d8c3a5", "#6d4c3d", "#e8e1d6", "#3e3a36", "#b89b7a", "#efe7dc", "#8c6a4f"];

export function PhotoThumb({ i }: { i: number }) {
  const bg = PHOTO_BG[i % PHOTO_BG.length];
  const kind = i % 5;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="100" height="100" fill={bg} />
      <rect width="100" height="100" fill="#fff" opacity={i % 2 ? 0.05 : 0} />
      <ellipse cx="52" cy="74" rx="34" ry="7" fill="#000" opacity="0.18" />
      {kind === 0 && (
        <g>
          <ellipse cx="50" cy="56" rx="34" ry="20" fill="#b8793e" />
          <ellipse cx="50" cy="52" rx="30" ry="15" fill="#c98d4f" />
          <path d="M30 50 q8 -8 14 0 M44 48 q8 -8 14 0 M58 50 q8 -8 12 0" stroke="#f0d5a8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 1 && (
        <g>
          {[
            [34, 54],
            [62, 50],
            [48, 66],
          ].map(([x, y]) => (
            <g key={`${x}`}>
              <circle cx={x} cy={y} r="14" fill="#c98d4f" />
              <path d={`M${x - 8} ${y - 2} q8 -8 16 0`} stroke="#f7e7c6" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>
      )}
      {kind === 2 && (
        <g>
          <circle cx="50" cy="54" r="22" fill="#f6f2ec" />
          <circle cx="50" cy="54" r="15" fill="#5b3a26" />
          <path d="M44 50 q6 6 12 0 q-6 -4 -12 0z" fill="#e8c9a1" />
          <path d="M72 50 q10 0 8 8 q-2 6 -9 5" stroke="#f6f2ec" strokeWidth="4" fill="none" />
        </g>
      )}
      {kind === 3 && (
        <g>
          <rect x="18" y="40" width="64" height="30" rx="8" fill="#5a3b28" />
          {Array.from({ length: 14 }, (_, k) => (
            <ellipse key={k} cx={24 + (k * 37) % 54} cy={46 + ((k * 13) % 18)} rx="1.6" ry="1" fill="#e8d7b0" />
          ))}
        </g>
      )}
      {kind === 4 && (
        <g>
          <path d="M20 62 Q 50 20, 80 62 Q 66 54, 50 58 Q 34 54, 20 62 Z" fill="#d49a52" />
          <path d="M34 52 L 40 40 M50 50 L 50 34 M66 52 L 60 40" stroke="#b97a36" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

export function LinkThumb() {
  return (
    <svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="160" height="110" fill="#dfe9ec" />
      <rect y="84" width="160" height="26" fill="#9fb48d" />
      <path d="M22 84 V 50 L 50 30 L 110 30 L 138 50 V 84 Z" fill="#fbfbf8" />
      <path d="M22 50 L 50 30 L 110 30 L 138 50 Z" fill="#f1f0ea" />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={28 + k * 27.5} y="54" width="22" height="30" fill="#bfe0ea" opacity="0.85" stroke="#9cc6d3" strokeWidth="0.8" />
      ))}
      <path d="M50 30 V 84 M110 30 V 84" stroke="#e1dfd6" strokeWidth="1" />
    </svg>
  );
}
