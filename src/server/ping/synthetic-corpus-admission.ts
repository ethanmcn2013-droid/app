import "server-only";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { lstat, open, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { normalizePingCapture, type PingCapture } from "@/lib/ping/proposal";
import { dataRecord, exactKeys, freeze, jsonArray } from "@/lib/ping/input-validation";
import { PING_PCM_MAX_SAMPLES } from "@/lib/ping/pcm";
import { projectPingSyntheticContext, projectPingSyntheticModelInput } from "./synthetic-interpretation-contract";
import type { PingNativeAudioContext } from "./openai-native-audio";

const MANIFEST_SHA256 = "95bc1e6206b7d482f4807c79efa94eb8ab38f71a57ff99e8c07623ce8bd634bd";
const MAX_MANIFEST_BYTES = 2_000_000;
const MAX_PINNED_JSON_BYTES = 8_000_000;
const MAX_PCM_BYTES = Math.min(PING_PCM_MAX_SAMPLES * 2, 1_440_000);
const SAMPLE_RATE = 24_000;
const BOOTSTRAP_RELATIVE = "scripts/ping/comparison/.synthetic-custody-bootstrap.json";
const SOURCE_FILES = ["development-cases.json", "reserved-cases.json"] as const;
const SUPPORT_FILES = ["generic-rules.json", "validate.mjs", "README.md"] as const;
const PINNED_GIT_PATHS: Readonly<Record<string, string>> = Object.freeze({
  "development-cases.json": "docs/execution/project-ping/corpus-v2/development-cases.json",
  "reserved-cases.json": "docs/execution/project-ping/corpus-v2/reserved-cases.json",
  "generic-rules.json": "docs/execution/project-ping/corpus-v2/generic-rules.json",
  "validate.mjs": "docs/execution/project-ping/corpus-v2/validate.mjs",
  "README.md": "docs/execution/project-ping/corpus-v2/README.md",
});
const execFile = promisify(execFileCallback);

const admissionBrand: unique symbol = Symbol("ping-synthetic-corpus-admission");
export type PingSyntheticCorpusAdmission = Readonly<{ readonly [admissionBrand]: never }>;
export type PingSyntheticCorpusMember = Readonly<{ ordinal: number; partition: "development" | "reserved";
  pcm: Uint8Array<ArrayBuffer>; capture: PingCapture; admission: PingSyntheticCorpusAdmission }>;

type AdmissionRecord = Readonly<{ pcmSha256: string; context: PingNativeAudioContext }>;
const admissions = new WeakMap<object, AdmissionRecord>();

function fail(): never { throw new Error("ping_synthetic_corpus_unavailable"); }
function sha256(value: Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
function shaText(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function validHash(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }
function samePath(a: string, b: string): boolean { return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase(); }
function parsedJson(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return fail(); }
}

async function canonicalRegularPath(value: unknown, directory: boolean): Promise<string> {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) return fail();
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) return fail();
  }
  const actual = await realpath(absolute);
  if (!samePath(actual, absolute)) return fail();
  const final = await lstat(absolute);
  if (directory ? !final.isDirectory() : !final.isFile()) return fail();
  return actual;
}

async function readBoundedFile(filename: string, maximum: number): Promise<Buffer> {
  await canonicalRegularPath(filename, false);
  const before = await lstat(filename);
  const handle = await open(filename, "r");
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > maximum || opened.dev !== before.dev || opened.ino !== before.ino) return fail();
    const bytes = await handle.readFile();
    const after = await lstat(filename);
    const afterCanonical = await canonicalRegularPath(filename, false);
    if (bytes.byteLength > maximum || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino ||
      !samePath(afterCanonical, filename)) return fail();
    return bytes;
  } finally { await handle.close(); }
}

function safeRelativeChild(root: string, value: unknown): string {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\0")) return fail();
  const child = path.resolve(root, value);
  const relative = path.relative(root, child);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return fail();
  return child;
}

