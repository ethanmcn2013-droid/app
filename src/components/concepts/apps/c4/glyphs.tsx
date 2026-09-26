/* Ask for a tool: a small, consistent line-icon set (20px grid, 1.6 stroke). */

import type { Glyph } from "./data";

const P: Record<Glyph, string> = {
  guests: "M7.5 9.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2.5 16c.5-2.6 2.6-4.25 5-4.25s4.5 1.65 5 4.25M13.25 4.4a2.6 2.6 0 0 1 0 4.9M14.5 11.9c1.6.45 2.75 1.85 3 4.1",
  form: "M5 3h10v14H5zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h3",
  seating: "M10 13.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.05 1.05M14.25 14.25l1.05 1.05M4.7 15.3l1.05-1.05M14.25 5.75l1.05-1.05",
  clock: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 5.75V10l2.75 1.75",
  list: "M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.5 5.5h.5M3.5 10h.5M3.5 14.5h.5",
  timer: "M10 17.5a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5ZM10 8.5v3M8 2.5h4M15 5.5l1.25-1.25",
  wallet: "M3 6.5A2 2 0 0 1 5 4.5h9.5v3M3 6.5v8a2 2 0 0 0 2 2h11V7.5H5a2 2 0 0 1-2-1ZM13.25 12h.5",
  coins: "M8 8.5c2.9 0 5.25-1.1 5.25-2.5S10.9 3.5 8 3.5 2.75 4.6 2.75 6 5.1 8.5 8 8.5ZM2.75 6v4c0 1.4 2.35 2.5 5.25 2.5M2.75 10v4c0 1.4 2.35 2.5 5.25 2.5M12 11.5c2.9 0 5.25-1.1 5.25-2.5M17.25 9v5c0 1.4-2.35 2.5-5.25 2.5S6.75 15.4 6.75 14",
  receipt: "M5 2.75h10v14.5l-2-1.25-1.75 1.25L10 16l-1.25 1.25L7 16l-2 1.25zM7.5 6.5h5M7.5 9.5h5M7.5 12.5h2.5",
  hourglass: "M5.5 2.75h9M5.5 17.25h9M6.5 2.75c0 3.5 3.5 4.75 3.5 7.25S6.5 13.75 6.5 17.25M13.5 2.75c0 3.5-3.5 4.75-3.5 7.25s3.5 3.75 3.5 7.25",
  check: "M4 10.5l3.5 3.5L16 5.5",
  megaphone: "M3 8v4h3l6 3.75V4.25L6 8zM6 12l1 4.25h2.25L8.5 12.6M15 7.5a3.5 3.5 0 0 1 0 5",
  split: "M3 4h14v12H3zM10 4v12M5.5 7.5h2M12.5 7.5h2M5.5 10.5h2",
  calendar: "M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5",
  mail: "M2.75 4.75h14.5v10.5H2.75zM3 5l7 6 7-6",
  chat: "M10 16.5a6.5 6.5 0 1 0-5.75-3.45L3.5 16.5l3.6-.8A6.47 6.47 0 0 0 10 16.5Z",
  forward: "M11.5 4.5 16.5 9.5 11.5 14.5M16.5 9.5H8a4.5 4.5 0 0 0-4.5 4.5v1.5",
  note: "M4.5 2.75h7.25L15.5 6.5v10.75h-11zM11.5 2.75V6.75h4M7 10h6M7 13h4",
  book: "M4 4.25A1.75 1.75 0 0 1 5.75 2.5H16v12.25H5.75A1.75 1.75 0 0 0 4 16.5zM4 16.5a1.75 1.75 0 0 0 1.75 1.75H16",
  chart: "M3 16.5h14M5.5 13.5v-3M9 13.5V6.5M12.5 13.5v-5M16 13.5V4.5",
  card: "M2.75 5h14.5v10H2.75zM2.75 8.5h14.5M5.5 12.25h3",
  folder: "M2.75 5.25a1.5 1.5 0 0 1 1.5-1.5h3.5l1.75 2h6.25a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H4.25a1.5 1.5 0 0 1-1.5-1.5z",
  rota: "M3.5 4.5h13v12h-13zM3.5 8h13M3.5 11.5h13M8 8v8.5M12 8v8.5",
  press: "M3 4.5h11v11.5H5a2 2 0 0 1-2-2zM14 7.5h3v7a1.5 1.5 0 0 1-3 0M5.75 7.5h5.5M5.75 10.5h5.5M5.75 13.25h3.5",
  sun: "M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 1.75v1.75M10 16.5v1.75M1.75 10H3.5M16.5 10h1.75M4.2 4.2l1.2 1.2M14.6 14.6l1.2 1.2M4.2 15.8l1.2-1.2M14.6 5.4l1.2-1.2",
  template: "M3 3.5h6v6H3zM11 3.5h6v3.5h-6zM11 9.5h6v7h-6zM3 12h6v4.5H3z",
  grid: "M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3.5M13 3v3.5M6.5 11.5h1M9.5 11.5h1M12.5 11.5h1M6.5 14h1M9.5 14h1",
  gift: "M3 7.5h14v3H3zM4.25 10.5h11.5v6.5H4.25zM10 7.5V17M10 7.5S8.75 3.5 6.75 4.25 7 7.5 10 7.5ZM10 7.5s1.25-4 3.25-3.25S13 7.5 10 7.5Z",
};

