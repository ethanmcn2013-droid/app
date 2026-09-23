/** Only an exact, local invite path may override the normal auth destination. */
export function inviteReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\/invite\/([A-Za-z0-9_-]{1,128})\/?$/.exec(value);
  return match ? `/invite/${match[1]}` : null;
}

export function inviteAuthUrl(mode: "sign-in" | "sign-up", invitePath: string): string {
  const path = inviteReturnPath(invitePath);
  if (!path) throw new Error("Invalid invite return path.");
  return `/${mode}?${new URLSearchParams({ redirect_url: path })}`;
}
