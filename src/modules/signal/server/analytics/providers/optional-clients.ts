import "server-only";

import { createClient, type Client } from "@libsql/client";

let timelineClient: Client | null | undefined;
let notesClient: Client | null | undefined;

export function getTimelineClient(): Client | null {
  if (timelineClient !== undefined) return timelineClient;
  const url = process.env.TIMELINE_DATABASE_URL;
  timelineClient = url
    ? createClient({ url, authToken: process.env.TIMELINE_AUTH_TOKEN })
    : null;
  return timelineClient;
}

export function getNotesClient(): Client | null {
  if (notesClient !== undefined) return notesClient;
  const url = process.env.NOTES_DATABASE_URL;
  notesClient = url
    ? createClient({ url, authToken: process.env.NOTES_AUTH_TOKEN })
    : null;
  return notesClient;
}
