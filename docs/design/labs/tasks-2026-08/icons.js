/* One icon set for all three directions, drawn on a 24 grid at 1.6 stroke so
 * the rail, the toolbar and the cards can never disagree about weight. The
 * three product glyphs match the shipped rail-icons.tsx silhouettes so the
 * chrome comparison is honest. */
window.ICON = (function () {
  const s = (d, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra || ""}</svg>`;

  return {
    notes: s('<rect x="5" y="3" width="12" height="18" rx="2"/><path d="M8.5 8h5M8.5 12h5M8.5 16h3"/><circle cx="19" cy="7" r="1.4" fill="currentColor" stroke="none"/>'),
    tasks: s('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.4l2.4 2.4L16 9.6"/>'),
    timeline: s('<path d="M4 16h4.5a3 3 0 0 0 3-3V11a3 3 0 0 1 3-3H20"/><circle cx="4" cy="16" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="8" r="1.6" fill="currentColor" stroke="none"/>'),
    more: s('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><circle cx="16.75" cy="16.75" r="2.2" fill="currentColor" stroke="none"/>'),
    home: s('<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>'),
    inbox: s('<path d="M4 13h4l1.2 2.2h5.6L16 13h4"/><path d="M4 13 6.2 5.6A1.5 1.5 0 0 1 7.6 4.5h8.8a1.5 1.5 0 0 1 1.4 1.1L20 13v4.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/>'),
    work: s('<path d="M4 6.5h16M4 12h16M4 17.5h10"/>'),
    help: s('<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.4a2.4 2.4 0 1 1 3.1 2.6c-.6.2-.8.7-.8 1.3v.4"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>'),
    search: s('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.7-3.7"/>'),
    plus: s('<path d="M12 5.5v13M5.5 12h13"/>'),
    board: s('<rect x="4" y="4.5" width="6" height="15" rx="1.6"/><rect x="14" y="4.5" width="6" height="9.5" rx="1.6"/>'),
    list: s('<path d="M9 7h11M9 12h11M9 17h7"/><circle cx="5" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.1" fill="currentColor" stroke="none"/>'),
    schedule: s('<path d="M4 6.5h12M4 12h16M4 17.5h8"/>'),
    calendar: s('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    share: s('<circle cx="17.5" cy="6" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="m8.9 10.7 6.2-3.4M8.9 13.3l6.2 3.4"/>'),
    planning: s('<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M14.5 4.5v15"/>'),
    filter: s('<path d="M4.5 6h15l-5.8 6.8v5.4l-3.4 1.8v-7.2z"/>'),
    sort: s('<path d="M7 4.5v15M7 19.5 4.2 16.7M7 19.5l2.8-2.8"/><path d="M17 19.5v-15M17 4.5l-2.8 2.8M17 4.5l2.8 2.8"/>'),
    display: s('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M10 5v14"/>'),
    dots: s('<circle cx="5.5" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.35" fill="currentColor" stroke="none"/>'),
    check: s('<path d="m5.5 12.5 4.2 4.2L18.5 7.8"/>'),
    chevron: s('<path d="m8 10 4 4 4-4"/>'),
    chevronRight: s('<path d="m10 8 4 4-4 4"/>'),
    close: s('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
    comment: s('<path d="M20 12.5a6.5 6.5 0 0 1-6.5 6.5H9l-4 3v-3.6A6.5 6.5 0 0 1 4 12.5v-.5A6.5 6.5 0 0 1 10.5 5.5h3A6.5 6.5 0 0 1 20 12z"/>'),
    milestone: s('<path d="M12 4.2 19.8 12 12 19.8 4.2 12z"/>'),
    note: s('<path d="M6 4.5h9.5L19 8v11.5H6z"/><path d="M9.5 11h6M9.5 14.5h4"/>'),
    grip: s('<circle cx="9.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="17" r="1.2" fill="currentColor" stroke="none"/>'),
    panel: s('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9.5 5v14"/>'),
    clock: s('<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 1.8"/>'),
  };
})();
