import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
const app=path.resolve(root,"../../..");
const expectedCommit="b805c5501f8198218791491ae0a2f26efbae0657";
const expectedTree="07ea449b3f9f39724961875bd612f18f6ae34071";
const expectedManifestSha256="aa3bb35103c99786355fa20d6f452d28bf6db57efd4a1840f25562a276c993ca";
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const git=(...args)=>execFileSync("git",args,{cwd:app,encoding:"utf8"}).trim();
if(!process.argv.includes("--install-ready"))throw new Error("Frozen installation must finish before bundling");
const expectedBytes=fs.readFileSync(path.join(root,"expected-source.json"));
const canonicalExpectedBytes=process.platform==="win32"?Buffer.from(expectedBytes.toString("utf8").replaceAll("\r\n","\n")):expectedBytes;
if(hash(canonicalExpectedBytes)!==expectedManifestSha256)throw new Error("Immutable expected-source manifest changed");
const expected=JSON.parse(expectedBytes);
if(expected.sourceCommit!==expectedCommit || expected.sourceTree!==expectedTree || git("rev-parse",expectedCommit+"^{tree}")!==expectedTree)throw new Error("Baseline identity mismatch");
execFileSync("git",["merge-base","--is-ancestor",expectedCommit,"HEAD"],{cwd:app});
const runtimeScopes=["src","drizzle","package.json","pnpm-lock.yaml","next.config.ts","vercel.json"];
if(git("diff","--name-only",expectedCommit,"HEAD","--",...runtimeScopes)||git("diff","--name-only",expectedCommit,"--",...runtimeScopes))throw new Error("Qualification checkout changes baseline runtime");
const verified=[];
for(const pin of expected.inputs){
 const actual=fs.readFileSync(path.join(app,pin.path));
 const normalized=process.platform==="win32"?Buffer.from(actual.toString("utf8").replaceAll("\r\n","\n")):actual;
 if(hash(normalized)!==pin.sha256 || git("rev-parse",expectedCommit+":"+pin.path)!==pin.gitBlob)throw new Error("Baseline source mismatch: "+pin.path);
 verified.push({...pin,actualSha256:hash(actual),lfNormalizedSha256:hash(normalized)});
}
const require=createRequire(path.join(app,"package.json"));
const {build}=createRequire(require.resolve("tsx/package.json"))("esbuild");
const shims={"@/server/db":"database.ts","@/server/auth":"actor.ts","next/cache":"cache.ts","@/server/operational-log":"log.ts","server-only":"empty.ts"};
function resolveApp(p){const base=path.join(app,"src",p);for(const c of [base,base+".ts",base+".tsx",base+".mjs",base+".js",path.join(base,"index.ts"),path.join(base,"index.tsx")])if(fs.existsSync(c)&&fs.statSync(c).isFile())return c;throw new Error("Unresolved App source: "+p)}
const result=await build({entryPoints:[path.join(root,"rehearsal.ts")],outfile:path.join(root,"rehearsal.bundle.mjs"),bundle:true,platform:"node",format:"esm",target:"node22",metafile:true,sourcemap:true,logLevel:"warning",plugins:[{name:"bounded-explicit-fixtures",setup(b){b.onResolve({filter:/.*/},args=>{
 if(args.path in shims)return{path:path.join(root,shims[args.path])};
 if(args.path.startsWith("@/"))return{path:resolveApp(args.path.slice(2))};
 if(args.path.startsWith(".")&&args.importer){const v=path.resolve(path.dirname(args.importer),args.path);for(const [source,shim] of [["db","database.ts"],["db/index","database.ts"],["auth","actor.ts"],["operational-log","log.ts"]])if(v===path.join(app,"src/server",source)||v===path.join(app,"src/server",source)+".ts")return{path:path.join(root,shim)}}
 if(args.path.startsWith("node:"))return{path:args.path,external:true};
 if(!args.path.startsWith(".")&&!path.isAbsolute(args.path)){const p=require.resolve(args.path);return{path:path.isAbsolute(p)?pathToFileURL(p).href:p,external:true}}
 })}}]});
const actualRuntimeInputs=Object.keys(result.metafile.inputs).map(p=>path.resolve(p)).filter(p=>p.startsWith(path.join(app,"src")+path.sep)).map(p=>path.relative(app,p).split(path.sep).join("/"));
for(const p of actualRuntimeInputs)if(!expected.inputs.some(x=>x.path===p))throw new Error("Unpinned runtime dependency: "+p);
for(const p of ["src/server/actions/wedding-guests.ts","src/server/actions/project-authz.ts","src/server/projects/project-deletion-fence.ts","src/server/wedding/guests.ts","src/server/account-export.ts","src/server/account-erasure.ts","src/server/projects/project-deletion-rows.ts"])if(!actualRuntimeInputs.includes(p))throw new Error("Missing real target: "+p);
const manifest={schema:"signal-disposable-guest-action-source-pins/1",sourceCommit:expectedCommit,sourceTree:expectedTree,qualificationCommit:git("rev-parse","HEAD"),expectedManifestSha256,verifiedInputs:verified,actualRuntimeInputs,fixtureBoundary:shims,bundleSha256:hash(fs.readFileSync(path.join(root,"rehearsal.bundle.mjs"))),scope:"In-process actual action and database logic; trusted actor fixture is not Clerk/JWT/browser identity proof"};
fs.writeFileSync(path.join(root,"source-pins.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({built:true,verifiedInputs:verified.length,realRuntimeInputs:actualRuntimeInputs.length,bundleSha256:manifest.bundleSha256}));
