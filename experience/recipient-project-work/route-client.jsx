import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { modules } from 'fixture:client-modules';

const listeners = new Set();
const emit = () => { for (const listener of listeners) listener(); };
window.routeFixture = { actor:null, v3:true, errors:[], requests:[], version:0 };
window.fixtureLocation = () => location.pathname + location.search;
window.fixtureSubscribe = listener => { listeners.add(listener);return () => listeners.delete(listener); };
window.fixtureNavigate = async (href, replace=false) => {
  const target = new URL(href, location.href);
  if(target.origin!==location.origin)throw Error('External fixture navigation blocked');
  history[replace?'replaceState':'pushState'](null,'',target.pathname+target.search);
  await refresh();
};
function revive(value) {
  if(!value || typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(revive);
  if(value.$date)return new Date(value.$date);
  if(value.$form){const form=new FormData();for(const [key,entry] of value.$form)form.append(key,entry);return form;}
  if(value.$component || value.$tag){
    const type=value.$tag ?? modules[value.$component.file][value.$component.name];
    if(!type)throw Error('Unknown client component '+JSON.stringify(value.$component));
    return React.createElement(type,{...revive(value.props),key:value.key});
  }
  return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,revive(entry)]));
}
window.fixtureAction=async(file,name,args)=>{
  window.routeFixture.requests.push({file,name});
  const res=await fetch('/fixture/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file,name,args},(_key,value)=>value instanceof FormData?{$form:[...value]}:value)});
  const data=await res.json();
  if(!res.ok)throw Error(data.error ?? 'Fixture action failed');
  if(data.redirect){await window.fixtureNavigate(data.redirect);return null;}
  return revive(data.result);
};
let current=null,serial=0;
async function refresh() {
  const version=++serial;
  const res=await fetch('/fixture/route?href='+encodeURIComponent(window.fixtureLocation()));
  const result=await res.json();
  if(version!==serial)return;
  if(!res.ok){window.routeFixture.errors.push(result.error);emit();throw Error(result.error);}
  if(result.redirect){await window.fixtureNavigate(result.redirect,true);return;}
  window.routeFixture={...window.routeFixture,...result,version};
  current=revive(result.tree);emit();
}
window.fixtureRefresh=refresh;
window.addEventListener('popstate',refresh);
function App() {
  useSyncExternalStore(window.fixtureSubscribe,()=>window.routeFixture.version,()=>0);
  return current;
}
createRoot(document.getElementById('root')).render(<App/>);
refresh();
