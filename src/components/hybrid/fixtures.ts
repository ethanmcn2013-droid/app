import type {
  CalendarDate,
  LabAttachment,
  LabComment,
  LabDataset,
  LabLabel,
  LabPerson,
  LabSubtask,
  LabTask,
  TaskPriority,
  TaskSchedule,
  TaskStatus,
} from "./types";

export const FIXTURE_MANIFEST_ID = "tasks-2026-07-16-v1-48";
export const FIXTURE_SHA256 = "ff72c1e8f0fba3791f5474afc444ae2d2eeb52473d6fdbee4f6fa0d4005fc0be";

export const LAB_PEOPLE: LabPerson[] = [
  { id: "ethan", name: "Ethan", initials: "EC", role: "Founder", color: "var(--accent-hover)" },
  { id: "maya", name: "Maya Chen", initials: "MC", role: "Product", color: "var(--status-done)" },
  { id: "noah", name: "Noah Williams", initials: "NW", role: "Engineering", color: "var(--status-flight)" },
  { id: "aisha", name: "Aisha Khan", initials: "AK", role: "Design", color: "var(--roadmap-rose-fg)" },
  { id: "luca", name: "Luca Moretti", initials: "LM", role: "Growth", color: "color-mix(in srgb, var(--accent) 78%, var(--ink))" },
  { id: "erin", name: "Erin O'Rourke", initials: "EO", role: "Customer", color: "var(--roadmap-violet-fg)" },
  { id: "sam", name: "Sam Reed", initials: "SR", role: "Operations", color: "color-mix(in srgb, var(--status-done) 65%, var(--ink))" },
  { id: "imani", name: "Imani Brooks", initials: "IB", role: "Finance", color: "color-mix(in srgb, var(--status-flight) 60%, var(--ink))" },
];

export const LAB_LABELS: LabLabel[] = [
  { id: "launch", name: "Launch", tone: "accent" },
  { id: "customer", name: "Customer", tone: "success" },
  { id: "platform", name: "Platform", tone: "neutral" },
  { id: "copy", name: "Copy", tone: "neutral" },
  { id: "risk", name: "Risk", tone: "danger" },
  { id: "ops", name: "Operations", tone: "warning" },
];

type Seed = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  schedule: TaskSchedule;
  labelIds?: string[];
  estimate?: string;
  description?: string;
  blockedByIds?: string[];
  blockerIds?: string[];
  completedAt?: string;
};

const U: TaskSchedule = { kind: "unscheduled" };
const due = (dueOn: CalendarDate): TaskSchedule => ({ kind: "due", dueOn });
const range = (startOn: CalendarDate, dueOn: CalendarDate): TaskSchedule => ({ kind: "range", startOn, dueOn });
const milestone = (on: CalendarDate): TaskSchedule => ({ kind: "milestone", on });

