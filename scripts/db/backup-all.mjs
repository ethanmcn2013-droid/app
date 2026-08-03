// Back up every module database in one command (E08.09).
//
// WHY THIS EXISTS
// ---------------
// `backup.mjs` makes a backup possible. It does not make one happen. The only
// backup of production that exists today is `db-archive/2026-07-31/` at the
// workspace root: a one-off manual dump, taken during the data-layer reset,
// of the PREVIOUS generation of databases, held as a single copy on one
// laptop, never restored. Nothing takes a backup on a schedule and nothing
// covers all six modules.
//
// This script closes the "one at a time, by hand, if someone remembers" half
// of that. It walks the module list from studio/docs/INFRASTRUCTURE.md, backs
// up every one it holds credentials for, and writes them into the archive
// convention that already exists — `db-archive/<date>/` at the workspace
// root, outside every repository, git-ignored — with a manifest per database
// and a run manifest over all of them.
//
// It does NOT close the scheduling half. Running a production dump inside
// GitHub Actions puts couple planning data into Actions artifact storage,
// which is a data-handling decision with a residency question attached and is
// the founder's to make, not a script's. That decision is recorded as open in
// studio/docs/RECOVERY.md rather than taken here.
//
// USAGE
//   node scripts/db/backup-all.mjs                       # every module with credentials
//   node scripts/db/backup-all.mjs --modules=tasks,notes  # a subset
//   node scripts/db/backup-all.mjs --out=../db-archive    # default
//   node scripts/db/backup-all.mjs --verify               # restore-verify each one
//
// A module with no credentials is REPORTED AS SKIPPED and the run exits
// non-zero. A backup run that silently covered four of six databases and
// exited green is the failure this whole task exists to prevent.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { KNOWN_MODULES, takeBackup } from "./backup.mjs";
import { restoreInto, measure, compare, compareDdl } from "./restore-verify.mjs";
import os from "node:os";

/** `<MODULE>_DATABASE_URL` + `<MODULE>_AUTH_TOKEN`, the one env convention. */
function credentialsFor(moduleName) {
  const prefix = moduleName.toUpperCase();
  return {
    url: process.env[`${prefix}_DATABASE_URL`] ?? null,
    authToken: process.env[`${prefix}_AUTH_TOKEN`] ?? null,
    urlVar: `${prefix}_DATABASE_URL`,
  };
}

async function backupOne(moduleName, outDir, { verify }) {
  const { url, authToken, urlVar } = credentialsFor(moduleName);
  if (!url) {
    return { module: moduleName, status: "skipped", reason: `${urlVar} is not set` };
  }

  const client = createClient({ url, authToken: authToken ?? undefined });
  let result;
  try {
    result = await takeBackup(client, { label: moduleName, url });
  } finally {
    client.close();
  }

  const backupPath = path.join(outDir, `${moduleName}.jsonl`);
  const manifestPath = path.join(outDir, `${moduleName}.manifest.json`);
  fs.writeFileSync(backupPath, result.body);
  fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2) + "\n");

  const entry = {
    module: moduleName,
    status: "ok",
    databaseIdentity: result.manifest.databaseIdentity,
    tables: result.manifest.tableCount,
    rows: result.manifest.totalRows,
    triggers: result.manifest.ddl.triggers.length,
    bytes: Buffer.byteLength(result.body),
    sha256: result.manifest.backupSha256,
    verified: false,
  };

  if (verify) {
    // Restore into a throwaway local file and re-read it. This is the only
    // step that turns a dump into a backup, so --verify is the flag that
    // should be on in any run whose output someone intends to rely on.
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `signal-verify-${moduleName}-`));
    const target = path.join(workDir, "restored.db");
    const { client: restored } = await restoreInto(
      `file:${target.replaceAll("\\", "/")}`,
      result.body,
    );
    try {
      const measured = await measure(
        restored,
        result.manifest.tables.map((t) => t.name),
      );
      const data = compare(result.manifest, measured);
      const ddl = await compareDdl(restored, result.manifest);
      entry.verified = data.ok && ddl.ok;
      if (!entry.verified) {
        entry.status = "unverified";
        entry.dataDifferences = data.differences;
        entry.missingDdl = ddl.missing;
      }
    } finally {
      restored.close();
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "EPERM") throw error;
      }
    }
  }

  return entry;
}

export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      modules: { type: "string" },
      out: { type: "string" },
      verify: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const requested = values.modules
    ? values.modules.split(",").map((name) => name.trim()).filter(Boolean)
    : [...KNOWN_MODULES];
  const unknown = requested.filter((name) => !KNOWN_MODULES.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `unknown module(s): ${unknown.join(", ")}; expected ${KNOWN_MODULES.join(", ")}`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  // Default target is the workspace-root archive convention from
  // studio/docs/INFRASTRUCTURE.md — outside every repo, git-ignored.
  const base = path.resolve(process.cwd(), values.out ?? path.join("..", "db-archive"));
  const outDir = path.join(base, date);
  fs.mkdirSync(outDir, { recursive: true });

  const entries = [];
  for (const moduleName of requested) {
    entries.push(await backupOne(moduleName, outDir, { verify: values.verify }));
  }

  const runManifest = {
    schemaVersion: "signal-db-backup-run/1",
    takenAt: new Date().toISOString(),
    verified: values.verify,
    requested,
    entries,
  };
  fs.writeFileSync(
    path.join(outDir, "RUN_MANIFEST.json"),
    JSON.stringify(runManifest, null, 2) + "\n",
  );

  const skipped = entries.filter((e) => e.status === "skipped");
  const failed = entries.filter((e) => e.status === "unverified");
  const ok = entries.filter((e) => e.status === "ok");

  console.log(`Backup run — ${outDir}\n`);
  for (const entry of entries) {
    if (entry.status === "skipped") {
      console.log(`[SKIP] ${entry.module} — ${entry.reason}`);
    } else if (entry.status === "unverified") {
      console.log(`[FAIL] ${entry.module} — restored copy does not match its manifest`);
    } else {
      console.log(
        `[ OK ] ${entry.module} — ${entry.rows} rows, ${entry.tables} tables, ` +
          `${entry.triggers} triggers${entry.verified ? ", restore verified" : ""}`,
      );
    }
  }
  console.log(
    `\n${ok.length} backed up, ${skipped.length} skipped, ${failed.length} failed verification.`,
  );

  if (skipped.length > 0) {
    console.error(
      `\nThis run did NOT cover every module. A partial backup that exits green ` +
        `is how a database is discovered to be uncovered on the day it is needed. ` +
        `Set the missing variables or pass --modules to say deliberately which ` +
        `subset you meant.`,
    );
  }
  if (!values.verify) {
    console.error(
      `\nNo restore was attempted. Re-run with --verify, or treat these files ` +
        `as dumps rather than as backups.`,
    );
  }

  return skipped.length === 0 && failed.length === 0 ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith(path.join("db", "backup-all.mjs"));
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`db:backup:all: ${error.message}`);
      process.exit(1);
    },
  );
}
