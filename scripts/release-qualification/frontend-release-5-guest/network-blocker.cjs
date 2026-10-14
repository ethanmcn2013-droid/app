const {syncBuiltinESMExports}=require('node:module');
globalThis.__networkBlocked=true;
globalThis.__blockedNetworkAttempts=[];
function refuse(kind){return function(){globalThis.__blockedNetworkAttempts.push(kind);throw new Error('NETWORK_FORBIDDEN_DISPOSABLE_HARNESS:'+kind)}}
for(const name of ['http','https']){const m=require('node:'+name);for(const f of ['request','get'])m[f]=refuse(name+'.'+f)}
const net=require('node:net');net.connect=refuse('net.connect');net.createConnection=refuse('net.createConnection');net.Socket.prototype.connect=refuse('Socket.connect');
const tls=require('node:tls');tls.connect=refuse('tls.connect');
const dns=require('node:dns');for(const f of ['lookup','resolve','resolve4','resolve6'])dns[f]=refuse('dns.'+f);
globalThis.fetch=async()=>refuse('fetch')();
syncBuiltinESMExports();
