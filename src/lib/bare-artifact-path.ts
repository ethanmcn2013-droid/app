export function isBareArtifactPath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/");
}
