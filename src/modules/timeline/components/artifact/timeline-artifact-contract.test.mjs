import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Module, { createRequire } from "node:module";
import { test } from "node:test";
const testRequire = createRequire(import.meta.url);
const { build } = createRequire(testRequire.resolve("tsx/package.json"))("esbuild");

// Exercise the real DTO validator -> pure model -> server-rendered component.
// Only CSS module names are substituted; no browser effects or service calls run.
const filename = fileURLToPath(new URL("./master3-contract-fixture.cjs", import.meta.url));
const bundled = await build({ stdin: {
  contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
import {validateAudienceTimelineDto} from '../../lib/audience-timeline';
import {TimelineArtifact} from './timeline-artifact';
export function render(value, props={}) {return renderToStaticMarkup(React.createElement(TimelineArtifact,{timeline:validateAudienceTimelineDto(value),...props}));}`,
  resolveDir: dirname(filename), loader: "tsx" }, bundle: true, platform: "node", format: "cjs", write: false,
  jsx: "automatic", external: ["react", "react-dom/server"], plugins: [{ name: "css-module-names", setup(builder) {
    builder.onLoad({ filter: /\.module\.css$/ }, () => ({ contents: "export default new Proxy({}, {get:(_,key)=>key});", loader: "js" }));
  } }] });
const compiled = new Module(filename); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(dirname(filename));
compiled._compile(bundled.outputFiles[0].text, filename);
const render = compiled.exports.render;
const source = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("./master3-actions.tsx", import.meta.url), "utf8");
const current = readFileSync(new URL("../../app/audience/current-project-preview-view.tsx", import.meta.url), "utf8");
const phonePreview = readFileSync(new URL("./timeline-phone-preview.tsx", import.meta.url), "utf8");
const item = (publicId, date, presentation) => ({publicId,title:`Public milestone ${publicId}`,state:"later",...(date?{date}:{}),...(presentation?{presentation}:{})});
const dto = (items=[], changes={}) => ({version:1,audienceKind:"module",publicationId:"synthetic-publication",label:"Community project",today:"2026-10-19",lastUpdatedAt:"2026-10-18T00:00:00Z",sections:[{state:"later",label:"Upcoming",items}],...changes});

test("Master3 renders the actual no-date contract without a sentinel, invented wedding or calendar success",()=>{
  const html=render(dto());
  assert.match(html,/data-master3-artifact/); assert.match(html,/Soon/); assert.match(html,/dates to follow/i);
  assert.doesNotMatch(html,/2099|Married|Add to my calendar|Calendar added|Following as/);
  assert.match(html,/data-timeline-wordmark/);
});

test("validated optional presentation reaches real rendering, never arbitrary private fields",()=>{
  const html=render(dto([item("one","2026-10-20",{forYou:true,note:"Bring the public invitation"}),item("end","2026-11-20",{final:true})],
    {presentation:{eyebrow:"A shared opening timeline",panelLabel:"Opening day",unitNoun:"opening day"}}));
  assert.match(html,/A shared opening timeline/); assert.match(html,/Bring the public invitation/);
  assert.match(html,/For you/); assert.match(html,/Public milestone end/);
  assert.throws(()=>render({...dto(),workspaceId:"private-workspace"}),/forbidden/);
  assert.throws(()=>render(dto([{...item("one","2026-10-20"),description:"Private task body"}])),/forbidden/);
});

test("private current preview cannot expose public sharing, follow, calendar, venue referral or publication tracking",()=>{
  const html=render(dto([item("one","2026-11-20")],{presentation:{giftName:"Synthetic venue",giftUrl:"https://venue.example",afterFollow:true}}),
    {privatePreview:true,guestServices:{shareUrl:"https://example.test/published",follow:{}}});
  assert.match(html,/Your current project timeline/);
  assert.doesNotMatch(html,/example\.test\/published|Share this timeline|Add to my calendar|Follow along|Synthetic venue|Planning your own day/);
  assert.match(current,/privatePreview/); assert.doesNotMatch(current,/QualifiedViewTracker|onShare/);
});

test("date passage does not render incomplete generic Tasks as completed",()=>{
  const html=render(dto([item("ordinary","2026-10-10"),item("future","2026-11-01")]));
  assert.match(html,/Date (?:has )?passed|dates passed/i);
  assert.doesNotMatch(html,/Public milestone ordinary\. [^<]*Done\./);
});

test("school exam window has no complete or Next-year assertion",()=>{
  const html=render(dto([item("exam","2027-06-09",{final:true})],{today:"2027-06-12",presentation:{market:"school",during:{days:21,word:"Good luck",l1:"Exams",l2:"under way"},next:{label:"Next year",url:"https://school.example/next"}}}));
  assert.match(html,/Good luck/); assert.doesNotMatch(html,/timeline is complete|All \d+ .*complete|href="https:\/\/school.example\/next"/);
});

test("static guest/phone projection does not count a view or call storage APIs",()=>{
  assert.match(phonePreview,/<TimelineArtifact timeline=\{timeline\} compact/);
  assert.doesNotMatch(phonePreview,/\bfetch\s*\(|sendBeacon|\/api\//);
  assert.doesNotMatch(source,/sendBeacon|QualifiedViewTracker|\bfetch\s*\(/);
});

test("calendar/share action copy distinguishes opening, copying and manual completion from saved/delivered claims",()=>{
  assert.match(actions,/Google Calendar opened in a new tab\. Save it there\./);
  assert.match(actions,/Calendar file downloaded\. Open it to add the dates\./);
  assert.match(actions,/Link copied/); assert.doesNotMatch(actions,/Calendar added|Successfully followed|Email delivered/);
  const empty=render(dto()); assert.doesNotMatch(empty,/Add to my calendar/);
});