async function checkedReference(value: unknown): Promise<Buffer> {
  if (!dataRecord(value) || !exactKeys(value, ["path", "sha256"]) || !validHash(value.sha256)) return fail();
  const filename = await canonicalRegularPath(value.path, false);
  const bytes = await readBoundedFile(filename, MAX_PINNED_JSON_BYTES);
  if (sha256(bytes) !== value.sha256) return fail();
  return bytes;
}

function repositoryJson(bytes: Buffer): unknown {
  if (bytes.byteLength > MAX_PINNED_JSON_BYTES) return fail();
  return parsedJson(bytes);
}

async function gitBlob(repository: string, revision: string, filename: string): Promise<Buffer> {
  const env = { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP, TMP: process.env.TMP, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull,
    GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  try {
    const { stdout } = await execFile("git", ["-c", "core.hooksPath=NUL", "-C", repository, "show", `${revision}:${filename}`],
      { encoding: "buffer", maxBuffer: MAX_PINNED_JSON_BYTES, timeout: 10_000, windowsHide: true, env });
    if (!Buffer.isBuffer(stdout) || stdout.byteLength > MAX_PINNED_JSON_BYTES) return fail();
    return stdout;
  } catch { return fail(); }
}

async function verifyRepository(repository: string, revision: unknown): Promise<string> {
  if (typeof revision !== "string" || !/^[0-9a-f]{40,64}$/.test(revision)) return fail();
  const env = { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP, TMP: process.env.TMP, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull,
    GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  try {
    const { stdout } = await execFile("git", ["-c", "core.hooksPath=NUL", "-C", repository, "rev-parse", "--show-toplevel"],
      { encoding: "utf8", timeout: 10_000, windowsHide: true, env });
    if (!samePath(String(stdout).trim(), repository)) return fail();
    const resolved = await execFile("git", ["-c", "core.hooksPath=NUL", "-C", repository, "rev-parse", "--verify", `${revision}^{commit}`],
      { encoding: "utf8", timeout: 10_000, windowsHide: true, env });
    if (String(resolved.stdout).trim().toLowerCase() !== revision.toLowerCase()) return fail();
    return revision;
  } catch { return fail(); }
}

function rowArray(value: unknown): Record<string, unknown>[] {
  if (!jsonArray(value, 100) || !value.every(dataRecord)) return fail();
  return value;
}

function parseSourceRow(value: unknown): Readonly<{ id: string; partition: "development" | "reserved";
  inputHash: string; capture: PingCapture }> | null {
  if (!dataRecord(value) || !exactKeys(value, ["version", "id", "partition", "input", "capture", "fixtureDomain", "expected"]) ||
    typeof value.version !== "string" || typeof value.id !== "string" ||
    (value.partition !== "development" && value.partition !== "reserved") || typeof value.input !== "string" ||
    !Object.hasOwn(value, "expected")) return null;
  const capture = normalizePingCapture(value.capture);
  if (!capture) return null;
  return { id: value.id, partition: value.partition, inputHash: shaText(value.input), capture };
}

type Member = Readonly<{ id: string; partition: "development" | "reserved"; eligible: boolean;
  inputHash: string; source: "parent" | "noise_extension" }>;
function parseMember(value: unknown): Member | null {
  if (!dataRecord(value) || !exactKeys(value, ["id", "partition", "eligible", "inputUtf8Sha256", "source"]) ||
    typeof value.id !== "string" || (value.partition !== "development" && value.partition !== "reserved") ||
    typeof value.eligible !== "boolean" || !validHash(value.inputUtf8Sha256) ||
    (value.source !== "parent" && value.source !== "noise_extension")) return null;
  return { id: value.id, partition: value.partition, eligible: value.eligible,
    inputHash: value.inputUtf8Sha256, source: value.source };
}

type AudioEntry = Readonly<{ id: string; partition: "development" | "reserved"; method: string; root: string;
  wav: string; pcm: string; wavSha256: string; pcmSha256: string; decodedBytes: number; durationSeconds: number }>;
function parseEntry(value: unknown): AudioEntry | null {
  if (!dataRecord(value) || !exactKeys(value, ["id", "partition", "method", "root", "wav", "pcm", "wavSha256", "pcmSha256", "decodedBytes", "durationSeconds"]) ||
    typeof value.id !== "string" || (value.partition !== "development" && value.partition !== "reserved") ||
    typeof value.method !== "string" || typeof value.root !== "string" || typeof value.wav !== "string" || typeof value.pcm !== "string" ||
    !validHash(value.wavSha256) || !validHash(value.pcmSha256) || !Number.isSafeInteger(value.decodedBytes) ||
    typeof value.decodedBytes !== "number" || value.decodedBytes <= 0 || typeof value.durationSeconds !== "number" ||
    !Number.isFinite(value.durationSeconds)) return null;
  return { id: value.id, partition: value.partition, method: value.method, root: value.root, wav: value.wav, pcm: value.pcm,
    wavSha256: value.wavSha256, pcmSha256: value.pcmSha256, decodedBytes: value.decodedBytes, durationSeconds: value.durationSeconds };
}

function parseWave(bytes: Buffer): Buffer {
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) !== bytes.length - 8) return fail();
  let offset = 12, format: Buffer | null = null, data: Buffer | null = null;
  while (offset + 8 <= bytes.length) {
    const name = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8, end = start + size;
    if (end > bytes.length) return fail();
    if (name === "fmt ") {
      if (format || size < 16) return fail();
      format = bytes.subarray(start, end);
    } else if (name === "data") {
      if (data) return fail();
      data = bytes.subarray(start, end);
    }
    offset = end + (size & 1);
  }
  if (offset !== bytes.length || !format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 ||
    format.readUInt32LE(4) !== SAMPLE_RATE || format.readUInt32LE(8) !== SAMPLE_RATE * 2 ||
    format.readUInt16LE(12) !== 2 || format.readUInt16LE(14) !== 16 || data.length % 2 !== 0 || data.length > MAX_PCM_BYTES) return fail();
  return Buffer.from(data);
}

