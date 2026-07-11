import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const dev = String(packageJson.scripts?.dev ?? "");
const bootstrap = String(packageJson.scripts?.["db:bootstrap"] ?? "");
const migrate = String(packageJson.scripts?.["db:migrate"] ?? "");

if (/drizzle-kit\s+push/i.test(dev)) {
  console.error("migration-contract: dev must not run drizzle-kit push");
  process.exit(1);
}
if (!/^drizzle-kit\s+migrate$/.test(migrate)) {
  console.error("migration-contract: db:migrate must use drizzle-kit migrate");
  process.exit(1);
}
if (!/drizzle-kit\s+migrate/.test(bootstrap)) {
  console.error("migration-contract: db:bootstrap must apply reviewed migrations");
  process.exit(1);
}
console.log("migration-contract: ok");
