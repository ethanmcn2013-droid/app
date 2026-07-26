"use client";

// Server-fetched Editorial Project Room facts, provided once from the
// app layout (fetched in AppShell's parallel batch — per DECISIONS.md D4,
// view pages must stay synchronous so they never re-suspend against
// /app/loading.tsx).

import { createContext, useContext } from "react";
import type { RoomBriefData } from "@/server/actions/room";
import {
  PINNED_REVIEW_CALENDAR_FRAME,
  type CalendarFrame,
} from "@/lib/calendar-frame";

const RoomBriefContext = createContext<RoomBriefData | null>(null);

export function RoomBriefProvider({
  value,
  children,
}: {
  value: RoomBriefData;
  children: React.ReactNode;
}) {
  return (
    <RoomBriefContext.Provider value={value}>
      {children}
    </RoomBriefContext.Provider>
  );
}

export function useRoomBrief(): RoomBriefData | null {
  return useContext(RoomBriefContext);
}

/**
 * App routes always receive a request-derived frame through RoomBriefProvider.
 * The deterministic fallback exists solely for isolated design-lab mounts.
 */
export function useCalendarFrame(): CalendarFrame {
  return useRoomBrief()?.calendarFrame ?? PINNED_REVIEW_CALENDAR_FRAME;
}
