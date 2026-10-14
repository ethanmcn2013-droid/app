import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { readdirSync, readFileSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
export let db: ReturnType<typeof drizzle<typeof schema>>;
export let client: ReturnType<typeof createClient>;
export let dbFile: string;
const root = resolve(process.env.GUEST_HARNESS_ROOT!);
const app = resolve(process.env.GUEST_APP_ROOT!);
export async function initialize(label: string) {
 const owned = join(root, "databases"); mkdirSync(owned, { recursive: true });
 dbFile = join(owned, label + ".db"); if (existsSync(dbFile)) throw new Error("Refuse to reuse existing test DB: " + dbFile);
 client = createClient({ url: pathToFileURL(dbFile).href });
 await client.execute("PRAGMA foreign_keys=OFF");
 const files = readdirSync(join(app, "drizzle")).filter(f => /^[0-9]{4}_.+[.]sql$/.test(f) && f >= "0014_").sort();
 for (const f of files) await client.executeMultiple(readFileSync(join(app, "drizzle", f), "utf8"));
 db = drizzle(client, { schema });
 return { file: dbFile, migrations: files, foreignKeys: (await client.execute("PRAGMA foreign_keys")).rows[0] };
}
export async function snapshot() {
 const output: Record<string, unknown> = {};
 for (const table of ["wedding_households", "wedding_guests", "workspaces", "workspace_members", "users", "project_drive_operations"]) output[table] = (await client.execute(`SELECT * FROM ${table} `)).rows.map(row => Object.fromEntries(Object.entries(row))).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return output;
}
export function cleanup() {
 const file = dbFile; client?.close();
 return { file, closed: true, deferredToProcessExit: true, reason: "Windows native SQLite retains handles until child process exit; parent must verify removal before a final PASS" };
}
