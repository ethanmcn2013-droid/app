export let actor: string | null = "a";
export let actorReads = 0;
export function setActor(id: string | null) { actor = id; actorReads = 0; }
export async function getCurrentUser() { actorReads++; if (!actor) throw new Error("UNAUTHENTICATED_FIXTURE"); return actor; }
