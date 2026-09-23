/** Display only profile fields already visible to members of this Project. */
export function userDisplayName(profile: {
  name: string | null;
  handle: string | null;
  email: string | null;
}): string | null {
  const name = profile.name?.trim();
  if (name) return name;
  const handle = profile.handle?.trim();
  if (handle) return handle;
  const emailLocalPart = profile.email?.split("@", 1)[0]?.trim();
  return emailLocalPart || null;
}
