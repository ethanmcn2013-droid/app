export type PingTranscriptionMessage =
  | Readonly<{ kind: "ack"; itemId: string; previousItemId: string | null }>
  | Readonly<{ kind: "final"; itemId: string; contentIndex: 0; text: string }>
  | Readonly<{ kind: "preview" }>
  | Readonly<{ kind: "failure"; reason: "invalid_message" | "unexpected_message" | "provider_error" }>;
export type PingAppendResult =
  | Readonly<{ ok: true; text: string; decodedBytes: number }>
  | Readonly<{ ok: false; reason: "invalid_pcm" }>;