export function ToolGlyph({ g, size = 20 }: { g: Glyph; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[g]} />
    </svg>
  );
}

type I = { size?: number };
const svg = (size: number, d: string, sw = 1.6) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const ChevronDown = ({ size = 14 }: I) => svg(size, "M5.5 8l4.5 4.5L14.5 8", 1.8);
export const ArrowUp = ({ size = 14 }: I) => svg(size, "M10 16V4.5M5 9.25l5-5 5 5", 1.8);
export const ArrowDown = ({ size = 14 }: I) => svg(size, "M10 4v11.5M5 10.75l5 5 5-5", 1.8);
export const ReturnKey = ({ size = 14 }: I) => svg(size, "M16 4.5v5.25a2 2 0 0 1-2 2H4.5M8 8l-3.5 3.75L8 15.5", 1.8);
export const Close = ({ size = 14 }: I) => svg(size, "M5 5l10 10M15 5L5 15", 1.8);
export const Check = ({ size = 14 }: I) => svg(size, "M4.5 10.5l3.5 3.5 7.5-8", 2);
export const Pin = ({ size = 14 }: I) => svg(size, "M7.5 3h5l-.75 5.25 2.75 2.5v1.5h-9v-1.5l2.75-2.5zM10 12.25V17.5");
export const Play = ({ size = 14 }: I) => svg(size, "M6.5 4.5v11l9-5.5z");
export const Pause = ({ size = 14 }: I) => svg(size, "M7 4.5v11M13 4.5v11", 2.2);
export const Reset = ({ size = 14 }: I) => svg(size, "M4 10a6 6 0 1 0 1.9-4.4M4 3.75v3.75h3.75");
export const Plus = ({ size = 14 }: I) => svg(size, "M10 4v12M4 10h12", 1.8);
export const Minus = ({ size = 14 }: I) => svg(size, "M4 10h12", 1.8);
export const Source = ({ size = 14 }: I) => svg(size, "M4.5 2.75h7.25L15.5 6.5v10.75h-11zM11.5 2.75V6.75h4M7 10.5h6M7 13.5h4");
export const Link = ({ size = 14 }: I) => svg(size, "M8.5 11.5l3-3M7 9.5 5.25 11.25a2.5 2.5 0 0 0 3.5 3.5L10.5 13M13 10.5l1.75-1.75a2.5 2.5 0 0 0-3.5-3.5L9.5 7");
export const Arrow = ({ size = 14 }: I) => svg(size, "M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5", 1.8);
export const Undo = ({ size = 14 }: I) => svg(size, "M7.5 5.5 4 9l3.5 3.5M4 9h8a4 4 0 0 1 0 8h-1.5", 1.7);
