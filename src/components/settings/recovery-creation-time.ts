// Keep the English App's server/client labels identical across host time zones.
// UTC is explicit; the projection supplies an instant, not a project-local date.
const options: Intl.DateTimeFormatOptions = {
  day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23", timeZone: "UTC",
};
const seconds = new Intl.DateTimeFormat("en-GB", options);
const milliseconds = new Intl.DateTimeFormat("en-GB", { ...options, fractionalSecondDigits: 3 });

export function recoveryCreationTime(createdAt: string): { label: string; dateTime?: string } {
  const instant = new Date(createdAt);
  if (!Number.isFinite(instant.getTime())) return { label: "Creation time unavailable" };
  const formatter = instant.getUTCMilliseconds() ? milliseconds : seconds;
  return { label: formatter.format(instant) + " UTC", dateTime: instant.toISOString() };
}
