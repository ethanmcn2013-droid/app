import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const files = [
  "experience/browser-contract.json", "package.json",
  ...["playwright.config.ts", "server.mjs", "personal-chat.spec.ts", "reporter.ts"].map(file => `experience/personal-chat-files-browser/${file}`),
  "src/components/app/messages/personal-chat.tsx", "src/components/app/messages/personal-attachments.module.css",
  "src/components/app/messages/personal-attachments.tsx", "src/components/app/messages/use-personal-attachments.ts",
  "src/components/app/messages/personal-attachment-client.ts", "src/components/app/messages/chat-ui.tsx",
  "src/components/app/messages/use-floating-chat-viewport.ts",
  "src/components/app/messages/floating-chat-root.tsx", "src/components/app/messages/floating-chat.module.css",
  "src/components/primitives/toast.tsx", "src/app/globals.css",
];
export default class SourceReceipt implements Reporter {
  private root = "";
  private output = "";
  private before: Record<string, string> = {};
  private cases: object[] = [];
  private hashes() {
    return Object.fromEntries(files.map(file => [file, createHash("sha256").update(readFileSync(path.join(this.root, file))).digest("hex")]));
  }
  onBegin(config: FullConfig) {
    this.root = config.webServer?.cwd ?? process.cwd();
    this.output = config.projects[0].outputDir;
    this.before = this.hashes();
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const caseId = createHash("sha256").update(test.id).digest("hex").slice(0, 16);
    const directory = path.join(this.output, "attachments", `${caseId}-retry-${result.retry}`);
    mkdirSync(directory, { recursive: true });
    const attachments = result.attachments.map((item, index) => {
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "application/json": "json", "text/plain": "txt", "application/zip": "zip" };
      const extension = extensions[item.contentType] ?? "bin";
      const name = item.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "attachment";
      const target = path.join(directory, `${index}-${name}.${extension}`);
      if (item.body !== undefined) writeFileSync(target, item.body);
      else if (item.path) copyFileSync(item.path, target);
      else throw new Error(`Attachment has neither body nor path: ${item.name}`);
      const bytes = readFileSync(target);
      return { name: item.name, contentType: item.contentType, path: path.relative(this.root, target), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
    });
    this.cases.push({ title: test.titlePath(), status: result.status, expected: test.expectedStatus, durationMs: result.duration, errors: result.errors.map(error => error.message), attachments });
  }
  async onEnd(result: FullResult) {
    const after = this.hashes();
    const sourceStable = JSON.stringify(after) === JSON.stringify(this.before);
    const index = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? index(path.join(dir, item.name)) : [path.relative(this.root, path.join(dir, item.name))]);
    mkdirSync(this.output, { recursive: true });
    writeFileSync(path.join(this.output, "receipt.json"), JSON.stringify({
      status: sourceStable ? result.status : "failed", runnerStatus: result.status, source: this.root,
      HEAD: execFileSync("git", ["rev-parse", "HEAD"], { cwd: this.root, encoding: "utf8" }).trim(),
      dirty: execFileSync("git", ["status", "--short", "--", ...files], { cwd: this.root, encoding: "utf8" }),
      buildId: existsSync(path.join(this.root, ".next/BUILD_ID")) ? readFileSync(path.join(this.root, ".next/BUILD_ID"), "utf8").trim() : null,
      discoveryOnlyOrNoCases: this.cases.length === 0,
      sourceHashes: this.before, sourceHashesAfter: after, sourceStable,
      scope: "Actual built Next demo/preview UI; synthetic tab-local files/messages and explicit tasks:toast events. No auth/provider/durable-account/physical-keyboard proof.",
      cases: this.cases, artifacts: index(this.output),
    }, null, 2));
    if (!sourceStable) return { status: "failed" as const };
  }
}
