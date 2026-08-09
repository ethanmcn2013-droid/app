import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const defaultRoot = path.resolve(here, "..", "..");

function invariant(condition, message) {
  if (!condition) throw new Error(`migration-ledger: ${message}`);
}

export function canonicalText(value) {
  return String(value).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function canonicalFileSha256(file) {
  return sha256(canonicalText(fs.readFileSync(file, "utf8")));
}

export function rawFileSha256(file) {
  return sha256(fs.readFileSync(file));
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`migration-ledger: cannot read ${label} at ${file}: ${error.message}`);
  }
}

function validateReceipt(root, entry, receiptCache) {
  const receiptPath = path.resolve(root, entry.receipt);
  invariant(receiptPath.startsWith(`${root}${path.sep}`), `${entry.id} receipt escapes repository root`);
  invariant(fs.existsSync(receiptPath), `${entry.id} receipt is missing: ${entry.receipt}`);
  invariant(/^[a-f0-9]{64}$/.test(entry.receiptSha256 ?? ""), `${entry.id} has invalid receiptSha256`);
  const receiptSha256 = canonicalFileSha256(receiptPath);
  invariant(receiptSha256 === entry.receiptSha256, `${entry.id} receipt hash does not match the ledger`);

  let document = receiptCache.get(receiptPath);
  if (!document) {
    document = readJson(receiptPath, "migration receipt");
    invariant(document.schemaVersion === "tasks-migration-receipt/1", `${entry.receipt} has an unsupported schemaVersion`);
    invariant(typeof document.id === "string" && document.id.length > 0, `${entry.receipt} is missing id`);
    invariant(typeof document.authorizedBy === "string" && document.authorizedBy.length > 0, `${entry.receipt} is missing authorizedBy`);
    invariant(typeof document.reviewedBy === "string" && document.reviewedBy.length > 0, `${entry.receipt} is missing reviewedBy`);
    invariant(typeof document.authorizationSource === "string" && document.authorizationSource.length > 0, `${entry.receipt} is missing authorizationSource`);
    invariant(Array.isArray(document.migrations), `${entry.receipt} is missing migrations`);
    receiptCache.set(receiptPath, document);
  }

  const matches = document.migrations.filter((migration) => migration.id === entry.id);
  invariant(matches.length === 1, `${entry.id} must have exactly one receipt record in ${entry.receipt}`);
  const record = matches[0];
  invariant(record.sha256 === entry.sha256, `${entry.id} receipt hash does not match the ledger`);
  invariant(/^\d{4}-\d{2}-\d{2}T/.test(record.reviewedAt ?? ""), `${entry.id} receipt is missing reviewedAt`);
  invariant(typeof record.risk === "string" && record.risk.length > 0, `${entry.id} receipt is missing risk`);
  invariant(typeof record.rollbackPlan === "string" && record.rollbackPlan.length > 0, `${entry.id} receipt is missing rollbackPlan`);
  invariant(Array.isArray(record.postconditions) && record.postconditions.length > 0, `${entry.id} receipt has no postconditions`);
  invariant(record.postconditions.every((item) => typeof item === "string" && item.length > 0), `${entry.id} receipt has an invalid postcondition`);

  if (entry.policy === "baseline" || entry.policy === "forward") {
    invariant(Array.isArray(record.proofs) && record.proofs.length > 0, `${entry.id} executable receipt has no machine-verifiable proofs`);
    const proofIds = new Set();
    for (const proof of record.proofs) {
      invariant(typeof proof.id === "string" && proof.id.length > 0, `${entry.id} has a proof without id`);
      invariant(!proofIds.has(proof.id), `${entry.id} has duplicate proof ${proof.id}`);
      proofIds.add(proof.id);
      invariant(typeof proof.sql === "string" && /^SELECT\b/i.test(proof.sql.trim()), `${entry.id} proof ${proof.id} must be a read-only SELECT`);
      invariant(!proof.sql.includes(";"), `${entry.id} proof ${proof.id} contains multiple statements`);
      invariant(Object.hasOwn(proof, "expected"), `${entry.id} proof ${proof.id} is missing expected`);
    }
  }

  return {
    document,
    record,
    path: receiptPath,
    sha256: receiptSha256,
  };
}

