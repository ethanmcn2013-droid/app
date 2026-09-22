/** Server inputs only. The result controls availability, never authorization. */
export type ConversationControls = Readonly<{
  internalEnabled: boolean;
  sendsEnabled: boolean;
  deliveryEnabled: boolean;
  allowedActorIds: ReadonlySet<string>;
  guestsEnabled: false;
  attachmentsEnabled: false;
  aiEnabled: false;
}>;

/** All nonfixture environments default off, including development and tests. */
export function resolveConversationControls(env: Readonly<Record<string, string | undefined>>): ConversationControls {
  const internalEnabled = env.SIGNAL_CONVERSATION_INTERNAL_ENABLED === "true";
  return {
    internalEnabled,
    sendsEnabled: internalEnabled && env.SIGNAL_CONVERSATION_SEND_ENABLED === "true",
    deliveryEnabled: internalEnabled && env.SIGNAL_CONVERSATION_DELIVERY_ENABLED === "true",
    allowedActorIds: new Set((env.SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean)),
    guestsEnabled: false,
    attachmentsEnabled: false,
    aiEnabled: false,
  };
}

/** Apply only after authentication. Turning sends off retains entitled history. */
export function conversationAvailability(controls: ConversationControls, authenticatedActorId: string): Readonly<{
  read: boolean;
  send: boolean;
  deliver: boolean;
}> {
  const read = controls.internalEnabled && !!authenticatedActorId && controls.allowedActorIds.has(authenticatedActorId);
  return { read, send: read && controls.sendsEnabled, deliver: read && controls.deliveryEnabled };
}
