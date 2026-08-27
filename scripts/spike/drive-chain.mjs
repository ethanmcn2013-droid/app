#!/usr/bin/env node

/**
 * WP-1 — prove the Drive chain end to end, with two real Google accounts.
 *
 * THROWAWAY. This script exists to answer the seven questions in
 * `docs/projects/project-drive/PROJECT.md` §WP-1 with observed behaviour
 * rather than documentation, and to produce SPIKE-FINDINGS.md. It is not
 * production code and the branch it lives on gets deleted.
 *
 * It is written as a standalone script on purpose. The alternative — wiring
 * the real OAuth routes first and clicking through the app — would mean
 * building WP-4 before knowing whether the chain works at all, which is the
 * exact ordering the spike exists to prevent.
 *
 * WHAT A HUMAN HAS TO DO: press Allow, twice. Everything else is automatic.
 * The script opens a consent URL, waits on localhost:3000 for the redirect,
 * and carries on. It never sees or handles a password.
 *
 *   node scripts/spike/drive-chain.mjs
 *
 * Credentials come from the environment:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 * Pull them with `vercel env pull` rather than typing them anywhere.
 */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

// ── The one scope, stated once ────────────────────────────────────────
// Hard rule §2.1. If this spike ever needs a wider scope to work, that is
// a finding to bring to the founder, not a line to edit.
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const REDIRECT_URI = "http://localhost:3000/api/connections/google/callback";
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const ROOT_FOLDER_NAME = "Signal Studio";
const BOARD_FOLDER_NAME = "Spike board — DELETE ME";

// ── Reporting ─────────────────────────────────────────────────────────

const findings = [];
let failures = 0;

function record(question, verdict, detail, surprise) {
  const pass = verdict === true;
  if (!pass) failures += 1;
  findings.push({ question, pass, detail, surprise });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${question}${detail ? "\n      " + detail : ""}`);
  if (surprise) console.log(`      SURPRISE: ${surprise}`);
}

function step(n, text) {
  console.log(`\n── ${n} · ${text} ${"─".repeat(Math.max(0, 56 - text.length))}`);
}

// ── OAuth, the half a person has to be present for ────────────────────

/**
 * Run the consent flow for one account and return its tokens.
 *
 * `prompt=consent` and `access_type=offline` together are what make Google
 * return a refresh token. Without both, a second authorization of the same
 * account returns an access token only — which looks like our code dropped
 * it, and is one of the things this spike is here to observe rather than
 * assume.
 */
async function authorize(label) {
  const state = randomBytes(16).toString("hex");
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      state,
    });

  console.log(`\n  ${label} — open this, sign in as that account, press Allow:\n`);
  console.log(`  ${url}\n`);

  const code = await waitForCode(state);
  const tokens = await exchange(code);
  return tokens;
}

/** A one-request server that catches Google's redirect and then stops. */
function waitForCode(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, "http://localhost:3000");
      if (!u.pathname.startsWith("/api/connections/google/callback")) {
        res.writeHead(404).end("no");
        return;
      }
      const code = u.searchParams.get("code");
      const state = u.searchParams.get("state");
      const error = u.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<meta charset="utf-8"><body style="font:16px/1.6 system-ui;padding:3rem;max-width:32rem">` +
          `<h1 style="font-size:1.25rem">${error ? "Refused" : "Done"}</h1>` +
          `<p>${error ? "Google said: " + error : "You can close this tab and go back to the terminal."}</p>`,
      );
      server.close();

      if (error) return reject(new Error(`consent refused: ${error}`));
      // The state check is the CSRF control WP-4 will need in the real
      // route. Proving it here means the shape is known before it is built.
      if (state !== expectedState) {
        return reject(new Error("state mismatch — the redirect was not ours"));
      }
      resolve(code);
    });
    server.listen(3000);
    server.on("error", reject);
  });
}

async function exchange(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  return json;
}

// ── Drive calls ───────────────────────────────────────────────────────

