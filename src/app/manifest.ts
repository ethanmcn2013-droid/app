import type { MetadataRoute } from "next";

/**
 * PWA manifest · Signal Tasks.
 *
 * Replaces the older static `public/manifest.webmanifest`. Next 16's
 * app/manifest.ts auto-emits the link tag, so the static file was
 * removed in this cycle to avoid duplicate-source confusion.
 *
 * start_url goes to /app/tasks because that's the post-auth work
 * surface, a home-screen tap should land on the board, not the
 * marketing homepage.
 *
 * `id: "/signal-tasks"` scopes the PWA identity so the suite surfaces
 * don't collide if origins are ever consolidated.
 *
 * Maskable icon at /icon1 (512×512), content inside the
 * 80%-diameter safe zone so Android adaptive masks don't clip.
 *
 * share_target preserved verbatim, this is the Web Share API target
 * that lets users share text/URLs into Tasks from any other Android
 * app via the system share sheet.
 *
 * THEME, and the one place the app cannot follow you. A web app manifest
 * carries exactly one background_color and one theme_color; the spec has no
 * media-conditional form, and Next has nothing to add to a file the OS reads
 * once at install time. So these are single values chosen on purpose:
 *
 *   theme_color      the L-frame charcoal. The Studio Bar is this colour in
 *                    BOTH themes, so the installed title bar sits flush
 *                    against the app's own top edge for every user — where
 *                    white was right for none of the dark ones.
 *   background_color the splash field, held at white. It paints for the
 *                    fraction of a second before the document does, and it
 *                    cannot know which theme the document will resolve to.
 *                    Light is the default mode and the majority case; a dark
 *                    user sees a brief light splash. The alternative trades
 *                    that for a dark flash in front of every light user.
 *
 * The in-document theme-color meta (src/app/app/layout.tsx) does carry both
 * themes; this file is the platform limit, not a missed remap.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/signal-tasks",
    name: "Signal Tasks",
    short_name: "Tasks",
    description: "A live task workspace built for momentum.",
    start_url: "/app/tasks",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#17171a",
    lang: "en-IE",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Board",
        short_name: "Board",
        url: "/app/tasks",
        description: "Cards across statuses.",
      },
      {
        name: "List",
        short_name: "List",
        url: "/app/tasks/list",
        description: "Flat list of everything.",
      },
      {
        name: "Timeline",
        short_name: "Timeline",
        url: "/app/tasks/timeline",
        description: "Dates on a line.",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
