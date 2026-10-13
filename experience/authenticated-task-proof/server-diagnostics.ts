import { createHash } from "node:crypto";

/** Collect a bounded stream, then redact across chunk boundaries before any
 * bytes reach private disk. Reports contain only size/hash/native exit facts. */
export function boundedServerDiagnostics(cap = 128 * 1024) {
  const chunks: Buffer[] = [];
  let captured = 0;
  const rawBytes = { stdout: 0, stderr: 0 };
  return {
    append(stream: "stdout" | "stderr", value: Buffer) {
      rawBytes[stream] += value.length;
      const part = value.subarray(0, Math.max(0, cap - captured));
      if (part.length) { chunks.push(Buffer.from(part)); captured += part.length; }
    },
    finish(privateValues: (string | undefined)[], completeLinesOnly = false) {
      const truncated = rawBytes.stdout + rawBytes.stderr > captured;
      let text = Buffer.concat(chunks).toString("utf8");
      if (truncated || completeLinesOnly) text = text.slice(0, Math.max(0, text.lastIndexOf("\n") + 1));
      for (const value of privateValues.filter((entry): entry is string => !!entry).sort((a, b) => b.length - a.length)) for (const form of [value, encodeURIComponent(value)]) text = text.split(form).join("<private>");
      text = text.replace(/\b(?:pk|sk)_(?:test|live)_[A-Za-z0-9_-]+/g, "<private-key>")
        .replace(/\buser_[A-Za-z0-9]+\b/g, "<private-subject>")
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<private-email>")
        .replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<private-token>");
      const contents = Buffer.from(text).subarray(0, cap);
      return { contents, bytes: contents.length, rawBytes, truncated, sha256: createHash("sha256").update(contents).digest("hex") };
    },
  };
}
