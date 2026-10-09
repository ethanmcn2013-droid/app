import type { ReactNode, SVGProps } from "react";
import type { ToolId } from "./data";

/* Line glyphs on a 24 grid, 1.75 stroke. One drawing per tool. */

const TOOL: Record<ToolId, ReactNode> = {
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12 2.4 2.4 4.6-5" />
    </>
  ),
  seating: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="4.2" r="1.3" />
      <circle cx="12" cy="19.8" r="1.3" />
      <circle cx="4.2" cy="12" r="1.3" />
      <circle cx="19.8" cy="12" r="1.3" />
      <circle cx="6.5" cy="6.5" r="1.1" />
      <circle cx="17.5" cy="17.5" r="1.1" />
    </>
  ),
  guests: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.7.6 2.7 2.2 3 4.7" />
    </>
  ),
  dayplan: (
    <>
      <path d="M6 3.5v17" />
      <circle cx="6" cy="7" r="1.6" />
      <circle cx="6" cy="13" r="1.6" />
      <path d="M10 7h10M10 13h7M10 18.5h9" />
    </>
  ),
  suppliers: (
    <>
      <path d="M5.5 4.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a1.8 1.8 0 0 1-1.9 1.8A14.5 14.5 0 0 1 3.7 6.4 1.8 1.8 0 0 1 5.5 4.5Z" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M9.5 3h5M18.5 6.5l1.2-1.2" />
    </>
  ),
  outline: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6Z" />
      <path d="M14 3.5V8.5h5M9 12h7M9 15.5h7M9 19h4" />
    </>
  ),
  split: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8l5.7 5.6M12 12l-6.9 4" />
    </>
  ),
  study: (
    <>
      <path d="M4 6.5c2.6-1 5.3-.9 8 .6 2.7-1.5 5.4-1.6 8-.6v12c-2.6-1-5.3-.9-8 .6-2.7-1.5-5.4-1.6-8-.6Z" />
      <path d="M12 7.1v12" />
    </>
  ),
  social: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="9" cy="14.5" r="1" />
      <circle cx="15" cy="14.5" r="1" />
    </>
  ),
  press: (
    <>
      <path d="M4 5.5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M17 9h3v9.5a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4" />
    </>
  ),
  proofs: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="m7 16 3.3-4 2.4 2.7L14.5 12l2.5 4Z" />
      <circle cx="9" cy="8" r="1.4" />
    </>
  ),
  notes: (
    <>
      <path d="M5 4h10l4 4v12H5Z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  files: (
    <>
      <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </>
  ),
  budget: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.2h6" />
    </>
  ),
  forms: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3.8a8.2 8.2 0 0 0-7 12.4L4 20l3.9-1a8.2 8.2 0 1 0 4.1-15.2Z" />
      <path d="M9 9.5c.2 2.4 2.6 4.8 5 5" />
    </>
  ),
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function ToolGlyph({ tool, size }: { tool: ToolId; size?: number }) {
  return <Svg size={size}>{TOOL[tool]}</Svg>;
}

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Svg>
);
export const WidenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />
  </Svg>
);
export const NarrowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
  </Svg>
);
export const GripIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={0} fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </Svg>
);
export const SendIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h13M12.5 6.5 18 12l-5.5 5.5" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 4.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a1.8 1.8 0 0 1-1.9 1.8A14.5 14.5 0 0 1 3.7 6.4 1.8 1.8 0 0 1 5.5 4.5Z" />
  </Svg>
);
export const MessageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h.5a2 2 0 0 1-2-2Z" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 4 4" />
  </Svg>
);
export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3Z" />
    <path d="M12 10v4.2M12 17h.01" />
  </Svg>
);
export const BenchIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="M9.5 5v14M15 5v14" />
  </Svg>
);
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5Z" />
  </Svg>
);
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5.5v13M15 5.5v13" />
  </Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h9a5 5 0 0 1 0 10h-2" />
  </Svg>
);
export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6" />
  </Svg>
);
