/** One tab's pending new-Project request. The actor-scoped key prevents a
 * signed-out/signed-in account change from presenting another actor's retry. */
const PREFIX = "signal-tasks.monthly-template-remix.v1:";
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function key(actorId: string): string {
  if (!actorId) throw new Error("Sign in before creating a Project.");
  return `${PREFIX}${actorId}`;
}

export function pendingMonthlyRemix(store: RequestStore, actorId: string): string | null {
  const value = store.getItem(key(actorId));
  if (value !== null && !REQUEST_ID.test(value)) throw new Error("The previous Project request could not be resumed.");
  return value;
}

/** Persist before the server call; every uncertain acknowledgement reuses it. */
export function prepareMonthlyRemix(store: RequestStore, actorId: string, newId: () => string): string {
  const pending = pendingMonthlyRemix(store, actorId);
  if (pending) return pending;
  const nonce = newId();
  if (!UUID.test(nonce)) throw new Error("A Project request could not be prepared.");
  const requestId = `monthly-remix:${nonce}`;
  store.setItem(key(actorId), requestId);
  return requestId;
}

/** Clear only the acknowledged request; another in-flight intent is untouched. */
export function confirmMonthlyRemix(store: RequestStore, actorId: string, requestId: string): void {
  if (pendingMonthlyRemix(store, actorId) === requestId) store.removeItem(key(actorId));
}
