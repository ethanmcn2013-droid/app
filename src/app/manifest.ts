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
    theme_color: "#ffffff",
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
