import { validPingId } from "./command";
import { codePoints, dataRecord, exactKeys, jsonArray, transcriptText } from "./input-validation";
import { PING_PCM_BLOCK_SAMPLES } from "./pcm";

export type PingTranscriptionMessage =
  | Readonly<{ kind: "ack"; itemId: string; previousItemId: string | null }>
  | Readonly<{ kind: "final"; itemId: string; contentIndex: 0; text: string }>
  | Readonly<{ kind: "preview" }>
  | Readonly<{ kind: "failure"; reason: "invalid_message" | "unexpected_message" | "provider_error" }>;
export type PingAppendResult =
  | Readonly<{ ok: true; text: string; decodedBytes: number }>
  | Readonly<{ ok: false; reason: "invalid_pcm" }>;

export function encodePingPcmAppend(value: unknown): PingAppendResult {
  try {
    if (!value || Object.getPrototypeOf(value) !== Uint8Array.prototype) return { ok: false, reason: "invalid_pcm" };
    const native = Object.getPrototypeOf(Uint8Array.prototype);
    if (Object.getOwnPropertyDescriptor(native, Symbol.toStringTag)!.get!.call(value) !== "Uint8Array") return { ok: false, reason: "invalid_pcm" };
    const buffer: unknown = Object.getOwnPropertyDescriptor(native, "buffer")!.get!.call(value);
    if (!buffer || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype || Reflect.ownKeys(buffer).length !== 0) return { ok: false, reason: "invalid_pcm" };
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(buffer);
    const length = Object.getOwnPropertyDescriptor(native, "length")!.get!.call(value) as number;
    if (!length || length % 2 || length > PING_PCM_BLOCK_SAMPLES * 2 || Reflect.ownKeys(value).length !== length) return { ok: false, reason: "invalid_pcm" };
    const bytes = value as Uint8Array;
    return Object.freeze({ ok: true, decodedBytes: length,
      text: JSON.stringify({ type: "input_audio_buffer.append", audio: btoa(String.fromCharCode(...bytes)) }) });
  } catch { return { ok: false, reason: "invalid_pcm" }; }
}

export function encodePingAudioCommit(): string { return '{"type":"input_audio_buffer.commit"}'; }

/** The caller supplies an already-ready EMPTY dedicated session; this codec does not establish it. */
export function decodePingTranscriptionMessage(raw: unknown): PingTranscriptionMessage {
  const invalid = (): PingTranscriptionMessage => ({ kind: "failure", reason: "invalid_message" });
  try {
    if (typeof raw !== "string" || raw.length > 65536) return invalid();
    const value: unknown = JSON.parse(raw);
    if (!dataRecord(value) || typeof value.type !== "string" ||
      (Object.hasOwn(value, "event_id") && !validPingId(value.event_id))) return invalid();
    if (value.type === "error") return { kind: "failure", reason: "provider_error" };
    if (value.type === "input_audio_buffer.committed") {
      if (!exactKeys(value, ["type", "item_id"], ["event_id", "previous_item_id"]) || !validPingId(value.item_id) ||
        (Object.hasOwn(value, "previous_item_id") && value.previous_item_id !== null && !validPingId(value.previous_item_id))) return invalid();
      return { kind: "ack", itemId: value.item_id, previousItemId: (value.previous_item_id ?? null) as string | null };
    }
    if (value.type === "conversation.item.input_audio_transcription.completed" || value.type === "conversation.item.input_audio_transcription.delta") {
      const final = value.type.endsWith("completed");
      const textKey = final ? "transcript" : "delta";
      if (!exactKeys(value, ["type", "item_id", "content_index", textKey], ["event_id", ...(final ? ["languages"] : [])]) ||
        !validPingId(value.item_id) || value.content_index !== 0 || !transcriptText(value[textKey], !final) ||
        codePoints(value[textKey] as string) > 4000) return invalid();
      if (Object.hasOwn(value, "languages") && (!jsonArray(value.languages, 16) || !value.languages.every((language) =>
        dataRecord(language) && exactKeys(language, ["code"]) && typeof language.code === "string" && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(language.code)))) return invalid();
      return final ? { kind: "final", itemId: value.item_id, contentIndex: 0, text: value.transcript as string } : { kind: "preview" };
    }
    return { kind: "failure", reason: "unexpected_message" };
  } catch { return invalid(); }
}