export function loadAndValidateLedger({ root = defaultRoot } = {}) {
  root = path.resolve(root);
  const ledgerPath = path.join(root, "drizzle", "migration-ledger.json");
  const ledger = readJson(ledgerPath, "migration ledger");
  invariant(ledger.schemaVersion === "tasks-migration-ledger/1", "unsupported migration ledger schemaVersion");
  invariant(ledger.dialect === "sqlite", "dialect must be sqlite");
  invariant(ledger.databaseLedgerTable === "signal_schema_migrations", "unexpected database ledger table");
  invariant(ledger.drizzleHighWaterTable === "__drizzle_migrations", "unexpected Drizzle high-water table");
  invariant(Array.isArray(ledger.entries) && ledger.entries.length > 0, "ledger has no entries");

  const attributesPath = path.join(root, ".gitattributes");
  invariant(fs.existsSync(attributesPath), ".gitattributes is required to pin migration line endings");
  invariant(/(^|\n)drizzle\/\*\.sql text eol=lf(\n|$)/.test(canonicalText(fs.readFileSync(attributesPath, "utf8"))), "drizzle/*.sql must be pinned to LF in .gitattributes");

  const drizzleDir = path.join(root, "drizzle");
  const sqlFiles = fs.readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => `drizzle/${name}`)
    .sort();

  const ids = new Set();
  const files = new Set();
  const receiptCache = new Map();
  let previousWhen = -1;
  let baselineOrdinal = -1;
  const entries = ledger.entries.map((entry, ordinal) => {
    invariant(entry.ordinal === ordinal, `entry ${entry.id ?? ordinal} has non-contiguous ordinal`);
    invariant(typeof entry.id === "string" && /^[0-9]{4}[a-z]?_[a-z0-9_]+$/.test(entry.id), `entry ${ordinal} has invalid id`);
    invariant(!ids.has(entry.id), `duplicate migration id ${entry.id}`);
    ids.add(entry.id);
    invariant(entry.file === `drizzle/${entry.id}.sql`, `${entry.id} file must match its id`);
    invariant(!files.has(entry.file), `duplicate migration file ${entry.file}`);
    files.add(entry.file);
    invariant(Number.isSafeInteger(entry.when) && entry.when > previousWhen, `${entry.id} timestamp must be strictly increasing`);
    previousWhen = entry.when;
    invariant(["legacy-adopt-only", "baseline", "forward"].includes(entry.policy), `${entry.id} has invalid policy`);
    if (entry.policy === "baseline") {
      invariant(baselineOrdinal === -1, "ledger must contain exactly one baseline");
      baselineOrdinal = ordinal;
    }
    invariant(baselineOrdinal === -1 ? entry.policy === "legacy-adopt-only" : entry.policy !== "legacy-adopt-only", `${entry.id} has invalid policy ordering`);
    invariant(/^[a-f0-9]{64}$/.test(entry.sha256 ?? ""), `${entry.id} has invalid sha256`);

    const filePath = path.resolve(root, entry.file);
    invariant(filePath.startsWith(`${root}${path.sep}`), `${entry.id} file escapes repository root`);
    invariant(fs.existsSync(filePath), `${entry.id} SQL file is missing`);
    invariant(canonicalFileSha256(filePath) === entry.sha256, `${entry.id} SQL hash does not match the ledger`);

    if (entry.snapshot) {
      const snapshotPath = path.resolve(root, entry.snapshot);
      invariant(snapshotPath.startsWith(`${root}${path.sep}`) && fs.existsSync(snapshotPath), `${entry.id} snapshot is missing`);
      invariant(/^[a-f0-9]{64}$/.test(entry.snapshotSha256 ?? ""), `${entry.id} has invalid snapshotSha256`);
      invariant(canonicalFileSha256(snapshotPath) === entry.snapshotSha256, `${entry.id} snapshot hash does not match the ledger`);
      invariant(readJson(snapshotPath, `${entry.id} snapshot`).dialect === "sqlite", `${entry.id} snapshot dialect is not sqlite`);
    } else {
      invariant(entry.snapshotSha256 === undefined, `${entry.id} has snapshotSha256 without a snapshot`);
    }

    const receipt = validateReceipt(root, entry, receiptCache);
    if (entry.continuousProofIds !== undefined) {
      invariant(Array.isArray(entry.continuousProofIds), `${entry.id} continuousProofIds must be an array`);
      invariant(new Set(entry.continuousProofIds).size === entry.continuousProofIds.length, `${entry.id} has duplicate continuousProofIds`);
      const receiptProofIds = new Set(receipt.record.proofs.map((proof) => proof.id));
      for (const proofId of entry.continuousProofIds) {
        invariant(receiptProofIds.has(proofId), `${entry.id} continuous proof ${proofId} is not present in its receipt`);
      }
    }
    return {
      ...entry,
      filePath,
      sql: canonicalText(fs.readFileSync(filePath, "utf8")),
      receipt,
    };
  });

  invariant(baselineOrdinal >= 0, "ledger must contain exactly one baseline");
  invariant(entries[baselineOrdinal].snapshot, "baseline must reference the current schema snapshot");
  invariant(JSON.stringify([...files].sort()) === JSON.stringify(sqlFiles), "every top-level drizzle/*.sql file must be registered exactly once");

  const journalPath = path.resolve(root, ledger.journal);
  invariant(journalPath.startsWith(`${root}${path.sep}`) && fs.existsSync(journalPath), "Drizzle journal is missing");
  const journal = readJson(journalPath, "Drizzle journal");
  invariant(journal.version === "7" && journal.dialect === "sqlite", "Drizzle journal header is invalid");
  invariant(Array.isArray(journal.entries) && journal.entries.length === entries.length, "Drizzle journal and migration ledger must contain the same entries");
  journal.entries.forEach((journalEntry, ordinal) => {
    const entry = entries[ordinal];
    invariant(journalEntry.idx === ordinal, `${entry.id} journal idx is not contiguous`);
    invariant(journalEntry.tag === entry.id, `${entry.id} is not registered at the same journal position`);
    invariant(journalEntry.when === entry.when, `${entry.id} journal timestamp differs from the ledger`);
    invariant(journalEntry.breakpoints === true, `${entry.id} journal breakpoints must be enabled`);
  });

  return {
    root,
    ledger,
    ledgerPath,
    ledgerSha256: canonicalFileSha256(ledgerPath),
    entries,
    baseline: entries[baselineOrdinal],
    forward: entries.slice(baselineOrdinal + 1),
  };
}