async function drive(token, path, init = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function createFolder(token, name, parentId) {
  const r = await drive(token, "files?fields=id,name,webViewLink", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!r.ok) throw new Error(`createFolder ${name}: ${JSON.stringify(r.body)}`);
  return r.body;
}

// ── The seven proofs ──────────────────────────────────────────────────

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      "\nGOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set.\n" +
        "Pull them:  vercel env pull .env.spike --environment=development\n" +
        "Then:       node --env-file=.env.spike scripts/spike/drive-chain.mjs\n",
    );
    process.exit(2);
  }

  console.log("\nWP-1 · proving the Drive chain, with two real accounts");
  console.log(`scope requested: ${SCOPE}\n`);

  // ── 1 · OAuth with drive.file only → refresh token ──────────────────
  step(1, "OAuth for the storage owner (account A)");
  const a = await authorize("ACCOUNT A — the board owner");
  record(
    "1 · OAuth with drive.file only returns a refresh token",
    Boolean(a.refresh_token),
    `granted scope: ${a.scope}`,
    a.scope !== SCOPE
      ? `Google returned a different scope string than we asked for: ${a.scope}`
      : null,
  );
  record(
    "1b · the granted scope is exactly the one we asked for",
    a.scope === SCOPE,
    a.scope,
  );

  step(2, "OAuth for the member (account B)");
  const b = await authorize("ACCOUNT B — the invited member");
  const bEmail = await whoAmI(b.access_token);
  console.log(`  account B is ${bEmail}`);

  // ── 2 · create the root and a board folder ──────────────────────────
  step(3, "Create Signal Studio/ and a board folder inside it");
  const root = await createFolder(a.access_token, ROOT_FOLDER_NAME, null);
  const board = await createFolder(a.access_token, BOARD_FOLDER_NAME, root.id);
  record(
    "2 · a root folder and a board folder inside it are created",
    Boolean(root.id && board.id),
    `root ${root.id}, board ${board.id}`,
  );

  // ── 3 · share the BOARD folder only, with no email ──────────────────
  step(4, "Grant account B writer on the board folder");
  const grant = await drive(
    a.access_token,
    `files/${board.id}/permissions?sendNotificationEmail=false&fields=id`,
    {
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: bEmail }),
    },
  );
  record(
    "3 · permissions.create succeeds under drive.file, with no email sent",
    grant.ok,
    grant.ok ? `permission ${grant.body.id}` : JSON.stringify(grant.body),
    grant.ok
      ? null
      : "This is the load-bearing assumption in D2. If it fails, the whole design changes.",
  );

  const canOpenBefore = await drive(b.access_token, `files/${board.id}?fields=id,name`);
  record(
    "3b · account B can open the board folder without requesting access",
    canOpenBefore.ok,
    canOpenBefore.ok ? canOpenBefore.body.name : `HTTP ${canOpenBefore.status}`,
  );

  // ── 4 · resumable upload, bytes from "the browser" ──────────────────
  step(5, "Mint a resumable session server-side, PUT the bytes separately");
  const resourceId = `spike-${randomBytes(6).toString("hex")}`;
  const sessionUrl = await mintResumableSession(a.access_token, board.id, resourceId);
  record(
    "4 · a resumable upload session is minted server-side",
    Boolean(sessionUrl),
    sessionUrl ? "session URL received" : "no Location header returned",
  );

  const bytes = Buffer.alloc(5 * 1024 * 1024, 0x20);
  Buffer.from("%PDF-1.7\n").copy(bytes, 0);
  const put = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(bytes.length),
      "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}`,
    },
    body: bytes,
  });
  const uploaded = put.ok ? await put.json() : null;
  record(
    "4b · the bytes land in the board folder, sent without our credential in the browser",
    put.ok && uploaded?.parents?.includes(board.id),
    put.ok ? `file ${uploaded.id}, parents ${JSON.stringify(uploaded.parents)}` : `HTTP ${put.status}`,
  );

  // The idempotency claim in D8: the stamp is queryable, and private to us.
  const stamped = await drive(
    a.access_token,
    `files?q=${encodeURIComponent(
      `appProperties has {key='signalResourceId' and value='${resourceId}'} and trashed=false`,
    )}&fields=files(id)`,
  );
  record(
    "4c · the file can be found again by its appProperties stamp (D8 idempotency)",
    stamped.ok && stamped.body.files?.length === 1,
    stamped.ok ? `${stamped.body.files?.length} match` : JSON.stringify(stamped.body),
  );

  // ── 5 · B can open the FILE, not just the folder ────────────────────
  step(6, "Account B opens the file itself");
  const fileForB = await drive(b.access_token, `files/${uploaded.id}?fields=id,name,webViewLink`);
  record(
    "5 · account B can open the file with no request-access step",
    fileForB.ok,
    fileForB.ok ? fileForB.body.webViewLink : `HTTP ${fileForB.status}`,
  );

  // ── 7 · the parent must NOT be visible to B ─────────────────────────
  // Ordered before the revoke on purpose: this is the claim the whole
  // feature makes, and it must hold while the grant is still live.
  step(7, "The Signal Studio parent folder stays invisible to B");
  const rootForB = await drive(b.access_token, `files/${root.id}?fields=id,name`);
  record(
    "7 · the parent folder is NOT reachable by account B",
    !rootForB.ok,
    `HTTP ${rootForB.status} — a 404 here is the correct answer`,
    rootForB.ok
      ? "THE PARENT FOLDER IS VISIBLE. Hard rule §2.2 assumes it is not. Stop and re-read the design."
      : null,
  );

  const listForB = await drive(
    b.access_token,
    `files?q=${encodeURIComponent(`name='${ROOT_FOLDER_NAME}' and trashed=false`)}&fields=files(id,name)`,
  );
  record(
    "7b · account B cannot even find the parent folder by name",
    listForB.ok && (listForB.body.files ?? []).length === 0,
    `${(listForB.body.files ?? []).length} results`,
  );

  // ── 6 · revoke, and confirm the loss ────────────────────────────────
  step(8, "Remove the grant and confirm access is lost");
  const revoke = await drive(
    a.access_token,
    `files/${board.id}/permissions/${grant.body.id}`,
    { method: "DELETE" },
  );
  record("6 · permissions.delete succeeds", revoke.ok, `HTTP ${revoke.status}`);

  const afterRevoke = await drive(b.access_token, `files/${board.id}?fields=id`);
  record(
    "6b · account B loses access to the board folder",
    !afterRevoke.ok,
    `HTTP ${afterRevoke.status} — a 404 here is the correct answer`,
  );

  const fileAfterRevoke = await drive(b.access_token, `files/${uploaded.id}?fields=id`);
  record(
    "6c · account B loses access to the FILE too, by inheritance",
    !fileAfterRevoke.ok,
    `HTTP ${fileAfterRevoke.status}`,
    fileAfterRevoke.ok
      ? "The file outlived the folder grant. Inherited permissions are not behaving as assumed."
      : null,
  );

  // ── Tidy up ─────────────────────────────────────────────────────────
  step(9, "Trash the spike folders");
  await drive(a.access_token, `files/${root.id}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
  console.log("  trashed (not purged — hard rule §2.6 says we never purge)");

  writeReport();
  console.log(`\n${failures === 0 ? "ALL SEVEN PROVED" : failures + " FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function whoAmI(token) {
  const r = await drive(token, "about?fields=user(emailAddress)");
  if (!r.ok) throw new Error(`about.get failed: ${JSON.stringify(r.body)}`);
  return r.body.user.emailAddress;
}

/**
 * The server-side half of D6: mint the session, hand the browser only the
 * URL. The access token never leaves this function.
 */
async function mintResumableSession(token, folderId, resourceId) {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,parents",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "spike-upload.pdf",
        parents: [folderId],
        appProperties: { signalResourceId: resourceId },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`resumable session refused: ${res.status} ${await res.text()}`);
  }
  return res.headers.get("location");
}

