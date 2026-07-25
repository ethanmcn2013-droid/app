import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import suiteContracts from "./suite-contracts.v1.json";
import {
  APP_ORIGIN,
  PRODUCT_APP_PATHS,
  PRODUCT_APP_URLS,
  PRODUCT_MARKETING_URLS,
  STUDIO_ORIGIN,
  TASKS_PUBLIC_ORIGIN,
  TIMELINE_PUBLIC_ORIGIN,
} from "./product-urls";

describe("Signal Studio URL contract", () => {
  it("keeps one marketing origin and four path-based product homes", () => {
    assert.equal(suiteContracts.origins.marketing, "https://signalstudio.ie");
    assert.deepEqual(
      [
        suiteContracts.products.notes.name,
        suiteContracts.products.tasks.name,
        suiteContracts.products.timeline.name,
        suiteContracts.products.signal.name,
      ],
      ["Signal Notes", "Signal Tasks", "Signal Timeline", "Signal"],
    );
    assert.deepEqual(PRODUCT_MARKETING_URLS, {
      notes: `${STUDIO_ORIGIN}/notes`,
      tasks: `${STUDIO_ORIGIN}/tasks`,
      timeline: `${STUDIO_ORIGIN}/timeline`,
      signal: `${STUDIO_ORIGIN}/signal`,
    });
  });

  it("keeps one app origin and stable module paths", () => {
    assert.equal(suiteContracts.origins.app, "https://app.signalstudio.ie");
    assert.deepEqual(PRODUCT_APP_PATHS, {
      notes: "/app/notes",
      tasks: "/app/board",
      timeline: "/app/plan",
      signal: "/app/brief",
    });
    assert.deepEqual(PRODUCT_APP_URLS, {
      notes: `${APP_ORIGIN}/app/notes`,
      tasks: `${APP_ORIGIN}/app/board`,
      timeline: `${APP_ORIGIN}/app/plan`,
      signal: `${APP_ORIGIN}/app/brief`,
    });
  });

  it("reserves product subdomains for narrow public surfaces", () => {
    assert.equal(TASKS_PUBLIC_ORIGIN, "https://tasks.signalstudio.ie");
    assert.equal(TIMELINE_PUBLIC_ORIGIN, "https://timeline.signalstudio.ie");
  });

  it("redirects legacy Tasks app paths to the one app origin", () => {
    const nextConfig = readFileSync(
      new URL("../../next.config.ts", import.meta.url),
      "utf8",
    );

    assert.match(
      nextConfig,
      /source: "\/app"[\s\S]*?tasks\.signalstudio\.ie[\s\S]*?https:\/\/app\.signalstudio\.ie\/app\/board/,
    );
    assert.match(
      nextConfig,
      /source: "\/app\/:path\*"[\s\S]*?tasks\.signalstudio\.ie[\s\S]*?https:\/\/app\.signalstudio\.ie\/app\/:path\*/,
    );
  });
});