const SEEDS: Seed[] = [
  { id: "launch-01", title: "Finalize launch positioning", status: "queued", priority: "urgent", assigneeIds: ["ethan", "maya"], schedule: U, labelIds: ["launch", "copy"] },
  { id: "launch-02", title: "Approve onboarding copy", status: "queued", priority: "high", assigneeIds: ["maya", "aisha"], schedule: U, labelIds: ["copy"] },
  { id: "launch-03", title: "Confirm press briefing schedule", status: "queued", priority: "normal", assigneeIds: ["luca"], schedule: due("2026-07-22"), labelIds: ["launch"] },
  { id: "launch-04", title: "Write the migration notice for existing workspaces", status: "queued", priority: "normal", assigneeIds: [], schedule: U, labelIds: ["customer", "copy"] },
  { id: "launch-05", title: "Produce launch-day support runbook", status: "queued", priority: "high", assigneeIds: ["sam", "erin"], schedule: range("2026-07-20", "2026-07-22"), labelIds: ["ops", "launch"] },
  { id: "launch-06", title: "Public launch", status: "queued", priority: "urgent", assigneeIds: ["ethan", "maya", "noah", "aisha", "luca", "erin", "sam"], schedule: milestone("2026-07-22"), labelIds: ["launch"] },
  { id: "launch-07", title: "Draft founder launch note", status: "queued", priority: "normal", assigneeIds: ["ethan"], schedule: U, labelIds: ["copy"] },
  { id: "launch-08", title: "Resolve stale billing copy in the upgrade flow", status: "queued", priority: "high", assigneeIds: ["noah", "imani"], schedule: due("2026-07-10"), labelIds: ["risk"] },
  { id: "launch-09", title: "Prepare customer migration guide", status: "queued", priority: "normal", assigneeIds: ["erin", "maya", "aisha", "sam"], schedule: range("2026-07-23", "2026-07-29"), labelIds: ["customer", "copy"] },
  { id: "launch-10", title: "Check App Store launch-language consistency", status: "queued", priority: "low", assigneeIds: ["aisha"], schedule: U, labelIds: ["copy"] },
  { id: "launch-11", title: "Document the rollback owner, exact release abort conditions, communication sequence, and customer-safe recovery path before the first public announcement is scheduled", status: "queued", priority: "high", assigneeIds: ["sam", "noah"], schedule: due("2026-07-19"), labelIds: ["risk", "ops"] },
  { id: "launch-12", title: "Verify launch-readiness-evidence-ledger-without-whitespace-or-accidental-soft-wrapping-in-the-primary-task-surface", status: "queued", priority: "low", assigneeIds: ["sam"], schedule: due("2026-08-03"), labelIds: ["ops"] },

  { id: "launch-13", title: "Review homepage motion prototype", status: "active", priority: "high", assigneeIds: ["aisha", "noah"], schedule: range("2026-07-16", "2026-07-22"), labelIds: ["launch"] },
  { id: "launch-14", title: "QA subscription upgrade flow", status: "active", priority: "urgent", assigneeIds: ["noah", "imani", "maya", "erin"], schedule: U, labelIds: ["risk", "customer"] },
  { id: "launch-15", title: "Sign off analytics event map", status: "active", priority: "high", assigneeIds: ["maya", "noah"], schedule: due("2026-07-22"), labelIds: ["platform"] },
  { id: "launch-16", title: "Resolve mobile navigation regression", status: "active", priority: "urgent", assigneeIds: ["noah", "aisha"], schedule: range("2026-07-08", "2026-07-14"), labelIds: ["risk", "platform"] },
  { id: "launch-17", title: "Build release health dashboard receipts", status: "active", priority: "normal", assigneeIds: ["noah", "sam"], schedule: range("2026-07-20", "2026-07-22"), labelIds: ["platform", "ops"] },
  { id: "launch-18", title: "Reconcile production environment inventory", status: "active", priority: "high", assigneeIds: ["sam", "noah", "imani"], schedule: U, labelIds: ["risk", "ops"] },
  { id: "launch-19", title: "Complete keyboard pass for account setup", status: "active", priority: "high", assigneeIds: ["aisha", "noah"], schedule: due("2026-07-18"), labelIds: ["customer"] },
  { id: "launch-20", title: "Polish invitation acceptance states", status: "active", priority: "normal", assigneeIds: ["aisha"], schedule: range("2026-07-21", "2026-07-24"), labelIds: ["customer"] },
  { id: "launch-21", title: "Test the first-run planning period handoff from Notes into Tasks with a real founder workflow and enough context to expose every ambiguity", status: "active", priority: "normal", assigneeIds: ["maya", "erin", "sam"], schedule: due("2026-07-26"), labelIds: ["customer", "platform"] },
  { id: "launch-22", title: "Capture pre-launch performance profile", status: "active", priority: "normal", assigneeIds: ["noah"], schedule: range("2026-07-27", "2026-08-02"), labelIds: ["platform"] },
  { id: "launch-23", title: "Validate canonical suite footer links", status: "active", priority: "low", assigneeIds: [], schedule: due("2026-08-05"), labelIds: ["platform"] },

  { id: "launch-24", title: "Review launch narrative against product receipts", status: "review", priority: "high", assigneeIds: ["ethan", "maya", "luca"], schedule: due("2026-07-22"), labelIds: ["launch", "copy"] },
  { id: "launch-25", title: "Approve customer proof selections", status: "review", priority: "normal", assigneeIds: ["ethan", "erin"], schedule: milestone("2026-07-31"), labelIds: ["customer"] },
  { id: "launch-26", title: "Review empty and partial failure states", status: "review", priority: "high", assigneeIds: ["aisha", "noah", "maya"], schedule: U, labelIds: ["risk"] },
  { id: "launch-27", title: "Confirm data export wording", status: "review", priority: "normal", assigneeIds: ["imani", "maya"], schedule: due("2026-07-20"), labelIds: ["copy", "risk"] },
  { id: "launch-28", title: "Audit dense Board wrapping", status: "review", priority: "normal", assigneeIds: ["aisha"], schedule: range("2026-07-21", "2026-07-22"), labelIds: ["platform"] },
  { id: "launch-29", title: "Check transactional email rendering", status: "review", priority: "low", assigneeIds: ["erin", "noah"], schedule: due("2026-07-28"), labelIds: ["customer"] },
  { id: "launch-30", title: "Approve the complete customer handoff sequence across Notes, Tasks, Timeline, and Signal without collapsing product responsibilities or obscuring which surface owns the next decision", status: "review", priority: "high", assigneeIds: ["ethan", "maya", "erin", "sam"], schedule: range("2026-07-30", "2026-08-06"), labelIds: ["customer", "platform"] },
  { id: "launch-31", title: "Legal copy receipt", status: "review", priority: "normal", assigneeIds: ["imani"], schedule: due("2026-08-07"), labelIds: ["risk"] },

  { id: "launch-32", title: "Schedule stakeholder readiness review", status: "waiting", priority: "high", assigneeIds: ["sam", "ethan"], schedule: due("2026-07-22"), labelIds: ["ops"], blockedByIds: ["launch-18"] },
  { id: "launch-33", title: "Receive payment-provider production approval", status: "waiting", priority: "urgent", assigneeIds: ["imani"], schedule: U, labelIds: ["risk"], blockerIds: ["launch-34"] },
  { id: "launch-34", title: "Run live checkout receipt", status: "waiting", priority: "urgent", assigneeIds: ["noah", "imani"], schedule: due("2026-07-12"), labelIds: ["risk"], blockedByIds: ["launch-33"] },
  { id: "launch-35", title: "Receive final customer quote approval", status: "waiting", priority: "normal", assigneeIds: ["erin", "luca"], schedule: due("2026-07-25"), labelIds: ["customer"] },
  { id: "launch-36", title: "Confirm launch-day support rota", status: "waiting", priority: "high", assigneeIds: ["sam", "erin", "noah", "maya"], schedule: U, labelIds: ["ops"] },
  { id: "launch-37", title: "Waiting on domain verification", status: "waiting", priority: "normal", assigneeIds: [], schedule: range("2026-07-31", "2026-08-03"), labelIds: ["platform"], blockedByIds: ["missing-external-task"] },
  { id: "launch-38", title: "Confirm finance sign-off", status: "waiting", priority: "low", assigneeIds: ["imani"], schedule: U, labelIds: ["ops"] },

  { id: "launch-39", title: "Create launch workspace", status: "done", priority: "normal", assigneeIds: ["maya"], schedule: due("2026-07-05"), labelIds: ["launch"], completedAt: "2026-07-05T16:30:00+01:00" },
  { id: "launch-40", title: "Lock product naming", status: "done", priority: "high", assigneeIds: ["ethan", "maya"], schedule: due("2026-07-22"), labelIds: ["copy"], completedAt: "2026-07-09T11:00:00+01:00" },
  { id: "launch-41", title: "Planning period opened", status: "done", priority: "normal", assigneeIds: ["ethan"], schedule: milestone("2026-07-01"), labelIds: ["ops"], completedAt: "2026-07-01T09:10:00+01:00" },
  { id: "launch-42", title: "Map launch dependencies", status: "done", priority: "normal", assigneeIds: ["sam", "maya"], schedule: U, labelIds: ["ops"], completedAt: "2026-07-07T14:00:00+01:00" },
  { id: "launch-43", title: "Publish internal release checklist", status: "done", priority: "low", assigneeIds: ["sam"], schedule: range("2026-07-02", "2026-07-04"), labelIds: ["ops"], completedAt: "2026-07-04T12:20:00+01:00" },
  { id: "launch-44", title: "Validate suite navigation labels", status: "done", priority: "normal", assigneeIds: ["aisha", "maya"], schedule: due("2026-07-08"), labelIds: ["platform"], completedAt: "2026-07-08T15:00:00+01:00" },
  { id: "launch-45", title: "Archive superseded launch draft", status: "done", priority: "low", assigneeIds: [], schedule: range("2026-06-29", "2026-07-02"), labelIds: ["copy"], completedAt: "2026-07-02T10:00:00+01:00" },
  { id: "launch-46", title: "Confirm launch metrics owner", status: "done", priority: "normal", assigneeIds: ["maya", "luca"], schedule: due("2026-07-13"), labelIds: ["launch"], completedAt: "2026-07-13T17:00:00+01:00" },
  { id: "launch-47", title: "Remove obsolete preview banner", status: "done", priority: "low", assigneeIds: ["noah"], schedule: U, labelIds: ["platform"], completedAt: "2026-07-14T18:20:00+01:00" },
  { id: "launch-48", title: "Close the first launch risk review", status: "done", priority: "high", assigneeIds: ["ethan", "sam", "imani"], schedule: due("2026-07-15"), labelIds: ["risk"], completedAt: "2026-07-15T16:45:00+01:00" },
];