function verifyCounts(manifest: Record<string, unknown>, members: readonly Member[], entries: readonly AudioEntry[]): void {
  const counts = { sourceTotal: 43, sourceDevelopment: 12, sourceReserved: 31,
    audioTotal: 42, audioDevelopment: 12, audioReserved: 30, textOnlyTotal: 1 };
  for (const [key, expected] of Object.entries(counts)) if (manifest[key] !== expected) return fail();
  const devMembers = members.filter(item => item.partition === "development").length;
  const reservedMembers = members.filter(item => item.partition === "reserved").length;
  const devAudio = entries.filter(item => item.partition === "development").length;
  const reservedAudio = entries.filter(item => item.partition === "reserved").length;
  if (members.length !== 43 || entries.length !== 42 || devMembers !== 12 || reservedMembers !== 31 ||
    devAudio !== 12 || reservedAudio !== 30 || members.length - entries.length !== 1) return fail();
}

function projection(capture: PingCapture): PingNativeAudioContext {
  const value = projectPingSyntheticContext({ selectedTaskCount: capture.selectedTaskIds.length,
    referenceInstant: capture.referenceInstant, timeZone: capture.timeZone, systemColumnKeys: ["todo", "doing", "review", "done"] });
  if (!value) return fail();
  return value;
}

/** Reads only the fixed, whole-hash-pinned private corpus after local custody bootstrap.
 * Result order is stable: development source-file order, then reserved source-file order, then the noise extension. */
