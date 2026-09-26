import type { GlyphId } from "./data";

/* Hand-drawn 24px line glyphs, one per tool. Stroke only, currentColor. */
const P: Record<GlyphId, React.ReactNode> = {
  tasks: (<><circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.2 2.5 2.5 4.9-5.2" /></>),
  timeline: (<><path d="M3.5 12h17" /><circle cx="7" cy="12" r="1.8" /><circle cx="13" cy="12" r="1.8" /><path d="M18 8.5v7" /><path d="M7 7V5M13 19v-2" /></>),
  notes: (<><path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5z" /><path d="M14.5 3.5V7h3.5" /><path d="M9 11h6M9 14.5h6M9 18h3.5" /></>),
  files: (<><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></>),
  guests: (<><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M16 14.2c2.3.1 4 1.7 4.5 4.3" /></>),
  rsvp: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /><path d="m14.5 16.5 1.6 1.6 3.2-3.4" /></>),
  budget: (<><circle cx="12" cy="12" r="8.5" /><path d="M14.8 8.6a4 4 0 1 0 0 6.8" /><path d="M7.5 11h5.5M7.5 13.2h5.5" /></>),
  suppliers: (<><path d="M3.5 9.5 5 4.5h14l1.5 5" /><path d="M3.5 9.5c0 1.4 1.1 2.3 2.4 2.3s2.4-.9 2.4-2.3c0 1.4 1.1 2.3 2.4 2.3s2.3-.9 2.3-2.3c0 1.4 1.1 2.3 2.4 2.3s2.4-.9 2.4-2.3c0 1.4 1.1 2.3 2.2 2.3" /><path d="M5 12v7.5h14V12" /><path d="M10 19.5v-4.5h4v4.5" /></>),
  dayplan: (<><circle cx="8" cy="8" r="4.5" /><path d="M8 5.8V8l1.6 1.2" /><path d="M14.5 7h6M14.5 11h6M3.5 16h17M3.5 20h11" /></>),
  seating: (<><circle cx="12" cy="12" r="4" /><circle cx="12" cy="4.5" r="1.4" /><circle cx="12" cy="19.5" r="1.4" /><circle cx="4.5" cy="12" r="1.4" /><circle cx="19.5" cy="12" r="1.4" /><circle cx="6.7" cy="6.7" r="1.4" /><circle cx="17.3" cy="17.3" r="1.4" /></>),
  timer: (<><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V9.5M10 3.5h4M18.5 6.5l1.4-1.4" /></>),
  email: (<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>),
  whatsapp: (<><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z" /><path d="M9.3 9.2c.2 2.6 2.4 4.9 5.2 5.4l.9-1.3-1.8-.9-.8.8c-.9-.4-1.6-1.1-2-2l.8-.8-.9-1.8z" /></>),
  calsync: (<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M9 15.8a3 3 0 0 0 5.4 1M15 14.2a3 3 0 0 0-5.4-1" /><path d="m14.6 18.2-.2-1.4 1.4-.1M9.4 11.8l.2 1.4-1.4.1" /></>),
  checklist: (<><path d="m4 6.5 1.6 1.6L8.5 5M4 12.5l1.6 1.6 2.9-3.1M4.5 18.5h3" /><path d="M11.5 7h9M11.5 13h9M11.5 19h9" /></>),
  countdown: (<><path d="M6.5 3.5h11M6.5 20.5h11" /><path d="M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5" /><path d="M9.5 18.5h5" /></>),
  form: (<><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 3.5h6v2.5H9z" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" /></>),
  bookings: (<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="m9 14.8 2 2 4-4.2" /></>),
  runsheets: (<><path d="M4 5.5h3M4 10.5h3M4 15.5h3" /><path d="M9.5 5.5h10.5M9.5 10.5h10.5M9.5 15.5h10.5M9.5 20h6" /></>),
  deposits: (<><path d="M4 7.5h14.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2H16" /><path d="M20.5 11.5h-4a2 2 0 0 0 0 4h4" /></>),
  supplierbook: (<><path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6z" /><path d="M4 7.5h3.5M4 12h3.5M4 16.5h3.5" /><circle cx="13" cy="10" r="2.2" /><path d="M9.8 16c.5-1.8 1.7-2.7 3.2-2.7s2.7.9 3.2 2.7" /></>),
  enquiry: (<><path d="M3.5 13.5 6 5.5h12l2.5 8v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 13.5h5l1 2h5l1-2h5" /></>),
  rota: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" /><circle cx="6.5" cy="14.5" r="1" /><circle cx="12.3" cy="14.5" r="1" /></>),
  deadlines: (<><path d="M5.5 21V4" /><path d="M5.5 4.5h11.5l-2.5 4 2.5 4H5.5" /></>),
  groupsplit: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6.8 5M12 12l-6.8 5" /></>),
  sources: (<><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" /><path d="M9.5 8h5" /></>),
  studytimer: (<><circle cx="12" cy="13" r="7.5" /><path d="M12 13V8.5M12 13l3 2" /><path d="M9.5 3h5" /></>),
  shareddoc: (<><path d="M5.5 3.5h9l4 4v13h-13z" /><path d="M14.5 3.5v4h4" /><circle cx="10" cy="13" r="1.8" /><circle cx="14.5" cy="13" r="1.8" /><path d="M7.5 18.5c.4-1.3 1.3-2 2.5-2s2.1.7 2.5 2M12 18.5c.4-1.3 1.3-2 2.5-2s2.1.7 2.5 2" /></>),
  peercheck: (<><path d="M4 6.5h8.5v13H4z" /><path d="M8 4h8.5v4" /><path d="M11.5 4h8.5v10.5h-4" /><path d="m6 13.5 1.6 1.6 3-3.2" /></>),
  press: (<><path d="M4 10v4l3 .5 10 4.5V5L7 9.5z" /><path d="M7 14.5 8.5 20h3l-1.2-5" /><path d="M20 10v4" /></>),
  social: (<><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M12 15.5s-3-1.8-3-3.9A1.6 1.6 0 0 1 12 10.8a1.6 1.6 0 0 1 3 .8c0 2.1-3 3.9-3 3.9z" /></>),
  proofs: (<><path d="M5.5 3.5h9l4 4v13h-13z" /><path d="M14.5 3.5v4h4" /><path d="m9 14 2.2 2.2 4.3-4.6" /></>),
};

export function Glyph({ id, size = 20, dashed = false }: { id: GlyphId; size?: number; dashed?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "2.2 2.4" : undefined}
      aria-hidden="true"
      focusable="false"
    >
      {P[id]}
    </svg>
  );
}

export function Icon({ name, size = 16 }: { name: "chev" | "close" | "search" | "plus" | "check" | "lock" | "down" | "undo" | "open"; size?: number }) {
  const d: Record<typeof name, React.ReactNode> = {
    chev: <path d="m7 10 5 5 5-5" />,
    close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5.5 12.5 4 4 9-9.5" />,
    lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
    down: <path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" />,
    undo: <><path d="M9 7.5 5 11.5l4 4" /><path d="M5.5 11.5h8.5a5 5 0 0 1 0 10h-2" /></>,
    open: <><path d="M13.5 5.5H18.5V10.5" /><path d="M18.5 5.5l-7.5 7.5" /><path d="M16.5 14v4.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1H10" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {d[name]}
    </svg>
  );
}
