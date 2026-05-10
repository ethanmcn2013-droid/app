/**
 * `/embed.js` — the one-step embed bootstrapper. A blogger drops a
 * single `<script src="https://tasks.signalstudio.ie/embed.js" async>` onto their
 * page; this script finds every `[data-tasks-workspace="{slug}"]`
 * element and injects a sandboxed iframe pointing at `/embed/{slug}`
 * on the same origin the script was served from.
 *
 * Returned with an aggressive cache policy because the script body
 * never changes per-request: it's a tiny IIFE the browser can hold
 * onto for an hour locally and a day at the edge.
 */

const SCRIPT = `(function () {
  if (typeof document === "undefined") return;
  var baseUrl = (function () {
    var s = document.currentScript;
    if (!s) return "";
    try { return new URL(s.src).origin; } catch (e) { return ""; }
  })();
  var els = document.querySelectorAll("[data-tasks-workspace]");
  for (var i = 0; i < els.length; i++) {
    (function (el) {
      var slug = el.getAttribute("data-tasks-workspace");
      if (!slug) return;
      if (el.querySelector("iframe[data-tasks-iframe]")) return;
      var iframe = document.createElement("iframe");
      iframe.src = baseUrl + "/embed/" + encodeURIComponent(slug);
      iframe.width = el.getAttribute("data-tasks-width") || "100%";
      iframe.height = el.getAttribute("data-tasks-height") || "480";
      iframe.style.border = "0";
      iframe.style.borderRadius = "12px";
      iframe.style.maxWidth = "100%";
      iframe.setAttribute("data-tasks-iframe", "true");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("title", "Tasks workspace \\u00b7 " + slug);
      el.appendChild(iframe);
    })(els[i]);
  }
})();
`;

export function GET(): Response {
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