const EDGE_IDS = new Set([
  "launch-01", "launch-04", "launch-05", "launch-06", "launch-08", "launch-09",
  "launch-11", "launch-12", "launch-14", "launch-16", "launch-18", "launch-21",
  "launch-23", "launch-24", "launch-25", "launch-26", "launch-30", "launch-32",
  "launch-33", "launch-34", "launch-36", "launch-37", "launch-39", "launch-41",
]);

const SPARSE_IDS = new Set([
  "launch-01", "launch-03", "launch-04", "launch-13",
  "launch-16", "launch-24", "launch-39", "launch-41",
]);

function launchSubtasks(): LabSubtask[] {
  return [
    "Publish escalation contacts",
    "Confirm incident channel",
    "Write rollback steps",
    "Assign checkout observer",
    "Assign onboarding observer",
    "Prepare customer reply macros",
    "Record status-page owner",
    "Run final tabletop",
  ].map((title, index) => ({ id: `sub-${index + 1}`, title, completed: index < 5 }));
}

function richAttachments(): LabAttachment[] {
  return [
    ["launch-event-map-v7.pdf", "PDF", "1.8 MB", "ready"],
    ["subscription-upgrade-recording.mp4", "Video", "28.2 MB", "ready"],
    ["customer-migration-copy.docx", "Document", "840 KB", "ready"],
    ["production-environment-inventory-final-reviewed-and-signed-off.xlsx", "Spreadsheet", "2.4 MB", "ready"],
    ["mobile-regression-screens.zip", "Archive", "8.9 MB", "ready"],
    ["provider-approval-receipt.pdf", "PDF", "0 KB", "error"],
  ].map(([name, kind, size, state], index) => ({
    id: `attachment-${index + 1}`,
    name,
    kind,
    size,
    state: state as "ready" | "error",
  }));
}

