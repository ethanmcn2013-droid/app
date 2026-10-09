/* Project Ping's deliberately small, bounded native capture processor. */
class PingPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options && options.processorOptions;
    this.generationId = processorOptions && processorOptions.generationId;
    this.connectionEpoch = processorOptions && processorOptions.connectionEpoch;
    this.validTag = typeof this.generationId === "string" && this.generationId.length > 0 && this.generationId.length <= 128
      && typeof this.connectionEpoch === "string" && this.connectionEpoch.length > 0 && this.connectionEpoch.length <= 128;
    this.failed = false;
    this.cut = false;
    this.samples = new Float32Array(4800);
    this.used = 0;
    this.totalSamples = 0;
    this.ordinal = 0;
    this.port.onmessage = (event) => this.onCommand(event.data);

    if (!this.validTag || sampleRate !== 24000) this.fail("unsupported_audio");
  }

  fail(reason) {
    if (this.failed) return;
    this.failed = true;
    this.port.postMessage({
      type: "failure",
      generationId: this.generationId,
      connectionEpoch: this.connectionEpoch,
      reason,
    });
  }

  sendFrame(count) {
    if (count < 1 || count > 4800) return;
    const copy = new Float32Array(count);
    copy.set(this.samples.subarray(0, count));
    this.ordinal += 1;
    this.port.postMessage({
      type: "frame",
      generationId: this.generationId,
      connectionEpoch: this.connectionEpoch,
      ordinal: this.ordinal,
      sampleRate: 24000,
      channels: 1,
      sampleCount: count,
      samples: copy.buffer,
    }, [copy.buffer]);
    this.used = 0;
  }

  onCommand(value) {
    if (this.failed || !value || typeof value !== "object" || Array.isArray(value)) return;
    const keys = Object.keys(value).sort();
    if (keys.length !== 3 || keys[0] !== "connectionEpoch" || keys[1] !== "generationId" || keys[2] !== "type" ||
      value.type !== "cut" || value.generationId !== this.generationId || value.connectionEpoch !== this.connectionEpoch) {
      this.fail("unsupported_audio");
      return;
    }
    if (this.cut) return;
    this.cut = true;
    if (this.used > 0) this.sendFrame(this.used);
    this.port.postMessage({
      type: "cut",
      generationId: this.generationId,
      connectionEpoch: this.connectionEpoch,
      throughFrame: this.ordinal,
      totalSamples: this.totalSamples,
    });
  }

  process(inputs, outputs) {
    const output = outputs && outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (this.failed || this.cut) return true;
    if (!inputs || inputs.length === 0 || !inputs[0] || inputs[0].length === 0) return true;
    if (inputs[0].length !== 1 || !(inputs[0][0] instanceof Float32Array) || sampleRate !== 24000) {
      this.fail("unsupported_audio");
      return true;
    }

    const channel = inputs[0][0];
    for (let index = 0; index < channel.length; index += 1) {
      const sample = channel[index];
      if (!Number.isFinite(sample)) {
        this.fail("unsupported_audio");
        return true;
      }
      if (this.totalSamples >= 720000) {
        this.fail("capture_cap");
        return true;
      }
      this.samples[this.used] = sample;
      this.used += 1;
      this.totalSamples += 1;
      if (this.used === 4800) this.sendFrame(4800);
    }
    return true;
  }
}

registerProcessor("ping-pcm-capture", PingPcmCaptureProcessor);
