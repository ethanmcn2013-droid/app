import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Module, { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const filename = fileURLToPath(new URL("./master3-ui-regression-fixture.cjs", import.meta.url));
const bundled = await build({ stdin: { resolveDir: dirname(filename), loader: "tsx", contents: `
import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
import {validateAudienceTimelineDto} from '../../lib/audience-timeline'; import {TimelineArtifact} from './timeline-artifact';
export const render = value => renderToStaticMarkup(React.createElement(TimelineArtifact,{timeline:validateAudienceTimelineDto(value)}));` },
  bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic", external: ["react", "react-dom/server"],
  plugins: [{ name: "css-names-only", setup(builder) { builder.onLoad({ filter: /\.module\.css$/ }, () => ({ loader: "js", contents: "export default new Proxy({}, {get:(_,key)=>key})" })); } }] });
const compiled = new Module(filename); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(dirname(filename)); compiled._compile(bundled.outputFiles[0].text, filename);
const render = compiled.exports.render;
const item = (publicId, date, presentation) => ({ publicId, title: `Public ${publicId}`, state: "later", date, presentation });
const dto = changes => ({ version: 1, audienceKind: "module", publicationId: "synthetic-ui-regression", label: "Senior year",
  ownerDisplayLabel: "School name", today: "2026-10-12", lastUpdatedAt: "2026-10-09T12:00:00Z", sections: [], ...changes });

test("school title uses the publication title and next-date panel matches its actual date and time", () => {
  const html = render(dto({ presentation: { market: "school", countTo: "next", panelLabel: "Final exams", locationConsent: true, place: "School name" },
    sections: [{ state: "later", label: "Dates", items: [item("midterm", "2026-10-26", { time: "09:05" }), item("exams", "2027-06-09", { final: true, time: "14:00" })] }] }));
  assert.match(html, /<h1[^>]*>Senior year<\/h1>/);
  assert.match(html, /aria-label="Next date"/); assert.match(html, />Next date<\/h2>/);
  assert.match(html, /Monday 26 October 2026/); assert.doesNotMatch(html, /Monday, 26/);
  assert.match(html, /9\.05am/); assert.doesNotMatch(html, /14:00|09:05/);
});

test("couple title retains their published display name and wall time formats without changing the date", () => {
  const html = render(dto({ audienceKind: "couple", ownerDisplayLabel: "Alex & Sam", label: "Private project label",
    sections: [{ state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true, time: "14:00" })] }] }));
  assert.match(html, /<h1[^>]*><span>Alex &amp;<\/span> <span>Sam<\/span><\/h1>/);
  assert.match(html, /Friday 20 November 2026/); assert.match(html, /2pm/); assert.doesNotMatch(html, /14:00/);
});

test("after-event panel shows its date without repeating the old time or place", () => {
  const html = render(dto({ today: "2026-11-21", presentation: { locationConsent: true, place: "Public venue", after: { word: "Past" } },
    sections: [{ state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true, time: "14:00" })] }] }));
  assert.match(html, /Friday 20 November 2026/); assert.doesNotMatch(html, /class="placeLine"|14:00|2pm/);
});

test("empty phone heading does not claim zero completed milestones", () => {
  const html = render(dto({ ownerDisplayLabel: undefined }));
  assert.doesNotMatch(html, /0 of 0 done/); assert.match(html, /Dates to follow|dates to follow/);
});

test("first-capture layout corrections keep school rows above footer and suppress repeated near-day phone aside", () => {
  const css = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8");
  assert.match(css, /\.sidePanel\[data-near-day\]\s*\{\s*display: none/);
  assert.match(css, /\.comingUp \.sectionHeading\s*\{[^}]*height: 18px/);
  assert.match(css, /\.comingUp \.sectionHeading \.textButton\s*\{[^}]*margin-block: -13px/);
  assert.match(css, /\.comingUp\s*\{[^}]*top: 552px;[^}]*margin: 0/);
});