function reviewComments(): LabComment[] {
  const bodies = [
    "The product claim is now tied to the release receipt.",
    "Homepage copy matches the current onboarding path.",
    "Please keep the provider gate explicit in the launch note.",
    "Mobile wrapping is clean at the supported minimum width.",
    "I added the customer-language version of this paragraph.",
    "The analytics event name still needs one final check.",
    "Resolved the naming mismatch in the evidence list.",
    "This is ready for founder review.",
    "Can we make the rollback condition plainer?",
    "Updated with the exact operator and timestamp.",
    "All linked receipts open without authentication drift.",
    "Approved from customer readiness.",
  ];
  return bodies.map((body, index) => ({
    id: `comment-${index + 1}`,
    authorId: LAB_PEOPLE[index % LAB_PEOPLE.length].id,
    body,
    createdAt: `2026-07-${String(10 + Math.floor(index / 3)).padStart(2, "0")}T${String(9 + (index % 6)).padStart(2, "0")}:00:00+01:00`,
  }));
}

export const LAB_DESCRIPTIONS = [
  "Reduce the launch thesis to one sentence the homepage, onboarding, and sales reply can all support with evidence.",
  "Resolve the final voice and expectation-setting notes across welcome, workspace creation, and first-task guidance.",
  "Lock the briefing window, spokesperson, embargo note, and a named fallback if launch timing moves.",
  "Explain what existing workspace owners will see, what remains unchanged, and where to get help.",
  "Give the launch crew one operational sequence for monitoring, escalation, rollback, customer replies, and closure.",
  "The public release checkpoint: operator gates closed, receipts attached, support staffed, and go/no-go recorded.",
  "Write a short founder note grounded in what shipped, who it helps, and what the studio learned by building it.",
  "Replace the stale plan language with the current entitlement, billing cadence, and upgrade consequence.",
  "Create a calm, step-by-step guide for moving live work without losing owners, dates, or task history.",
  "Check every iOS and App Store reference against the actual availability, naming, and support promise.",
  "Name the release owner, abort thresholds, communication order, and customer-safe path back to a stable state.",
  "Prove the primary task surface can carry a long receipt identifier without hiding controls or breaking the grid.",
  "Review timing, reduced-motion behavior, message hierarchy, and whether motion explains a real product change.",
  "Exercise upgrade, authentication return, invoice state, cancellation, and failure recovery with production-like accounts.",
  "Confirm every launch decision emits one named event with clear properties, ownership, and a testable destination.",
  "Reproduce the narrow-screen navigation fault, land the fix, and record keyboard and touch receipts.",
  "Collect the small set of operational receipts needed to tell whether release health is stable or drifting.",
  "Reconcile every production variable, provider, domain, owner, and last verified timestamp before go-live.",
  "Complete the account-setup path without a pointer, including errors, recovery, focus order, and final confirmation.",
  "Polish accepted, expired, revoked, wrong-account, and retry states while preserving the invitation context.",
  "Run a founder-sized planning period from Notes into Tasks and confirm the next handoff remains obvious.",
  "Capture launch, dense scrolling, inspector opening, and date manipulation under a representative workload.",
  "Verify every suite and product link resolves to the canonical public destination with honest availability language.",
  "Check every public launch statement against a shipped-state receipt and remove anything the product cannot yet prove.",
  "Choose the strongest customer evidence, record permission, and keep the wording specific enough to be credible.",
  "Review empty, loading, partial failure, full failure, retry, and stale-link states without disguising failure as no data.",
  "Make export scope, format, timing, ownership, and privacy consequences clear before the user commits.",
  "Stress long titles, busy lanes, WIP pressure, selection, drag targets, and the smallest supported desktop.",
  "Check subject, preview, dark-client fallback, narrow layout, links, and the reply path in representative inboxes.",
  "Confirm Notes, Tasks, Timeline, and Signal each own a distinct decision while preserving one coherent handoff.",
  "Attach the approved terms, privacy, cancellation, data-use, and company-detail receipt for release review.",
  "Bring product, support, operations, and finance to one short go/no-go review with named open conditions.",
  "Obtain the provider's production approval and record the account, capability, region, and operator who verified it.",
  "Run a real low-value checkout through success, webhook, entitlement, receipt, refund, and customer-visible history.",
  "Get final permission for the selected customer language and document any channel or timing restrictions.",
  "Publish named primary and backup coverage for checkout, onboarding, support, incidents, and status updates.",
  "Complete the DNS challenge, verify the production hostname, and retain the provider receipt and renewal owner.",
  "Record the final cost, tax, refund, provider, and cash-control sign-off with one accountable owner.",
  "The launch workspace was created with the correct Planning Period, owners, views, and review fixture.",
  "The product and suite naming decision is locked across navigation, billing, help, analytics, and public copy.",
  "The Public launch planning period is open with a clear outcome, date boundary, owner, and review cadence.",
  "The critical launch dependencies are mapped with explicit blockers, dependents, owners, and safe orphan handling.",
  "The internal release checklist is published with operator steps, receipts, stop conditions, and completion owners.",
  "Suite navigation labels now match the product contract and avoid duplicating view-level decisions.",
  "The superseded launch draft is archived with a pointer to the current decision and no remaining public links.",
  "Launch metrics have one accountable owner, a frozen event map, and a clear first review window.",
  "The obsolete preview banner is removed without changing the production authentication or access posture.",
  "The first launch risk review is closed with decisions, residual risks, owners, and the next evidence date.",
] as const;

