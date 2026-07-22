export interface QueriedHistoryWindow {
  historyStartAt: string;
  historyEndAt: string;
}

/**
 * Coverage describes the interval successfully queried, not the timestamps of
 * events found inside it. A truncated ascending query is only complete through
 * its last returned event.
 */
export function queriedHistoryWindow(
  requestedStart: Date,
  requestedEnd: Date,
  truncated: boolean,
  lastReturnedEventAt: string | null,
): QueriedHistoryWindow {
  return {
    historyStartAt: requestedStart.toISOString(),
    historyEndAt: truncated && lastReturnedEventAt
      ? lastReturnedEventAt
      : requestedEnd.toISOString(),
  };
}
