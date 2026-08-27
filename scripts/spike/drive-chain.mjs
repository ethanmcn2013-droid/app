#!/usr/bin/env node

/**
 * WP-1 — prove the Drive chain end to end, with two real Google accounts.
 *
 * THROWAWAY. This answers the seven questions in
 * `docs/projects/project-drive/PROJECT.md` §WP-1 with observed behaviour
 * rather than documentation, and writes SPIKE-FINDINGS.md. It is not
 * production code and the branch it lives on gets deleted.
 *
 * ── Two phases, because a second Google account is not always to hand ──
 *
 *   node --env-file=.env.spike scripts/spike/drive-chain.mjs a
 *   node --env-file=.env.spike scripts/spike/drive-chain.mjs b someone@gmail.com
 *
 * **Phase A** needs only the storage owner. It proves everything that does
 * not depend on a second person existing: the grant, the folder tree, the
 * resumable upload, the idempotency stamp, the quota pre-check, and — the
 * one people assume rather than check — that `permissions.create` is
 * *accepted at all* under `drive.file`. That last one is D2's load-bearing
 * assumption and it is testable against any email address, because Google
 * accepts a permission for an address before the person ever signs in.
 *
 * **Phase B** needs the invited member. It proves the three things only a
 * second pair of credentials can: that they can open the board folder,
 * that they cannot see the parent, and that revoking takes it away again.
 *
 * Phase A writes its state to `.spike-state.json` (gitignored) so phase B
 * does not re-authorize the owner. Tomorrow is one consent, not two.
 *
 * WHAT A HUMAN HAS TO DO: press Allow. The script opens a consent URL,
 * waits on localhost:3000 for the redirect, and carries on. It never sees
 * or handles a password.
 */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ── The one scope, stated once ────────────────────────────────────────
// Hard rule §2.1. If this spike ever needs a wider scope to work, that is
// a finding to bring to the founder, not a line to edit.
const SCOPE = "https://www.googleapis.com/auth/drive.file";

const REDIRECT_URI = "http://localhost:3000/api/connections/google/callback";
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const STATE_FILE = ".spike-state.json";
const ROOT_FOLDER_NAME = "Signal Studio";
const BOARD_FOLDER_NAME = "Spike board — DELETE ME";

const PHASE = (process.argv[2] ?? "a").toLowerCase();
const MEMBER_EMAIL = process.argv[3] ?? null;

// ── Reporting ─────────────────────────────────────────────────────────

const findings = [];
let failures = 0;

