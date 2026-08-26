// Compare a locally built artifact against the copy that is live.
//
//   node scripts/design/family/diff-live.mjs <live.html> <local.html>
//
// Publishing refuses until the live version has been read, so that nothing
// another session wrote is silently overwritten. This does that reading
// properly. Character-level diffing is useless on a 780KB file with an
// embedded screenshot pack — one inserted rule shifts every byte after it —
// so this compares line multisets and answers the only question that
// matters: is there anything in the live copy that is not in mine?
//
// Exit 1 if there is. Exit 0 if the local build is a superset.

import { readFileSync } from 'node:fs'
const [live, mine] = process.argv.slice(2)
const strip = s => s
  .replace(/^[\s\S]*?<!-- \/frame-runtime -->/,'').replace(/<meta charset[\s\S]*?<body>/,'')
  .replace(/<!--fam:start-->[\s\S]*?<!--fam:end-->/g,'').replace(/<style id="famCss">[\s\S]*?<\/style>/g,'')
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\n?/g,'')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Geist[^>]*>\n?/g,'')
const A = strip(readFileSync(live,'utf8')).split('\n')
const B = strip(readFileSync(mine,'utf8')).split('\n')
const cnt = arr => { const m=new Map(); for(const l of arr) m.set(l,(m.get(l)||0)+1); return m }
const ma=cnt(A), mb=cnt(B)
const onlyLive=[], onlyLocal=[]
for(const [l,n] of ma){ const d=n-(mb.get(l)||0); if(d>0) onlyLive.push([l,d]) }
for(const [l,n] of mb){ const d=n-(ma.get(l)||0); if(d>0) onlyLocal.push([l,d]) }
console.log(`lines  live ${A.length}  local ${B.length}`)
console.log(`\nONLY IN THE LIVE VERSION (would be lost) — ${onlyLive.length} distinct line(s):`)
for(const [l,n] of onlyLive.slice(0,25)) console.log(`  ${n}x  ${l.slice(0,150)}`)
if(!onlyLive.length) console.log('  (none)')
console.log(`\nONLY IN THE LOCAL BUILD (would be added) — ${onlyLocal.length} distinct line(s):`)
for(const [l,n] of onlyLocal.slice(0,25)) console.log(`  ${n}x  ${l.slice(0,150)}`)
if(!onlyLocal.length) console.log('  (none)')
process.exit(onlyLive.length?1:0)
