"use client";

export type PrivatePingForwardedRequest=Readonly<{requestId:string;text:string}>;
export type PrivatePingCommand=Readonly<{text:string}>;

/** Only the exact leading token is a command; ordinary text stays on the shared send path. */
export function parsePrivatePingCommand(draft:string):PrivatePingCommand|null{
  const prefix=/^\s*@ping(?:\s|$)/iu.exec(draft);
  return prefix?{text:draft.slice(prefix[0].length).trim()}:null;
}

export function routePrivatePingCommand(input:{draft:string;enabled:boolean;canOpen:boolean;sendShared:()=>void;openPrivate:(command:PrivatePingCommand)=>void;blocked:()=>void}):"shared"|"private"|"blocked"{
  const command=parsePrivatePingCommand(input.draft);
  if(!command){input.sendShared();return "shared";}
  if(!input.enabled||!input.canOpen){input.blocked();return "blocked";}
  input.openPrivate(command);return "private";
}

/** Session-only ID marker prevents a forwarded request from auto-replaying after a remount. */
export function claimPrivatePingForwardOnce(storage:Pick<Storage,"getItem"|"setItem">,key:string):boolean{
  try{if(storage.getItem(key))return false;storage.setItem(key,"1");return true;}catch{return false;}
}
export function privatePingForwardKey(actorId:string,requestId:string):string{return `signal.ping.command.forward.v1:${actorId}:${requestId}`;}
