import "server-only";

import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { taskFocusPath } from "@/lib/product-urls";
import type { ChatPerson } from "@/components/app/messages/chat-view-model";
import type { DemoConversation, DemoMessage, DemoMessagesSnapshot } from "@/components/app/messages/demo-messages-model";
import { DEMO_USER_ID, DEMO_WORKSPACE_ID, DEMO_WORKSPACE_NAME, demoTasks } from "./tasks-demo";

/**
 * In-memory Messages for access-mode demo/review (see lib/access-mode.ts).
 *
 * The same Orchard story the other review surfaces tell, as the venue team
 * would talk about it on the review clock (Thursday 16 July, 09:00 in
 * Dublin). No database, conversation service or provider is read on this
 * path, and nothing a reviewer sends leaves their browser tab.
 *
 * Task threads are only seeded where the Tasks demo already counts comments,
 * so a card's comment count and its thread here agree.
 */

const PEOPLE = {
  orla: { id: DEMO_USER_ID, name: REVIEW_SUITE_FIXTURE.user.name, role: "Events manager" },
  niamh: { id: "demo-member-niamh", name: "Niamh Kelly", role: "Floor lead", online: true },
  dara: { id: "demo-member-dara", name: "Dara Quinn", role: "Head chef" },
  aoife: { id: "demo-member-aoife", name: "Aoife Walsh", role: "Bar manager", online: true },
  ciaran: { id: "demo-member-ciaran", name: "Ciarán Byrne", role: "Grounds and setup" },
} as const satisfies Record<string, ChatPerson>;

/** Every seeded instant falls in Irish Summer Time (UTC+1). */
const ist = (date: string, time: string) => Date.parse(`${date}T${time}:00+01:00`);
const TODAY = PINNED_REVIEW_CALENDAR_FRAME.today;
const YESTERDAY = "2026-07-15";

const ROOM = "demo-conversation-project";
const DM_NIAMH = "demo-conversation-dm-niamh";
const DM_AOIFE = "demo-conversation-dm-aoife";
const DM_DARA = "demo-conversation-dm-dara";
const DM_CIARAN = "demo-conversation-dm-ciaran";
const TASK_RUN_SHEET = "demo-conversation-task-run-sheet";
const TASK_SEATING = "demo-conversation-task-seating";

type Seed = Omit<DemoMessage, "conversationId" | "authorId"> & { author: keyof typeof PEOPLE };

function thread(conversationId: string, seeds: readonly Seed[]): DemoMessage[] {
  return seeds.map(({ author, ...message }) => ({ ...message, conversationId, authorId: PEOPLE[author].id }));
}

const STATUS_LABEL = { todo: "To do", doing: "In progress", review: "In review", done: "Done" } as const;

function taskRef(taskId: string) {
  const task = demoTasks().find((item) => item.id === taskId);
  if (!task) throw new Error(`messages demo references a missing task: ${taskId}`);
  const status = task.lane === "todo" || task.lane === "doing" || task.lane === "review" || task.lane === "done" ? task.lane : "todo";
  const dueLabel = task.dueAt
    ? task.dueAt.toISOString().slice(0, 10) === TODAY ? "Due today" : `Due ${task.due ?? task.dueAt.toISOString().slice(0, 10)}`
    : null;
  return { id: task.id, title: task.title, status, statusLabel: STATUS_LABEL[status], dueLabel, href: taskFocusPath(task.id) };
}

