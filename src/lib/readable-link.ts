/** Describe destinations without query strings, credentials or known opaque IDs. */
export function readableLinkLabel(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "Open link";
    const host = url.hostname.replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const privateArtifact = ["s", "share", "redeem", "invite", "embed"].includes(parts[0] ?? "");
    const readable = (privateArtifact ? parts.slice(0, 1) : parts).filter(part => !/^(?:[a-f\d]{20,}|[a-f\d-]{32,}|(?:ws|dpl|msg|user|task|file)[_-].{12,}|[A-Za-z\d_-]{24,})$/i.test(part));
    const tail = readable.slice(-2).map(part => {
      try { return decodeURIComponent(part).replace(/[-_]+/g, " "); } catch { return part; }
    }).join(" / ");
    const label = tail ? `${host} / ${tail}` : host;
    return label.length > 90 ? label.slice(0, 87) + "…" : label;
  } catch { return "Open link"; }
}
