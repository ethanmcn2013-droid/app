import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  plus: (p: IconProps) => (
    <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>
  ),
  chevronDown: (p: IconProps) => (
    <Svg {...p}><path d="m4.5 6.25 3.5 3.5 3.5-3.5" /></Svg>
  ),
  arrowRight: (p: IconProps) => (
    <Svg {...p}><path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" /></Svg>
  ),
  play: (p: IconProps) => (
    <Svg {...p}><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" /></Svg>
  ),
  pause: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 3.75v8.5M10.5 3.75v8.5" strokeWidth={2} /></Svg>
  ),
  rewind: (p: IconProps) => (
    <Svg {...p}><path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.8" /><path d="M2.5 2.75v2.5H5" /><path d="M8 5.5V8l1.75 1.25" /></Svg>
  ),
  clock: (p: IconProps) => (
    <Svg {...p}><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.25" /></Svg>
  ),
  hourglass: (p: IconProps) => (
    <Svg {...p}><path d="M4.5 2.5h7M4.5 13.5h7M5.25 2.5c0 3 5.5 3.25 5.5 5.5s-5.5 2.5-5.5 5.5M10.75 2.5c0 3-5.5 3.25-5.5 5.5s5.5 2.5 5.5 5.5" /></Svg>
  ),
  back: (p: IconProps) => (
    <Svg {...p}><path d="M6 4.5 2.75 7.75 6 11" /><path d="M3 7.75h6.5a3.75 3.75 0 0 1 0 7.5H8" transform="translate(0 -2.5)" /></Svg>
  ),
  bell: (p: IconProps) => (
    <Svg {...p}><path d="M4 11V7.25a4 4 0 0 1 8 0V11l1 1.25H3z" /><path d="M6.75 13.75a1.4 1.4 0 0 0 2.5 0" /></Svg>
  ),
  split: (p: IconProps) => (
    <Svg {...p}><path d="M8 13.5V8.5M8 8.5 4 4.5M8 8.5l4-4M4 7V4.5h2.5M12 7V4.5H9.5" /></Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}><path d="m3.5 8.25 3 3 6-6.5" /></Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}><path d="m4 4 8 8M12 4l-8 8" /></Svg>
  ),
  stack: (p: IconProps) => (
    <Svg {...p}><rect x="3" y="6" width="10" height="7.5" rx="1.5" /><path d="M4.5 4h7M6 2h4" /></Svg>
  ),
  pool: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.4v.1" /></Svg>
  ),
  leaf: (p: IconProps) => (
    <Svg {...p}><path d="M3 13c0-6 4-9.5 10-10-.5 6-4 10-10 10z" /><path d="M3 13 9 7" /></Svg>
  ),
  filter: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 4h11M4.5 8h7M6.5 12h3" /></Svg>
  ),
  moveOn: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 8h8M7.5 4.5 11 8l-3.5 3.5M13.5 3.5v9" /></Svg>
  ),
  undo: (p: IconProps) => (
    <Svg {...p}><path d="M5.5 3.5 2.75 6.25 5.5 9" /><path d="M3 6.25h6.25a3.75 3.75 0 0 1 0 7.5H7" /></Svg>
  ),
  sparkle: (p: IconProps) => (
    <Svg {...p}><path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.25 4.25l1.5 1.5M10.25 10.25l1.5 1.5M11.75 4.25l-1.5 1.5M5.75 10.25l-1.5 1.5" /></Svg>
  ),
};