function writeReport() {
  const lines = [
    "# WP-1 spike findings",
    "",
    "Observed behaviour, not documentation. Produced by",
    "`scripts/spike/drive-chain.mjs` against two real Google accounts.",
    "",
    `**Run:** ${new Date().toISOString()}`,
    `**Scope requested:** \`${SCOPE}\``,
    "",
    "| # | Question | Result | Observed |",
    "|---|---|---|---|",
    ...findings.map(
      (f) =>
        `| ${f.question.split(" ·")[0]} | ${f.question.replace(/^[0-9a-z]+ · /, "")} | ${
          f.pass ? "pass" : "**FAIL**"
        } | ${String(f.detail ?? "").replace(/\|/g, "\\|")} |`,
    ),
    "",
  ];
  const surprises = findings.filter((f) => f.surprise);
  if (surprises.length) {
    lines.push("## Surprises", "");
    for (const s of surprises) lines.push(`- **${s.question}** — ${s.surprise}`);
    lines.push("");
  }
  lines.push(
    "## Still to verify against live Google documentation",
    "",
    "- Exact consent-screen wording shown for `drive.file`.",
    "- Picker/preview CSP hosts, if the Drive viewer is embedded.",
    "- Whether `changes.watch` under `drive.file` is worth anything later.",
    "- Resumable session lifetime, and behaviour on resume after a gap.",
    "",
  );
  writeFileSync("docs/projects/project-drive/SPIKE-FINDINGS.md", lines.join("\n"));
  console.log("\nwrote docs/projects/project-drive/SPIKE-FINDINGS.md");
}

main().catch((err) => {
  console.error(`\nspike stopped: ${err.message}\n`);
  process.exit(1);
});
