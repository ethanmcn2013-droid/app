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
    /* A COG, not a sun. The first draft drew eight thin rays around a hub
       and at 19px that is a brightness control, not settings — the teeth
       have to be blocky and joined by a ring or the silhouette says the
       wrong word. Eight teeth on a closed outline, hub at r=3, rounded
       joins doing the softening so it still sits at 1.6 stroke with
       everything else. */
    settings: s('<path d="M10.52 3.12L13.48 3.12L13.59 5.29L15.62 6.13L17.23 4.68L19.32 6.77L17.87 8.38L18.71 10.41L20.88 10.52L20.88 13.48L18.71 13.59L17.87 15.62L19.32 17.23L17.23 19.32L15.62 17.87L13.59 18.71L13.48 20.88L10.52 20.88L10.41 18.71L8.38 17.87L6.77 19.32L4.68 17.23L6.13 15.62L5.29 13.59L3.12 13.48L3.12 10.52L5.29 10.41L6.13 8.38L4.68 6.77L6.77 4.68L8.38 6.13L10.41 5.29Z"/><circle cx="12" cy="12" r="3"/>'),
    /* The switcher's chevron. Down, small, and only ever beside a name the
       reader is already looking at. */
    chevron: s('<path d="m7.5 10 4.5 4.5 4.5-4.5"/>'),
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
    /* ── added for the Notes exploration ─────────────────────────────
       Same 24 grid, same 1.6 stroke, so nothing in the Notes sheet can
       disagree with the chrome it was copied from. */
    mic: s('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>'),
    photo: s('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="8.6" cy="10" r="1.5"/><path d="m4.2 17.4 4.4-4.2a1.6 1.6 0 0 1 2.2 0l3 2.9m0 0 1.9-1.8a1.6 1.6 0 0 1 2.2 0l2.3 2.2"/>'),
    typed: s('<path d="M4.5 6.5h15M4.5 11.5h15M4.5 16.5h9"/>'),
    lock: s('<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>'),
    undo: s('<path d="M4.5 9.5h9a5.5 5.5 0 1 1 0 11H8"/><path d="m8 5.5-3.5 4L8 13.5"/>'),
    send: s('<path d="M12 19.5V5"/><path d="m6 10.6 6-5.6 6 5.6"/>'),
    stop: s('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'),
    trash: s('<path d="M5 7h14M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7"/><path d="M6.8 7 7.7 19a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L17.2 7"/>'),
    keep: s('<path d="M7 4.5h10a1 1 0 0 1 1 1v14.2l-6-3.6-6 3.6V5.5a1 1 0 0 1 1-1z"/>'),
    email: s('<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.5 7.5 6.6 4.6a1.6 1.6 0 0 0 1.8 0l6.6-4.6"/>'),
    arrowRight: s('<path d="M4.5 12h14"/><path d="m13.5 6.6 5.4 5.4-5.4 5.4"/>'),
    wifiOff: s('<path d="M4 8.4A14 14 0 0 1 9.2 6M20 8.4a14 14 0 0 0-6.6-2.7"/><path d="M7.2 12.2a9.4 9.4 0 0 1 2.6-1.4M16.8 12.2a9.4 9.4 0 0 0-2.3-1.3"/><path d="M9.9 15.7a4.6 4.6 0 0 1 4.2 0"/><circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none"/><path d="m3.5 3.5 17 17"/>'),
    alert: s('<path d="M12 8.4v4.4"/><circle cx="12" cy="16.4" r="1" fill="currentColor" stroke="none"/><path d="M10.6 4.6 3.3 17.2A1.6 1.6 0 0 0 4.7 19.6h14.6a1.6 1.6 0 0 0 1.4-2.4L13.4 4.6a1.6 1.6 0 0 0-2.8 0z"/>'),
    split: s('<path d="M4.5 7.5h6M4.5 12h15M4.5 16.5h9"/><path d="M14 5.5 16.5 8 14 10.5"/>'),
    clock: s('<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 1.8"/>'),
  };
})();