export async function readPingSyntheticCorpus(): Promise<readonly PingSyntheticCorpusMember[]> {
  try {
    if ((process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") || process.env.VERCEL !== undefined) return fail();
    const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const bootstrapPath = path.join(appRoot, BOOTSTRAP_RELATIVE);
    const bootstrapBytes = await readBoundedFile(bootstrapPath, 4_096);
    const bootstrap = parsedJson(bootstrapBytes);
    if (!dataRecord(bootstrap) || !exactKeys(bootstrap, ["manifestPath", "sourceRepositoryPath"])) return fail();
    const manifestPath = await canonicalRegularPath(bootstrap.manifestPath, false);
    const repositoryPath = await canonicalRegularPath(bootstrap.sourceRepositoryPath, true);
    const manifestBytes = await readBoundedFile(manifestPath, MAX_MANIFEST_BYTES);
    if (sha256(manifestBytes) !== MANIFEST_SHA256) return fail();
    const manifest = parsedJson(manifestBytes);
    const manifestKeys = ["version", "status", "chronology", "sourceRevision", "parentCompletion", "parentEligibility",
      "parentSourceFiles", "noiseSource", "noiseCompletion", "sourceTotal", "sourceDevelopment", "sourceReserved", "audioTotal",
      "audioDevelopment", "audioReserved", "textOnlyTotal", "profile", "limits", "members", "entries", "labelsRemainAtPinnedSources",
      "reviewLocators", "originalPayloadsCopied", "audioChanges", "providerCalls", "listeningPerformed", "overallGateAcceptance"];
    if (!dataRecord(manifest) || !exactKeys(manifest, manifestKeys) || manifest.version !== "ping.combined-corpus.v1") return fail();
    if (!dataRecord(manifest.profile) || !exactKeys(manifest.profile,
      ["name", "culture", "gender", "age", "rate", "volume", "assemblyVersion"]) ||
      !dataRecord(manifest.limits) || !exactKeys(manifest.limits,
        ["synthesis", "ssml", "textTransform", "retries", "sampleRate", "bitsPerSample", "channels", "encoding", "maxSeconds", "maxDecodedBytes"]) ||
      manifest.limits.sampleRate !== SAMPLE_RATE || manifest.limits.bitsPerSample !== 16 || manifest.limits.channels !== 1 ||
      manifest.limits.maxSeconds !== 30 || manifest.limits.maxDecodedBytes !== MAX_PCM_BYTES || manifest.limits.retries !== 0) return fail();

    const revision = await verifyRepository(repositoryPath, manifest.sourceRevision);
    if (!jsonArray(manifest.parentSourceFiles, 5) || manifest.parentSourceFiles.length !== 5) return fail();
    const sourceRows = new Map<string, Readonly<{ id: string; partition: "development" | "reserved"; inputHash: string; capture: PingCapture }>>();
    const sourcePins = new Map<string, string>();
    const expectedSourceFiles = [...SOURCE_FILES, ...SUPPORT_FILES];
    for (const pin of manifest.parentSourceFiles) {
      if (!dataRecord(pin) || !exactKeys(pin, ["name", "sha256"]) || typeof pin.name !== "string" || !validHash(pin.sha256) || sourcePins.has(pin.name)) return fail();
      if (!expectedSourceFiles.includes(pin.name as typeof expectedSourceFiles[number])) return fail();
      sourcePins.set(pin.name, pin.sha256);
      const pinnedGitPath = PINNED_GIT_PATHS[pin.name];
      if (!pinnedGitPath) return fail();
      const blob = await gitBlob(repositoryPath, revision, pinnedGitPath);
      if (sha256(blob) !== pin.sha256) return fail();
      if (!(SOURCE_FILES as readonly string[]).includes(pin.name)) continue;
      const parsed = repositoryJson(blob);
      if (!Array.isArray(parsed)) return fail();
      for (const raw of rowArray(parsed)) {
        const row = parseSourceRow(raw);
        if (!row || sourceRows.has(row.id)) return fail();
        if ((pin.name === SOURCE_FILES[0] && row.partition !== "development") ||
          (pin.name === SOURCE_FILES[1] && row.partition !== "reserved")) return fail();
        sourceRows.set(row.id, row);
      }
    }
    if (expectedSourceFiles.some(name => !sourcePins.has(name))) return fail();

    const parentCompletion = parsedJson(await checkedReference(manifest.parentCompletion));
    const parentEligibility = parsedJson(await checkedReference(manifest.parentEligibility));
    const noiseSourceBytes = await checkedReference(manifest.noiseSource);
    const noiseSource = parseSourceRow(parsedJson(noiseSourceBytes));
    const noiseCompletion = parsedJson(await checkedReference(manifest.noiseCompletion));
    if (!noiseSource || noiseSource.partition !== "reserved" || sourceRows.has(noiseSource.id)) return fail();
    const completedNoiseCase = dataRecord(noiseCompletion) ? parseSourceRow(noiseCompletion.case) : null;
    if (!dataRecord(noiseCompletion) || noiseCompletion.caseSha256 !== sha256(noiseSourceBytes) ||
      noiseCompletion.caseId !== noiseSource.id || !completedNoiseCase || completedNoiseCase.id !== noiseSource.id ||
      completedNoiseCase.partition !== noiseSource.partition || completedNoiseCase.inputHash !== noiseSource.inputHash ||
      JSON.stringify(completedNoiseCase.capture) !== JSON.stringify(noiseSource.capture)) return fail();

    const members = rowArray(manifest.members).map(parseMember);
    if (members.some(item => item === null)) return fail();
    const typedMembers = members as Member[];
    const memberById = new Map<string, Member>();
    for (const member of typedMembers) {
      if (memberById.has(member.id)) return fail();
      memberById.set(member.id, member);
    }
    for (const [id, row] of sourceRows) {
      const member = memberById.get(id);
      if (!member || member.source !== "parent" || member.partition !== row.partition || member.inputHash !== row.inputHash) return fail();
    }
    const noiseMember = memberById.get(noiseSource.id);
    if (!noiseMember || noiseMember.source !== "noise_extension" || noiseMember.partition !== noiseSource.partition ||
      noiseMember.inputHash !== noiseSource.inputHash) return fail();

    const parsedEntries = rowArray(manifest.entries).map(parseEntry);
    if (parsedEntries.some(item => item === null)) return fail();
    const entries = parsedEntries as AudioEntry[];
    const entryById = new Map<string, AudioEntry>();
    for (const entry of entries) {
      const member = memberById.get(entry.id);
      if (entryById.has(entry.id) || !member || !member.eligible || member.partition !== entry.partition ||
        (member.source === "noise_extension") !== (entry.id === noiseSource.id)) return fail();
      entryById.set(entry.id, entry);
    }
    if (typedMembers.some(member => member.eligible !== entryById.has(member.id))) return fail();
    verifyCounts(manifest, typedMembers, entries);

    if (!dataRecord(parentCompletion) || !Array.isArray(parentCompletion.entries) || typeof parentCompletion.originalAudioRoot !== "string" ||
      !dataRecord(parentEligibility) ||
      !Array.isArray(parentEligibility.mapping)) return fail();
    const originalAudioRoot = await canonicalRegularPath(parentCompletion.originalAudioRoot, true);
    const completionIds = new Set<string>();
    for (const raw of parentCompletion.entries) {
      if (!dataRecord(raw) || typeof raw.id !== "string" || completionIds.has(raw.id)) return fail();
      const entry = entryById.get(raw.id);
      if (!entry || memberById.get(raw.id)?.source !== "parent" || raw.partition !== entry.partition || raw.method !== entry.method ||
        raw.wavSha256 !== entry.wavSha256 || raw.pcmSha256 !== entry.pcmSha256 || raw.decodedBytes !== entry.decodedBytes ||
        raw.durationSeconds !== entry.durationSeconds || raw.instructionUtf8Sha256 !== memberById.get(raw.id)?.inputHash ||
        typeof raw.wav !== "string" || typeof raw.pcm !== "string" || raw.wav !== entry.wav || raw.pcm !== entry.pcm ||
        !samePath(entry.root, originalAudioRoot)) return fail();
      completionIds.add(raw.id);
    }
    const parentEntries = entries.filter(entry => memberById.get(entry.id)?.source === "parent");
    if (completionIds.size !== parentEntries.length) return fail();
    const eligibility = new Map<string, Record<string, unknown>>();
    for (const raw of parentEligibility.mapping) {
      if (!dataRecord(raw) || typeof raw.id !== "string" || eligibility.has(raw.id)) return fail();
      eligibility.set(raw.id, raw);
    }
    if (eligibility.size !== sourceRows.size) return fail();
    for (const [id, member] of memberById) if (member.source === "parent") {
      const row = eligibility.get(id);
      if (!row || row.partition !== member.partition || row.eligible !== member.eligible || row.inputUtf8Sha256 !== member.inputHash) return fail();
    }
    const noiseEntry = entries.find(entry => entry.id === noiseSource.id);
    if (!noiseEntry || noiseCompletion.mixedPcmSha256 !== noiseEntry.pcmSha256 || noiseCompletion.mixedWavSha256 !== noiseEntry.wavSha256 ||
      noiseCompletion.decodedBytes !== noiseEntry.decodedBytes || noiseCompletion.durationSeconds !== noiseEntry.durationSeconds) return fail();

    const result: PingSyntheticCorpusMember[] = [];
    const orderedIds = [...sourceRows.keys(), noiseSource.id];
    for (const id of orderedIds) {
      const entry = entryById.get(id);
      if (!entry) continue;
      const root = await canonicalRegularPath(entry.root, true);
      const wavPath = safeRelativeChild(root, entry.wav);
      const pcmPath = safeRelativeChild(root, entry.pcm);
      const [wav, pcm] = await Promise.all([readBoundedFile(wavPath, MAX_PCM_BYTES + 65_536), readBoundedFile(pcmPath, MAX_PCM_BYTES)]);
      const checkedWav = await canonicalRegularPath(wavPath, false), checkedPcm = await canonicalRegularPath(pcmPath, false);
      if (!samePath(checkedWav, wavPath) || !samePath(checkedPcm, pcmPath) || sha256(wav) !== entry.wavSha256 ||
        sha256(pcm) !== entry.pcmSha256 || pcm.byteLength !== entry.decodedBytes || pcm.byteLength > MAX_PCM_BYTES ||
        entry.durationSeconds !== pcm.byteLength / (SAMPLE_RATE * 2)) return fail();
      const wavePcm = parseWave(wav);
      if (!wavePcm.equals(pcm)) return fail();
      const source = id === noiseSource.id ? noiseSource : sourceRows.get(id);
      const capture = source?.capture;
      if (!capture) return fail();
      const ownedPcm = new Uint8Array(pcm.byteLength); ownedPcm.set(pcm);
      const token = Object.freeze(Object.create(null)) as PingSyntheticCorpusAdmission;
      admissions.set(token as object, freeze({ pcmSha256: entry.pcmSha256, context: projection(capture) }));
      const member = memberById.get(id);
      if (!member) return fail();
      result.push(Object.freeze({ ordinal: result.length, partition: member.partition, pcm: ownedPcm, capture, admission: token }));
    }
    if (result.length !== 42) return fail();
    return Object.freeze(result);
  } catch { return fail(); }
}

export function allowsPingSyntheticPcm(admission: unknown, ownedPcm: Uint8Array, context?: unknown): boolean {
  try {
    if (!admission || typeof admission !== "object") return false;
    const record = admissions.get(admission);
    if (!record || !(ownedPcm instanceof Uint8Array) || sha256(ownedPcm) !== record.pcmSha256) return false;
    if (context === undefined) return true;
    const projected = projectPingSyntheticContext(context);
    return !!projected && JSON.stringify(projected) === JSON.stringify(record.context);
  } catch { return false; }
}

export function allowsPingSyntheticInterpretation(admission: unknown, projectedInput: unknown): boolean {
  try {
    if (!admission || typeof admission !== "object") return false;
    const record = admissions.get(admission);
    if (!record) return false;
    const projected = projectPingSyntheticModelInput(projectedInput);
    if (!projected) return false;
    const context = projectPingSyntheticContext({ selectedTaskCount: projected.selectedTaskCount,
      referenceInstant: projected.referenceInstant, timeZone: projected.timeZone, systemColumnKeys: projected.systemColumnKeys });
    return !!context && JSON.stringify(context) === JSON.stringify(record.context);
  } catch { return false; }
}