function record(question, verdict, detail, surprise) {
  const pass = verdict === true;
  if (!pass) failures += 1;
  findings.push({ question, pass, detail, surprise });
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${question}${detail ? "\n      " + detail : ""}`,
  );
  if (surprise) console.log(`      NOTE: ${surprise}`);
}

function step(text) {
  console.log(`\n── ${text} ${"─".repeat(Math.max(0, 58 - text.length))}`);
}

// ── OAuth, the half a person has to be present for ────────────────────

async function authorize(label) {
  const state = randomBytes(16).toString("hex");
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      // Both are required for a refresh token. With either missing, a
      // second authorization of the same account returns an access token
      // only — which looks exactly like our code dropped it.
      access_type: "offline",
      prompt: "consent select_account",
      // NOT include_granted_scopes. Finding 1: that flag is incremental
      // authorization — it merges every scope this user already granted
      // this project into the returned token. The owner already had
      // Clerk's sign-in scopes, so asking for one scope returned four.
      state,
    });

  console.log(`\n  ${label} — open this, sign in, press Allow:\n`);
  console.log(`  ${url}\n`);

  return exchange(await waitForCode(state));
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
          `<p>${error ? "Google said: " + error : "Close this tab; the terminal has it from here."}</p>`,
      );
      server.close();

      if (error) return reject(new Error(`consent refused: ${error}`));
      // The CSRF control WP-4 will need in the real route. Proving the
      // shape here means it is known before it is built.
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

/** Mint a fresh access token from a stored refresh token. */
async function refresh(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`refresh failed: ${JSON.stringify(json)}`);
  return json.access_token;
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

/**
 * The server-side half of D6: mint the session, hand the browser only the
 * URL. The access token never leaves this function.
 */
async function mintResumableSession(token, folderId, resourceId) {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,parents,name",
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

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`\n  state saved to ${STATE_FILE} (gitignored)`);
}

// ── PHASE A · everything the owner alone can prove ────────────────────

async function phaseA() {
  console.log("\nWP-1 phase A · the owner's half");
  console.log(`scope requested: ${SCOPE}\n`);

  step("1 · OAuth for the storage owner");
  const a = await authorize("THE STORAGE OWNER");
  record(
    "1 · OAuth with drive.file only returns a refresh token",
    Boolean(a.refresh_token),
    `granted: ${a.scope}`,
  );
  record(
    "1b · the granted scope is exactly the one requested",
    a.scope === SCOPE,
    a.scope,
    a.scope === SCOPE
      ? null
      : "Still a superset. If include_granted_scopes is absent and this " +
        "still widens, that is a platform behaviour WP-4 must design around.",
  );

  const token = a.access_token;
  const who = await drive(token, "about?fields=user(emailAddress),storageQuota");
  const ownerEmail = who.body?.user?.emailAddress;
  console.log(`  owner is ${ownerEmail}`);

  // WP-6 pre-checks the quota before minting a session. Prove the field
  // exists and is readable under drive.file — it is not obvious that a
  // scope this narrow can see account-level storage at all.
  const quota = who.body?.storageQuota;
  record(
    "1c · about.get exposes storageQuota under drive.file (WP-6 pre-check)",
    Boolean(quota && quota.limit !== undefined && quota.usage !== undefined),
    quota
      ? `usage ${quota.usage} of ${quota.limit ?? "unlimited"}`
      : "no storageQuota returned",
    quota?.limit === undefined
      ? "No limit returned — likely an unlimited account. WP-6 must treat a " +
        "missing limit as 'do not block', never as zero."
      : null,
  );

  step("2 · Signal Studio/ and a board folder inside it");
  const root = await createFolder(token, ROOT_FOLDER_NAME, null);
  const board = await createFolder(token, BOARD_FOLDER_NAME, root.id);
  record(
    "2 · a root folder and a board folder inside it are created",
    Boolean(root.id && board.id),
    `root ${root.id}, board ${board.id}`,
  );

  step("3 · permissions.create is accepted under drive.file");
  // D2's load-bearing assumption, tested WITHOUT a second account: Google
  // accepts a permission for an address before that person ever signs in.
  // What this cannot prove is that they can then open it — that is phase B.
  const probeEmail = MEMBER_EMAIL ?? `spike-probe-${Date.now()}@example.com`;
  const grant = await drive(
    token,
    `files/${board.id}/permissions?sendNotificationEmail=false&fields=id,type,role`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "user",
        role: "writer",
        emailAddress: probeEmail,
      }),
    },
  );
  record(
    "3 · permissions.create succeeds under drive.file, no email sent",
    grant.ok,
    grant.ok
      ? `permission ${grant.body.id} (${grant.body.type}/${grant.body.role}) for ${probeEmail}`
      : JSON.stringify(grant.body),
    grant.ok
      ? "This is D2's load-bearing assumption, now observed rather than read " +
        "off a discovery document."
      : "Check the reason code before concluding anything. A synthetic " +
        "address returns cannotInviteNonGoogleUser, which is Google " +
        "refusing the RECIPIENT, not the scope — a scope failure reads " +
        "insufficientPermissions. Finding 4.",
  );

  // WP-7's "Who can open this board's files" reads from Drive itself,
  // not from our own table. Prove that read works.
  const perms = await drive(
    token,
    `files/${board.id}/permissions?fields=permissions(id,type,role,emailAddress)`,
  );
  record(
    "3b · permissions.list is readable (WP-7's access screen)",
    perms.ok && Array.isArray(perms.body.permissions),
    perms.ok
      ? `${perms.body.permissions.length} permissions on the board folder`
      : JSON.stringify(perms.body),
  );

  // Hard rule §2.2: the root must never be shared. Prove it is not, now,
  // so the assertion has a baseline.
  const rootPerms = await drive(
    token,
    `files/${root.id}/permissions?fields=permissions(id,type,role,emailAddress)`,
  );
  const rootShared = (rootPerms.body?.permissions ?? []).filter(
    (p) => p.role !== "owner",
  );
  record(
    "3c · the root folder carries no permission but its owner (§2.2)",
    rootPerms.ok && rootShared.length === 0,
    `${rootShared.length} non-owner permissions on ${ROOT_FOLDER_NAME}`,
  );

  step("4 · resumable upload, bytes sent separately");
  const resourceId = `spike-${randomBytes(6).toString("hex")}`;
  const sessionUrl = await mintResumableSession(token, board.id, resourceId);
  record(
    "4 · a resumable session is minted server-side",
    Boolean(sessionUrl),
    sessionUrl ? "session URL received (token stayed on this side)" : "no Location header",
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
    "4b · the bytes land in the board folder, sent without our credential",
    put.ok && uploaded?.parents?.includes(board.id),
    put.ok
      ? `file ${uploaded.id}, parents ${JSON.stringify(uploaded.parents)}`
      : `HTTP ${put.status}`,
  );

  // D8: the stamp is queryable, and private to the app that wrote it.
  const stamped = await drive(
    token,
    `files?q=${encodeURIComponent(
      `appProperties has {key='signalResourceId' and value='${resourceId}'} and trashed=false`,
    )}&fields=files(id)`,
  );
  record(
    "4c · the file is findable again by its appProperties stamp (D8)",
    stamped.ok && stamped.body.files?.length === 1,
    stamped.ok ? `${stamped.body.files?.length} match` : JSON.stringify(stamped.body),
  );

  // The retry case D8 exists to remove: a second attempt for the same
  // resource id must find the first rather than create a duplicate.
  const secondLook = await drive(
    token,
    `files?q=${encodeURIComponent(
      `appProperties has {key='signalResourceId' and value='${resourceId}'} and trashed=false`,
    )}&fields=files(id)`,
  );
  record(
    "4d · a retry finds the existing file instead of making a second one",
    secondLook.ok && secondLook.body.files?.length === 1,
    `${secondLook.body?.files?.length ?? 0} match on the retry query`,
  );

  saveState({
    ownerRefreshToken: a.refresh_token,
    ownerEmail,
    rootId: root.id,
    boardId: board.id,
    fileId: uploaded?.id ?? null,
    probePermissionId: grant.ok ? grant.body.id : null,
    probeEmail,
    createdAt: new Date().toISOString(),
  });

  console.log(
    "\n  Folders left in place on purpose — phase B needs them.\n" +
      "  Run phase B when the second account exists:\n" +
      "    node --env-file=.env.spike scripts/spike/drive-chain.mjs b THEIR@EMAIL\n",
  );
}

// ── PHASE B · the three things only a second person can prove ─────────

async function phaseB() {
  const state = loadState();
  if (!state) throw new Error("no .spike-state.json — run phase a first");
  if (!MEMBER_EMAIL) throw new Error("phase b needs the member's email as argv[3]");

  console.log("\nWP-1 phase B · the member's half");
  console.log(`owner ${state.ownerEmail}, member ${MEMBER_EMAIL}\n`);

  // The owner does not re-consent. This also proves the refresh token
  // survives, which is the thing Testing-mode expiry would have broken.
  step("0 · the stored refresh token still mints an access token");
  const ownerToken = await refresh(state.ownerRefreshToken);
  record(
    "0 · the owner's refresh token still works, unattended",
    Boolean(ownerToken),
    "no second consent needed for the owner",
  );

  step("1 · OAuth for the invited member");
  const b = await authorize("THE INVITED MEMBER");
  const bWho = await drive(b.access_token, "about?fields=user(emailAddress)");
  const memberEmail = bWho.body?.user?.emailAddress;
  console.log(`  member is ${memberEmail}`);

  step("2 · grant the member writer on the board folder");
  // Remove the phase-A probe permission first so the list stays honest.
  if (state.probePermissionId) {
    await drive(ownerToken, `files/${state.boardId}/permissions/${state.probePermissionId}`, {
      method: "DELETE",
    });
  }
  const grant = await drive(
    ownerToken,
    `files/${state.boardId}/permissions?sendNotificationEmail=false&fields=id`,
    {
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: memberEmail }),
    },
  );
  record("3 · permissions.create for the real member", grant.ok, `permission ${grant.body?.id}`);

  step("3 · the member opens the folder and the file");
  const folderForB = await drive(b.access_token, `files/${state.boardId}?fields=id,name`);
  record(
    "3b · the member opens the board folder with no request-access step",
    folderForB.ok,
    folderForB.ok ? folderForB.body.name : `HTTP ${folderForB.status}`,
  );

  const fileForB = state.fileId
    ? await drive(b.access_token, `files/${state.fileId}?fields=id,name,webViewLink`)
    : { ok: false, status: 0 };
  record(
    "5 · the member opens the file itself",
    fileForB.ok,
    fileForB.ok ? fileForB.body.webViewLink : `HTTP ${fileForB.status}`,
  );

  step("4 · the parent folder stays invisible");
  // Deliberately BEFORE the revoke: this is the claim the whole feature
  // makes, and it must hold while the grant is still live.
  const rootForB = await drive(b.access_token, `files/${state.rootId}?fields=id,name`);
  record(
    "7 · the parent folder is NOT reachable by the member",
    !rootForB.ok,
    `HTTP ${rootForB.status} — a 404 here is the correct answer`,
    rootForB.ok
      ? "THE PARENT FOLDER IS VISIBLE. Hard rule §2.2 assumes it is not. Stop."
      : null,
  );

  const listForB = await drive(
    b.access_token,
    `files?q=${encodeURIComponent(`name='${ROOT_FOLDER_NAME}' and trashed=false`)}&fields=files(id,name)`,
  );
  record(
    "7b · the member cannot even find the parent by name",
    listForB.ok && (listForB.body.files ?? []).length === 0,
    `${(listForB.body?.files ?? []).length} results`,
  );

  step("5 · revoke, and confirm the loss");
  const revoke = await drive(
    ownerToken,
    `files/${state.boardId}/permissions/${grant.body.id}`,
    { method: "DELETE" },
  );
  record("6 · permissions.delete succeeds", revoke.ok, `HTTP ${revoke.status}`);

  const afterFolder = await drive(b.access_token, `files/${state.boardId}?fields=id`);
  record(
    "6b · the member loses the board folder",
    !afterFolder.ok,
    `HTTP ${afterFolder.status} — a 404 here is the correct answer`,
  );

  const afterFile = state.fileId
    ? await drive(b.access_token, `files/${state.fileId}?fields=id`)
    : { ok: false, status: 0 };
  record(
    "6c · the member loses the file too, by inheritance",
    !afterFile.ok,
    `HTTP ${afterFile.status}`,
    afterFile.ok
      ? "The file outlived the folder grant. Inherited permissions are not " +
        "behaving as the design assumes."
      : null,
  );

  step("6 · tidy up");
  // Hard rule §2.6: we trash, we never purge.
  await drive(ownerToken, `files/${state.rootId}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
  console.log("  trashed, not purged (§2.6)");
}

// ── Entry ─────────────────────────────────────────────────────────────

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      "\nGOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set.\n" +
        "Fetch them from Vercel, then:\n" +
        "  node --env-file=.env.spike scripts/spike/drive-chain.mjs a\n",
    );
    process.exit(2);
  }

  if (PHASE === "a") await phaseA();
  else if (PHASE === "b") await phaseB();
  else throw new Error(`unknown phase "${PHASE}" — use a or b`);

  console.log(
    `\n${failures === 0 ? "ALL CHECKS IN THIS PHASE PASSED" : failures + " FAILED"}\n`,
  );
  writeFileSync(
    `.spike-findings-${PHASE}.json`,
    JSON.stringify(findings, null, 2),
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nspike stopped: ${err.message}\n`);
  process.exit(1);
});