function buildTask(seed: Seed, index: number): LabTask {
  const completed = seed.status === "done";
  return {
    id: seed.id,
    title: seed.title,
    description: seed.description ?? LAB_DESCRIPTIONS[index],
    status: seed.status,
    priority: seed.priority,
    assigneeIds: [...seed.assigneeIds],
    schedule: seed.schedule,
    estimate: seed.estimate ?? (["30m", "1h", "2h", "Half day", "1 day"] as const)[index % 5],
    labelIds: seed.labelIds ?? ["launch"],
    subtasks: seed.id === "launch-05" ? launchSubtasks() : index % 9 === 0
      ? [{ id: `${seed.id}-sub-1`, title: "Confirm owner", completed: completed }]
      : [],
    attachments: seed.id === "launch-15" ? richAttachments() : index % 7 === 0
      ? [{ id: `${seed.id}-file-1`, name: "working-notes.pdf", kind: "PDF", size: "420 KB", state: "ready" }]
      : [],
    comments: seed.id === "launch-24" ? reviewComments() : index % 5 === 0
      ? [{ id: `${seed.id}-comment-1`, authorId: "maya", body: "Owner and next handoff confirmed.", createdAt: "2026-07-15T14:00:00+01:00" }]
      : [],
    blockedByIds: seed.blockedByIds ?? [],
    blockerIds: seed.blockerIds ?? [],
    completed,
    completedAt: seed.completedAt,
    workspaceId: "workspace-launch-2026",
    order: index,
  };
}