export function demoMessagesSnapshot(): DemoMessagesSnapshot {
  const everyone = Object.values(PEOPLE).map((person) => person.id);
  const runSheet = taskRef("demo-t-05");
  const seating = taskRef("demo-t-07");
  const tonic = taskRef("demo-t-06");

  const conversations: DemoConversation[] = [
    {
      id: ROOM, kind: "project", title: DEMO_WORKSPACE_NAME, memberIds: everyone, unread: 4, mentions: 1,
      about: `Everyone in ${DEMO_WORKSPACE_NAME} can read and reply here. Messages stay inside this Project.`,
    },
    { id: DM_NIAMH, kind: "dm", title: PEOPLE.niamh.name, otherId: PEOPLE.niamh.id, memberIds: [PEOPLE.orla.id, PEOPLE.niamh.id], unread: 1, mentions: 0, about: "Only the two of you can read this conversation." },
    { id: DM_AOIFE, kind: "dm", title: PEOPLE.aoife.name, otherId: PEOPLE.aoife.id, memberIds: [PEOPLE.orla.id, PEOPLE.aoife.id], unread: 2, mentions: 0, about: "Only the two of you can read this conversation." },
    { id: DM_DARA, kind: "dm", title: PEOPLE.dara.name, otherId: PEOPLE.dara.id, memberIds: [PEOPLE.orla.id, PEOPLE.dara.id], unread: 0, mentions: 0, about: "Only the two of you can read this conversation." },
    { id: DM_CIARAN, kind: "dm", title: PEOPLE.ciaran.name, otherId: PEOPLE.ciaran.id, memberIds: [PEOPLE.orla.id, PEOPLE.ciaran.id], request: { requesterId: PEOPLE.ciaran.id }, unread: 0, mentions: 0, about: "Only the two of you can read this conversation." },
    { id: TASK_RUN_SHEET, kind: "task", title: runSheet.title, task: runSheet, memberIds: everyone, unread: 1, mentions: 1, about: "Discussion on this task. Everyone in the Project can read and reply." },
    { id: TASK_SEATING, kind: "task", title: seating.title, task: seating, memberIds: everyone, unread: 1, mentions: 0, about: "Discussion on this task. Everyone in the Project can read and reply." },
  ];

  const messages: DemoMessage[] = [
    ...thread(ROOM, [
      { id: "demo-message-01", author: "niamh", createdAt: ist(YESTERDAY, "16:02"), body: "Open day recap: nine couples through, three asked about dates. The tea urn did most of the selling." },
      { id: "demo-message-02", author: "niamh", createdAt: ist(YESTERDAY, "16:03"), body: "Can we run the same format again in spring? Same Sunday slot." },
      { id: "demo-message-03", author: "orla", createdAt: ist(YESTERDAY, "16:20"), body: "Yes. I'll put it in the spring plan and hold the second Sunday in April." },
      { id: "demo-message-04", author: "aoife", createdAt: ist(YESTERDAY, "17:45"), body: "Tonic is low after the open day. Two cases are on order with Greenfield, but the olive delivery came short again.", linkedTask: { id: tonic.id, title: tonic.title, href: tonic.href, status: tonic.status, statusLabel: tonic.statusLabel } },
      { id: "demo-message-05", author: "dara", createdAt: ist(TODAY, "07:52"), body: "Morning all. Mara & Finn's tasting is on 1 August and I still need their final dietary list before I lock the service notes." },
      { id: "demo-reply-01", author: "orla", createdAt: ist(TODAY, "08:05"), rootId: "demo-message-05", body: "I'll chase Mara today. Last I heard: two vegetarian, one coeliac, one nut allergy." },
      { id: "demo-reply-02", author: "dara", createdAt: ist(TODAY, "08:11"), rootId: "demo-message-05", body: "That matches mine. The coeliac guest is the one I need confirmed in writing." },
      { id: "demo-reply-03", author: "niamh", createdAt: ist(TODAY, "08:14"), rootId: "demo-message-05", body: "I'll print allergen cards for the tables once it's confirmed." },
      { id: "demo-message-06", author: "niamh", createdAt: ist(TODAY, "08:20"), body: "Saturday's forecast has rain likely after 3pm. https://www.met.ie/forecasts" },
      { id: "demo-message-07", author: "niamh", createdAt: ist(TODAY, "08:21"), body: "@Orla do we call the marquee sides now, or wait for tomorrow's update?" },
      { id: "demo-message-08", author: "aoife", createdAt: ist(TODAY, "08:34"), body: "If it's the marquee, I'll move the bar into the orangery. I need two of the floor team at 1pm to carry it." },
      { id: "demo-message-09", author: "dara", createdAt: ist(TODAY, "08:41"), body: "Run-sheet question: are speeches before or after the main course? Kitchen timing moves by 20 minutes either way." },
      { id: "demo-message-10", author: "niamh", createdAt: ist(TODAY, "08:47"), body: "Before. The best man asked to go first so he can enjoy his dinner. I've updated the run-sheet." },
    ]),
    ...thread(DM_NIAMH, [
      { id: "demo-dm-n-01", author: "niamh", createdAt: ist(YESTERDAY, "18:10"), body: "Heads up: Mara rang the front desk about the seating plan. She wants the top table away from the speakers." },
      { id: "demo-dm-n-02", author: "orla", createdAt: ist(YESTERDAY, "18:12"), body: "Thanks. I moved it last night. It's in review now." },
      { id: "demo-dm-n-03", author: "niamh", createdAt: ist(YESTERDAY, "18:13"), body: "Perfect. I'll check sightlines to the arch in the morning." },
      { id: "demo-dm-n-04", author: "niamh", createdAt: ist(TODAY, "08:52"), body: "Are you in before ten? Mara wants to drop the favours off on her way to work." },
    ]),
    ...thread(DM_AOIFE, [
      { id: "demo-dm-a-01", author: "orla", createdAt: ist("2026-07-14", "11:05"), body: "Could you cost a signature cocktail for Mara & Finn? Something with elderflower." },
      { id: "demo-dm-a-02", author: "aoife", createdAt: ist("2026-07-14", "11:20"), body: "On it. You'll have two options with prices by Friday." },
      { id: "demo-dm-a-03", author: "aoife", createdAt: ist(TODAY, "08:30"), body: "Two options:\nElderflower spritz, €9.50 a glass\nGin and cucumber cooler, €10 a glass\nBoth batch well for 90 guests." },
      { id: "demo-dm-a-04", author: "aoife", createdAt: ist(TODAY, "08:31"), body: "I'd go with the spritz. It suits an afternoon ceremony." },
    ]),
    ...thread(DM_DARA, [
      { id: "demo-dm-d-01", author: "dara", createdAt: ist("2026-07-13", "14:30"), body: "Can you send me the tasting headcount when you have it? Six covers is the most I can do on a Saturday." },
      { id: "demo-dm-d-02", author: "orla", createdAt: ist("2026-07-13", "14:42"), body: "It's four: Mara, Finn and both mothers." },
      { id: "demo-dm-d-03", author: "dara", createdAt: ist("2026-07-13", "14:43"), body: "Grand, four it is." },
    ]),
    ...thread(TASK_RUN_SHEET, [
      { id: "demo-task-rs-01", author: "orla", createdAt: ist(YESTERDAY, "15:32"), body: "Ceremony 2pm in the orchard, drinks on the terrace, dinner at 5:30. I'll share this with the floor team once speeches are confirmed." },
      { id: "demo-task-rs-02", author: "niamh", createdAt: ist(TODAY, "08:48"), body: "@Orla speeches are before the main course. Timings are updated in the description, so it's ready to share." },
    ]),
    ...thread(TASK_SEATING, [
      { id: "demo-task-st-01", author: "niamh", createdAt: ist(TODAY, "08:40"), body: "Checked the sightlines to the arch: clear from every table except 9. Swapping 9 and 12 fixes it, then it's ready to approve." },
    ]),
  ];

  return {
    actorId: DEMO_USER_ID,
    project: { id: DEMO_WORKSPACE_ID, name: DEMO_WORKSPACE_NAME },
    clock: { nowMs: Date.parse(PINNED_REVIEW_CALENDAR_FRAME.nowIso), timeZone: PINNED_REVIEW_CALENDAR_FRAME.timeZone, locale: PINNED_REVIEW_CALENDAR_FRAME.locale },
    people: Object.values(PEOPLE),
    conversations,
    messages,
  };
}
