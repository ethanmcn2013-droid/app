// Fixture processes may use loopback HTTP only. No provider SDK can send out.
const fs=require('node:fs');
function check(input){const host=typeof input==='string'?new URL(input).hostname:input instanceof URL?input.hostname:(input.hostname||input.host||'localhost').split(':')[0];if(!['127.0.0.1','localhost','::1'].includes(host)){const message='Fixture refused external network host '+host;if(process.env.FIXTURE_NETWORK_LOG)fs.appendFileSync(process.env.FIXTURE_NETWORK_LOG,message+'\n');throw Error(message);}}
for(const name of ['node:http','node:https']){const mod=require(name);for(const method of ['request','get']){const original=mod[method];mod[method]=function(input,...args){check(input);return original.call(this,input,...args)};}}
const fetch=globalThis.fetch;globalThis.fetch=function(input,...args){check(typeof input==='object'&&'url' in input?input.url:input);return fetch.call(this,input,...args)};