export const LAB_TASKS: LabTask[] = SEEDS.map(buildTask);

export function tasksForDataset(dataset: LabDataset): LabTask[] {
  const source = dataset === "sparse"
    ? LAB_TASKS.filter((task) => SPARSE_IDS.has(task.id))
    : dataset === "normal"
      ? LAB_TASKS.slice(0, 40)
      : dataset === "edge"
        ? LAB_TASKS.filter((task) => EDGE_IDS.has(task.id))
        : LAB_TASKS;
  return structuredClone(source);
}

// Runtime registries. In the design-lab route these are never set and the
// fixed LAB_PEOPLE/LAB_LABELS seeds are used. In production the hybrid mount
// calls setRuntimePeople/setRuntimeLabels on every render, which makes the
// registry AUTHORITATIVE: once set, an id that is not in it does not resolve,
// and an empty registry yields an empty list. Fixture people must never be
// offered or rendered against live data — before this gate, a workspace with
// an unpopulated registry listed eight design-lab people in the real assign
// menu, and choosing one wrote a fixture id into the production database.
const runtimePeople = new Map<string, LabPerson>();
const runtimeLabels = new Map<string, LabLabel>();
let runtimePeopleActive = false;
let runtimeLabelsActive = false;

export function setRuntimePeople(people: LabPerson[]): void {
  runtimePeopleActive = true;
  runtimePeople.clear();
  for (const person of people) runtimePeople.set(person.id, person);
}

export function setRuntimeLabels(labels: LabLabel[]): void {
  runtimeLabelsActive = true;
  runtimeLabels.clear();
  for (const label of labels) runtimeLabels.set(label.id, label);
}

export function personById(id: string): LabPerson | undefined {
  if (runtimePeopleActive) return runtimePeople.get(id);
  return LAB_PEOPLE.find((person) => person.id === id);
}

export function listPeople(): LabPerson[] {
  if (runtimePeopleActive) return [...runtimePeople.values()];
  return LAB_PEOPLE;
}

export function labelById(id: string): LabLabel | undefined {
  if (runtimeLabelsActive) {
    // Unknown live tag → neutral chip with its own name; never a fixture tone.
    return runtimeLabels.get(id) ?? { id, name: id, tone: "neutral" };
  }
  return LAB_LABELS.find((label) => label.id === id);
}

/** Test-only: return both registries to the lab-fixture default. */
export function resetRuntimeRegistriesForTests(): void {
  runtimePeopleActive = false;
  runtimeLabelsActive = false;
  runtimePeople.clear();
  runtimeLabels.clear();
}
