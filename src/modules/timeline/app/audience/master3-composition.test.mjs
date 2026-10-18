import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const filename = fileURLToPath(new URL("./master3-composition-fixture.cjs", import.meta.url));
const bundled = await build({
  stdin: {
    contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {SharedTimelineArtifact} from './shared-timeline-artifact';
      import {validateAudienceTimelineDto} from '../../lib/audience-timeline';
      export function render(timeline, props) { return renderToStaticMarkup(React.createElement(SharedTimelineArtifact,
        {timeline:validateAudienceTimelineDto(timeline),...props})); }`,
    resolveDir: dirname(filename), loader: "tsx",
  },
  alias: { "@": resolve(dirname(filename), "../../../../") },
  bundle: true, platform: "node", format: "cjs", write: false,
  jsx: "automatic", external: ["react", "react-dom/server"],
  plugins: [{ name: "css-module-names", setup(builder) {
    builder.onLoad({ filter: /\.module\.css$/ }, () => ({
      contents: "export default new Proxy({}, {get:(_,key)=>key});", loader: "js",
    }));
  } }],
});
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(dirname(filename));
compiled._compile(bundled.outputFiles[0].text, filename);
const dto = {
  version: 1, audienceKind: "module", publicationId: "synthetic-publication",
  label: "Community day", today: "2026-10-19", lastUpdatedAt: "2026-10-18T12:00:00Z",
  sections: [{ state: "next", label: "Upcoming", items: [
    { publicId: "public-end", title: "Opening day", state: "next", date: "2026-11-20", presentation: { final: true } },
  ] }],
};

test("normal public shares render the real share and follow controls", () => {
  const markup = compiled.exports.render(dto, { shareToken: "A".repeat(43) });
  assert.match(markup, /Share this timeline/);
  assert.match(markup, /Follow along/);
  assert.match(markup, /Checking email updates/);
  assert.equal((markup.match(/<h1\b/g) ?? []).length, 1);
});

test("signed subscriber views never offer to share a personal management capability", () => {
  const markup = compiled.exports.render(dto, { subscriber: {
    emailHint: "m***@example.invalid", unsubscribeProof: "synthetic-private-management-proof",
  } });
  assert.doesNotMatch(markup, /Share this timeline|synthetic-private-management-proof|proof=/);
  assert.match(markup, /Following with m\*\*\*@example.invalid/);
  assert.match(markup, /Unfollow/);
  assert.equal((markup.match(/<h1\b/g) ?? []).length, 1);
});

test("public view counting is composed only for ordinary share tokens", () => {
  const source = readFileSync(new URL("./shared-timeline-artifact.tsx", import.meta.url), "utf8");
  assert.match(source, /shareToken \? <QualifiedViewTracker/);
  assert.match(source, /current\.search = ""/);
  assert.match(source, /current\.hash = ""/);
  const signed = readFileSync(new URL("../../../../app/s/follow/view/page.tsx", import.meta.url), "utf8");
  assert.match(signed, /expiresAt: verified\.expiresAt/);
  assert.doesNotMatch(signed, /shareToken=|subscription=|email: current\.subscription/);
});
