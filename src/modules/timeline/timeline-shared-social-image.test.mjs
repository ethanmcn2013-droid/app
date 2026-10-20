import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const filename = fileURLToPath(new URL("./social-image-fixture.cjs", import.meta.url));
// Execute the actual file-convention renderer, replacing only IO boundaries.
// The real social projector and JSX branch both remain in the compiled module.
const bundle = await build({
  stdin: { contents: `export {default as image} from './app/s/[token]/opengraph-image';
    export {setResolution,requests} from 'fixture:resolver';`, resolveDir: resolve(dirname(filename), "../.."), loader: "tsx" },
  alias: { "@": resolve(dirname(filename), "../..") },
  bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic", external: ["react"],
  plugins: [{ name: "isolated-image-io", setup(builder) {
    builder.onResolve({filter: /^(fixture:resolver|@\/modules\/timeline\/server\/audience-timeline)$/}, () => ({path:"resolver",namespace:"fixture"}));
    builder.onResolve({filter: /^next\/og$/}, () => ({path:"image",namespace:"fixture"}));
    builder.onResolve({filter: /^node:fs\/promises$/}, () => ({path:"fonts",namespace:"fixture"}));
    builder.onLoad({filter: /.*/,namespace:"fixture"}, ({path}) => ({loader:"js",contents:path==="resolver"?
      `let resolution; export const requests=[]; export function setResolution(value){resolution=value;requests.length=0;} export async function resolveAudienceTimeline(token){requests.push(token);return resolution;}`:
      path==="image"?`export class ImageResponse {constructor(tree,options){this.tree=tree;this.options=options;}}`:
      `export async function readFile(){return Buffer.from('isolated-font-fixture');}`
    }));
  }}],
});
const compiled = new Module(filename); compiled.filename=filename; compiled.paths=Module._nodeModulePaths(dirname(filename)); compiled._compile(bundle.outputFiles[0].text,filename);
const {image,setResolution,requests}=compiled.exports;
const token="A".repeat(43);
const dto={version:1,audienceKind:"couple",publicationId:"publication-id-sentinel",label:"Couple label sentinel",ownerDisplayLabel:"Aoife & Liam",today:"2026-10-18",lastUpdatedAt:"2026-10-18T12:00Z",primaryDate:{label:"Private primary label sentinel",date:"2026-11-20"},
  presentation:{place:"Approved venue",address:"Private address sentinel",onDayNote:"Private day note sentinel",afterNote:"Private after note sentinel",giftName:"Private venue credit sentinel"},
  sections:[{state:"next",label:"Private section sentinel",items:[{publicId:"member-id-sentinel",title:"Private milestone sentinel",date:"2026-11-21",state:"next",presentation:{note:"Private guest note sentinel"}}]}]};
function text(node){if(node===null||node===undefined||typeof node==="boolean")return "";if(typeof node==="string"||typeof node==="number")return String(node);if(Array.isArray(node))return node.map(text).join(" ");return text(node.props?.children);}
async function render(resolution){setResolution(resolution);const result=await image({params:Promise.resolve({token})});assert.deepEqual(requests,[token]);assert.equal(result.options.headers["Cache-Control"],"private, no-store, max-age=0");assert.equal(result.options.headers["Referrer-Policy"],"no-referrer");const serialized=JSON.stringify(result.tree);for(const forbidden of [token,"publication-id-sentinel","member-id-sentinel","Private address sentinel","Private day note sentinel","Private after note sentinel","Private milestone sentinel","Private section sentinel","Private primary label sentinel","Private guest note sentinel","Private venue credit sentinel"])assert.ok(!serialized.includes(forbidden),`image leaked ${forbidden}`);return text(result.tree);}

test("actual default image stays data-free even when location alone is consented",async()=>{for(const socialDetails of [undefined,false]){const value=await render({kind:"ok",dto:{...dto,presentation:{...dto.presentation,locationConsent:true,...(socialDetails===undefined?{}:{socialDetails})}}});assert.match(value,/A shared timeline/);for(const hidden of ["Aoife","Liam","Couple label sentinel","November","2026","Approved venue"])assert.ok(!value.includes(hidden));}});

test("actual opt-in image includes title/date but venue requires its independent consent",async()=>{for(const locationConsent of [undefined,false]){const value=await render({kind:"ok",dto:{...dto,presentation:{...dto.presentation,socialDetails:true,...(locationConsent===undefined?{}:{locationConsent})}}});assert.ok(value.includes("Aoife & Liam"));assert.ok(value.includes("20 November 2026"));assert.ok(!value.includes("Approved venue"));}});

test("actual image renders only approved venue with both consents and public label for a class",async()=>{const presentation={...dto.presentation,socialDetails:true,locationConsent:true};const value=await render({kind:"ok",dto:{...dto,presentation}});assert.ok(value.includes("Approved venue"));assert.ok(value.includes("Aoife & Liam"));const classValue=await render({kind:"ok",dto:{...dto,audienceKind:"class",label:"Approved class title",presentation}});assert.ok(classValue.includes("Approved class title"));assert.ok(!classValue.includes("Aoife & Liam"));});

test("revoked, expired and unavailable shares always render the generic image even with stale opted-in data",async()=>{for(const kind of ["revoked","expired","unpublished","not_found","unavailable"]){const value=await render({kind,dto:{...dto,presentation:{...dto.presentation,socialDetails:true,locationConsent:true}}});assert.match(value,/A shared timeline/);assert.ok(!value.includes("Aoife"));assert.ok(!value.includes("November"));assert.ok(!value.includes("Approved venue"));}});
