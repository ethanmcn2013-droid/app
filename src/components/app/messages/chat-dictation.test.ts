import assert from "node:assert/strict";
import test from "node:test";
import { createChatDictationAdapter, type ChatDictationCallbacks, type ChatSpeechRecognition } from "./chat-dictation";

type Result = { isFinal: boolean; 0: { transcript: string } };
type ResultEvent = { resultIndex: number; results: Result[] };

class FakeRecognition implements ChatSpeechRecognition {
  continuous = false;
  interimResults = false;
  onresult: ChatSpeechRecognition["onresult"] = null;
  onerror: ChatSpeechRecognition["onerror"] = null;
  onend: ChatSpeechRecognition["onend"] = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  start() { this.starts += 1; }
  stop() { this.stops += 1; }
  abort() { this.aborts += 1; }
  result(event: ResultEvent) { this.onresult?.(event); }
  error(error: string) { this.onerror?.({ error }); }
  end() { this.onend?.(); }
}

function callbacks(texts: string[] = [], interims: string[] = [], listening: boolean[] = [], errors: string[] = []): ChatDictationCallbacks {
  return {
    onText: (text) => texts.push(text),
    onInterim: (text) => interims.push(text),
    onListening: (value) => listening.push(value),
    onError: (error) => errors.push(error),
  };
}

function result(transcript: string, isFinal: boolean): Result {
  return { isFinal, 0: { transcript } };
}

test("the adapter appends finalized results once and keeps interim text separate", () => {
  const recognition = new FakeRecognition();
  const adapter = createChatDictationAdapter(() => recognition);
  const texts: string[] = [];
  const interims: string[] = [];
  assert.equal(adapter.start(callbacks(texts, interims)), true);
  assert.equal(recognition.starts, 1);
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);

  recognition.result({ resultIndex: 0, results: [result("hello ", true)] });
  recognition.result({ resultIndex: 0, results: [result("hello ", true)] });
  recognition.result({ resultIndex: 1, results: [result("hello ", true), result("world", false)] });
  assert.deepEqual(texts, ["hello "]);
  assert.deepEqual(interims, ["", "", "world"]);

  recognition.result({ resultIndex: 1, results: [result("hello ", true), result("world!", true)] });
  assert.deepEqual(texts, ["hello ", "world!"]);
  recognition.end();
});

test("stop asks the browser to finish and still accepts final text until end", () => {
  const recognition = new FakeRecognition();
  const adapter = createChatDictationAdapter(() => recognition);
  const texts: string[] = [];
  const listening: boolean[] = [];
  assert.equal(adapter.start(callbacks(texts, [], listening)), true);
  adapter.stop();
  adapter.stop();
  recognition.result({ resultIndex: 0, results: [result("finished", true)] });
  assert.equal(recognition.stops, 1);
  assert.equal(recognition.aborts, 0);
  assert.deepEqual(texts, ["finished"]);
  assert.deepEqual(listening, [true, false]);
  recognition.end();
  recognition.result({ resultIndex: 0, results: [result("late", true)] });
  assert.deepEqual(texts, ["finished"]);
});

test("cancel aborts and detaches every handler; callbacks captured before cancel are stale", () => {
  const recognition = new FakeRecognition();
  const adapter = createChatDictationAdapter(() => recognition);
  const texts: string[] = [];
  assert.equal(adapter.start(callbacks(texts)), true);
  const oldResultHandler = recognition.onresult;
  const oldEndHandler = recognition.onend;
  adapter.cancel();
  assert.equal(recognition.aborts, 1);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onerror, null);
  assert.equal(recognition.onend, null);
  oldResultHandler?.({ resultIndex: 0, results: [result("stale", true)] });
  oldEndHandler?.();
  assert.deepEqual(texts, []);
});

test("a new context can start while events from the cancelled scope remain ignored", () => {
  const instances: FakeRecognition[] = [];
  const adapter = createChatDictationAdapter(() => {
    const instance = new FakeRecognition();
    instances.push(instance);
    return instance;
  });
  const texts: string[] = [];
  adapter.start(callbacks(texts));
  const previousHandler = instances[0].onresult;

  // Hook context changes and unmount use cancel to invalidate their old scope.
  adapter.cancel();
  adapter.start(callbacks(texts));
  previousHandler?.({ resultIndex: 0, results: [result("old conversation", true)] });
  instances[1].result({ resultIndex: 0, results: [result("new conversation", true)] });
  assert.deepEqual(texts, ["new conversation"]);
});

test("browser error codes become actionable display states", () => {
  for (const [nativeError, expected] of [
    ["not-allowed", "permission-denied"],
    ["no-speech", "no-speech"],
    ["network", "network"],
  ] as const) {
    const recognition = new FakeRecognition();
    const adapter = createChatDictationAdapter(() => recognition);
    const errors: string[] = [];
    adapter.start(callbacks([], [], [], errors));
    recognition.error(nativeError);
    assert.deepEqual(errors, [expected]);
    assert.equal(recognition.onresult, null);
    assert.equal(recognition.onerror, null);
    adapter.cancel();
  }

  const unsupported = createChatDictationAdapter(() => null);
  const errors: string[] = [];
  assert.equal(unsupported.supported(), false);
  assert.equal(unsupported.start(callbacks([], [], [], errors)), false);
  assert.deepEqual(errors, ["unsupported"]);
});
