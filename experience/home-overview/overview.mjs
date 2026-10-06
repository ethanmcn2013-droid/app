/**
 * Browser check for the Overview's week view: a busy Project, a sparse one,
 * an empty one, a read across two Projects, review mode and a refused write.
 *
 *   node experience/home-overview/overview.mjs            # checks only
 *   node experience/home-overview/overview.mjs --capture  # checks, then screenshots
 *   node experience/home-overview/overview.mjs --capture <dir>
 *
 * Bundles `overview-fixture.tsx` with the real week view, its real styles,
 * the Home tabs and the v3 tokens, and stubs only the two task actions. It
 * checks the summary, the lanes under each grouping, every dated task on the
 * river, picking a task and marking it done with Undo, giving an undated task
 * its day by date field and by clicking the river with Undo, the late list,
 * week stepping, zoom, the Project picker, keys, the phone layout, the banned
 * word list, sideways scroll and axe, at four sizes in dark and light.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { BANNED, VIEWPORTS, bundleFixture, captureArgs, createRunner, root, text } from "./harness.mjs";

const { capture, outDir } = captureArgs("experience/output/home-overview/overview");

const stubs = new Map([
  ["next/navigation", `export const useRouter=()=>({push:u=>window.overviewProbe.pushed.push(u),replace:u=>window.overviewProbe.pushed.push(u),refresh:()=>{}});`],
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,...rest}){return createElement("a",{href,...rest,onClick:e=>{e.preventDefault();rest.onClick&&rest.onClick(e)}})}`],
  [
    "@/server/actions/tasks",
    `const p=()=>window.overviewProbe;
export const toggleCompleteAction=async id=>{p().toggled.push(id);if(p().refuse)return [];const was=p().lanes[id]??"todo";p().lanes[id]=was==="done"?"todo":"done";await new Promise(r=>setTimeout(r,30));return [{id,lane:p().lanes[id]}]};
export const updateTaskAction=async(id,patch)=>{p().dated.push({id,due:patch.due,dueAt:patch.dueAt?patch.dueAt.toISOString():null});if(p().refuse)return [];await new Promise(r=>setTimeout(r,30));return [{id,lane:"todo",dueAt:patch.dueAt??undefined}]};`,
  ],
]);

const { js, css } = await bundleFixture("experience/home-overview/overview-fixture.tsx", stubs);
const run = createRunner({ js, css, origin: "http://127.0.0.1:49275", title: "Overview", capture, outDir });

const laneNames = (page) => page.locator("[data-overview-river] [role=group][aria-label*='open']").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
const marks = (page) => page.locator("button[data-mark]");
const summaryOf = async (page) => text(await page.locator("[data-overview-river] p").first().innerText());
const probe = (page) => page.evaluate(() => window.overviewProbe);
const tray = (page) => page.locator("[data-overview-river] section").last();

try {
  await run.launch();

  for (const viewport of Object.keys(VIEWPORTS)) {
    const phone = viewport === "phone";
    for (const theme of ["dark", "light"]) {
      // 1. The busy Project.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme });
        await page.getByRole("heading", { name: "Overview", level: 1 }).waitFor();
        await page.locator(`[data-overview-river="${phone ? "phone" : "desk"}"]`).waitFor();
        assert.equal(await summaryOf(page), "At risk 8 days to the target date, Tue 13 Oct. 19 open, 2 late.");
        assert.deepEqual(await page.getByRole("radiogroup", { name: "Group the work by" }).getByRole("radio").allInnerTexts(), ["Areas", "People", "Status"]);
        assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned word`);

        // Home and Overview are tabs of one place.
        const tabs = page.getByRole("tablist", { name: "Home views" });
        assert.equal(await tabs.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected"), "true");
        assert.equal(await tabs.getByRole("tab", { name: "Home" }).getAttribute("href"), "/app/home");
        // One create button per screen, and it is the top bar's.
        assert.equal(await page.getByRole("button", { name: /^New task/ }).count() + (await page.getByRole("link", { name: /^New task/ }).count()), 0);
        run.checks += 6;

        if (phone) {
          assert.equal(text(await page.getByRole("region", { name: "Late" }).innerText()).startsWith("Late 2 Oct Reprint the faded welcome sign Venue and hire 3 days late"), true);
          assert.equal(await page.getByRole("region", { name: "Late" }).locator("li").count(), 2);
          assert.equal(await page.getByRole("region", { name: "No date yet" }).locator("li").count(), 2);
          assert.equal(text(await page.getByRole("region", { name: "This week" }).locator("h2").innerText()), "This week 11 due");
          assert.equal(text(await page.getByRole("region", { name: "Week of 12 October" }).locator("h2").innerText()), "Week of 12 October 4 due");
          assert.match(text(await page.getByRole("region", { name: "Week of 12 October" }).innerText()), /Mara & Finn’s wedding Tue 13 Oct, in 8 days/);
          await run.noSidewaysScroll(page, label);
          await run.axe(page, label);
          await run.shot(page, `overview-busy-${viewport}-${theme}`, { fullPage: true });

          // A row opens to its actions; an undated one can be given its day there.
          await page.getByRole("button", { name: /Book the extra cloakroom attendant/ }).click();
          assert.equal(await page.getByRole("link", { name: "Open the task" }).getAttribute("href"), "/app/tasks?task=r-cloak&workspaceId=p-mara");
          await page.getByLabel("Due date").fill("2026-10-09");
          await page.getByRole("button", { name: "Set date" }).click();
          await page.getByText("“Book the extra cloakroom attendant” is due Fri 9 Oct.").waitFor();
          assert.deepEqual((await probe(page)).dated, [{ id: "r-cloak", due: "Fri", dueAt: "2026-10-09T09:00:00.000Z" }]);
          assert.equal(text(await page.getByRole("region", { name: "This week" }).locator("h2").innerText()), "This week 12 due");
          await page.getByRole("button", { name: "Undo" }).click();
          await page.getByRole("region", { name: "No date yet" }).getByText("Book the extra cloakroom attendant").waitFor();
          assert.equal((await probe(page)).dated.at(-1).dueAt, null);

          await page.getByRole("button", { name: /Reprint the faded welcome sign/ }).click();
          await page.getByRole("button", { name: "Mark done" }).click();
          await page.getByText("“Reprint the faded welcome sign” is done.").waitFor();
          assert.equal(await page.getByRole("region", { name: "Late" }).locator("li").count(), 1);
          assert.equal(await summaryOf(page), "At risk 8 days to the target date, Tue 13 Oct. 18 open, 1 late.");
          await run.axe(page, `${label} changed`);
          await page.getByRole("button", { name: "Undo" }).click();
          await page.getByRole("region", { name: "Late" }).getByText("Reprint the faded welcome sign").waitFor();
          assert.deepEqual((await probe(page)).toggled, ["r-sign", "r-sign"]);
          run.checks += 14;
          assert.deepEqual(errors, [], label);
          await context.close();
          continue;
        }

        // Lanes, counted from the same tasks as the summary.
        assert.deepEqual(await laneNames(page), ["Food and drink: 7 open, 1 late", "Guests and seating: 5 open", "Venue and hire: 6 open, 1 late", "No area yet: 1 open"]);
        assert.equal(await marks(page).count(), 17, `${label}: every dated open task is on the river`);
        assert.equal(await page.getByRole("button", { name: "Order tonic and the good olives, 2 days late, Dev Patel" }).count(), 1);
        assert.equal(await page.getByRole("button", { name: "Menu tasting, big date, due Mon 5 Oct, Aoife Brennan" }).count(), 1);
        assert.match(text(await page.locator("[data-overview-river]").innerText()), /How full each week is 3 finished in the last 7 days/);
        assert.match(text(await page.locator("[data-overview-river]").innerText()), /Next: Menu tasting, 5 Oct/);
        assert.match(text(await page.locator("[data-overview-river]").innerText()), /Mara & Finn’s wedding Tue 13 Oct, in 8 days/);
        assert.match(text(await page.locator("[data-overview-river]").innerText()), /Today 5 Oct/);
        assert.equal(text(await tray(page).locator("h2").innerText()), "This week");
        assert.match(text(await tray(page).innerText()), /5 Oct to 11 Oct This week 11 tasks due, 7 on Aoife\./);
        await run.noSidewaysScroll(page, label);
        await run.axe(page, label);
        await run.shot(page, `overview-busy-${viewport}-${theme}`);
        if (theme === "dark") await run.shot(page, `overview-busy-${viewport}-${theme}-full`, { fullPage: true });
        run.checks += 10;

        // Grouping: 2 is People, 3 is Status.
        await page.locator("body").press("2");
        assert.equal((await laneNames(page)).some((name) => name.startsWith("Aoife Brennan: 8 open")), true);
        await run.shot(page, `overview-people-${viewport}-${theme}`);
        await page.locator("body").press("3");
        assert.deepEqual((await laneNames(page)).map((name) => name.split(":")[0]), ["To do", "In progress", "Review", "Waiting"]);
        await page.getByRole("radio", { name: "Areas" }).click();
        assert.equal(await page.getByRole("radio", { name: "Areas" }).getAttribute("aria-checked"), "true");

        // Along a lane by arrow keys; one tab stop a lane.
        const firstMark = page.getByRole("button", { name: /^Order tonic and the good olives/ });
        await firstMark.focus();
        assert.equal(await firstMark.getAttribute("tabindex"), "0");
        await page.keyboard.press("ArrowRight");
        assert.match(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), /due Mon 5 Oct/);
        await page.keyboard.press("ArrowDown");
        assert.match(await page.evaluate(() => document.activeElement.closest("[role=group]").getAttribute("aria-label")), /^Guests and seating/);

        // Pick a task: it opens below, and can be marked done and taken back.
        await page.getByRole("button", { name: /^Reprint the faded welcome sign/ }).click();
        const detail = page.locator("[data-river-detail]");
        assert.match(text(await detail.innerText()), /Venue and hire 3 days late Reprint the faded welcome sign DH Dara Hayes Fri 2 Oct, 3 days ago/);
        assert.equal(await detail.getByRole("link", { name: "Open the task" }).getAttribute("href"), "/app/tasks?task=r-sign&workspaceId=p-mara");
        await run.axe(page, `${label} picked`);
        await run.shot(page, `overview-picked-${viewport}-${theme}`, { fullPage: true });
        await detail.getByRole("button", { name: "Mark done" }).click();
        await page.getByText("“Reprint the faded welcome sign” is done.").waitFor();
        assert.equal(await marks(page).count(), 16);
        assert.equal(await summaryOf(page), "At risk 8 days to the target date, Tue 13 Oct. 18 open, 1 late.");
        await page.getByRole("button", { name: "Undo" }).click();
        await page.getByRole("button", { name: /^Reprint the faded welcome sign/ }).waitFor();
        assert.deepEqual((await probe(page)).toggled, ["r-sign", "r-sign"]);
        assert.equal(await marks(page).count(), 17);

        // No date yet: pick one, then give it a day with the date field.
        assert.equal(text(await page.getByRole("button", { name: /^No date yet/ }).innerText()), "No date yet 2");
        const chip = page.getByRole("list", { name: "Tasks with no date yet" }).getByRole("button", { name: /Book the extra cloakroom attendant/ });
        await page.getByText("Pick one, then click the day it is due.").waitFor();
        await chip.click();
        assert.equal(await chip.getAttribute("aria-pressed"), "true");
        await page.getByLabel("Due date").fill("2026-10-09");
        await page.getByRole("button", { name: "Set date" }).click();
        await page.getByText("“Book the extra cloakroom attendant” is due Fri 9 Oct.").waitFor();
        assert.deepEqual((await probe(page)).dated, [{ id: "r-cloak", due: "Fri", dueAt: "2026-10-09T09:00:00.000Z" }]);
        assert.equal(await marks(page).count(), 18);
        assert.equal(text(await page.getByRole("button", { name: /^No date yet/ }).innerText()), "No date yet 1");
        await page.getByRole("button", { name: "Undo" }).click();
        await page.getByRole("list", { name: "Tasks with no date yet" }).getByRole("button", { name: /Book the extra cloakroom attendant/ }).waitFor();
        assert.equal((await probe(page)).dated.at(-1).dueAt, null);
        assert.equal(await marks(page).count(), 17);

        // Or click the day on the river: three days on from today's line.
        await page.getByRole("list", { name: "Tasks with no date yet" }).getByRole("button", { name: /Agree the first dance with the band/ }).click();
        await page.locator("[data-overview-river] [role=group][aria-label^='No area yet']").scrollIntoViewIfNeeded();
        const now = await page.getByText("Today 5 Oct").boundingBox();
        const emptyLane = await page.locator("[data-overview-river] [role=group][aria-label^='No area yet']").boundingBox();
        await page.mouse.move(now.x + now.width / 2 + 3 * 36, emptyLane.y + emptyLane.height / 2);
        await page.getByText("Due Thu 8 Oct").waitFor();
        await run.shot(page, `overview-placing-${viewport}-${theme}`);
        await page.mouse.click(now.x + now.width / 2 + 3 * 36, emptyLane.y + emptyLane.height / 2);
        await page.getByText("“Agree the first dance with the band” is due Thu 8 Oct.").waitFor();
        assert.deepEqual((await probe(page)).dated.at(-1), { id: "r-playlist", due: "Thu", dueAt: "2026-10-08T09:00:00.000Z" });
        assert.equal(await page.getByRole("button", { name: /^No date yet/ }).count() === 0 || text(await page.getByRole("button", { name: /^No date yet/ }).innerText()) === "No date yet 1", true);
        await page.getByRole("button", { name: "Undo" }).click();
        await page.getByRole("list", { name: "Tasks with no date yet" }).getByRole("button", { name: /Agree the first dance with the band/ }).waitFor();
        run.checks += 24;

        // The late list, then the weeks.
        await page.getByRole("button", { name: "2 late" }).click();
        assert.match(text(await tray(page).innerText()), /Across this project Late 2 tasks past their date\./);
        assert.equal(await tray(page).locator("button", { hasText: "days late" }).count(), 2);
        await run.shot(page, `overview-late-${viewport}-${theme}`, { fullPage: true });
        await page.getByRole("button", { name: "Back to the week" }).click();
        await page.getByRole("button", { name: "Later week" }).click();
        assert.match(text(await tray(page).innerText()), /12 Oct to 18 Oct Week of 12 October 4 tasks due/);
        await page.getByRole("button", { name: "This week", exact: true }).click();
        assert.equal(text(await tray(page).locator("h2").innerText()), "This week");

        // Zoom, and back to today.
        const zoom = page.getByRole("group", { name: "Zoom" });
        assert.equal(text(await zoom.innerText()), "Weeks");
        await zoom.getByRole("button", { name: "Zoom in" }).click();
        assert.equal(text(await zoom.innerText()), "Days");
        assert.equal(await zoom.getByRole("button", { name: "Zoom in" }).isDisabled(), true);
        await page.locator("body").press("-");
        await page.locator("body").press("-");
        assert.equal(text(await zoom.innerText()), "Months");
        await run.shot(page, `overview-months-${viewport}-${theme}`);
        await page.getByRole("button", { name: "Today", exact: true }).click();
        assert.equal(await page.getByText("Today 5 Oct").isVisible(), true);

        // The Project picker: a menu of the reader's own Projects.
        const picker = page.getByRole("button", { name: /^Project: Mara & Finn’s wedding/ });
        await picker.click();
        const menu = page.getByRole("menu", { name: "Projects" });
        assert.deepEqual(await menu.getByRole("menuitemradio").allInnerTexts().then((list) => list.map(text)), ["Mara & Finn’s wedding", "Winter season launch", "Barn roof and heating works"]);
        assert.equal(await menu.getByRole("menuitemradio", { name: "Mara & Finn’s wedding" }).getAttribute("aria-checked"), "true");
        assert.equal(await menu.getByRole("menuitemradio", { name: "Winter season launch" }).getAttribute("href"), "/app/home/briefing?contextVersion=2&workspaceId=p-winter");
        await run.axe(page, `${label} picker`);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Escape");
        assert.equal(await menu.count(), 0);
        assert.equal(await picker.evaluate((el) => el === document.activeElement), true);

        // Left from the Overview tab opens Home.
        await tabs.getByRole("tab", { name: "Overview" }).focus();
        await page.keyboard.press("ArrowLeft");
        assert.deepEqual((await probe(page)).pushed, ["/app/home"]);
        run.checks += 16;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 2. Review mode and a refused write: nothing changes on screen.
      for (const [state, query, words] of [
        ["review", "", "This is a review copy, so nothing is saved."],
        ["busy", "&refuse=1", "That did not save. Open the task to change it there."],
      ]) {
        const { page, context, errors, label } = await run.open({ viewport, theme, state, query });
        await page.locator(`[data-overview-river="${phone ? "phone" : "desk"}"]`).waitFor();
        await page.getByRole("button", { name: /Reprint the faded welcome sign/ }).first().click();
        await page.getByRole("button", { name: "Mark done" }).click();
        await page.getByText(words).waitFor();
        assert.equal(await page.getByRole("button", { name: "Undo" }).count(), 0);
        assert.equal(await summaryOf(page), "At risk 8 days to the target date, Tue 13 Oct. 19 open, 2 late.");
        if (state === "review") assert.deepEqual((await probe(page)).toggled, []);
        run.checks += 3;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 3. The sparse Project: no labels, so its lanes are the board's columns.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "sparse" });
        await page.locator(`[data-overview-river="${phone ? "phone" : "desk"}"]`).waitFor();
        assert.equal(await summaryOf(page), "No status yet No target date set. 8 open, 1 late.");
        assert.deepEqual(await page.getByRole("radiogroup", { name: "Group the work by" }).getByRole("radio").allInnerTexts(), ["Status", "People"]);
        if (phone) {
          assert.equal(await page.getByRole("region", { name: "No date yet" }).locator("li").count(), 5);
          assert.equal(text(await page.getByRole("region", { name: "This week" }).locator("h2").innerText()), "This week 2 due");
        } else {
          assert.deepEqual(await laneNames(page), ["To do: 7 open, 1 late", "In progress: 1 open"]);
          assert.equal(await marks(page).count(), 3);
          assert.equal(text(await page.getByRole("button", { name: /^No date yet/ }).innerText()), "No date yet 5");
          assert.match(text(await tray(page).innerText()), /This week 2 tasks due\./);
        }
        assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned word`);
        await run.noSidewaysScroll(page, label);
        await run.axe(page, label);
        await run.shot(page, `overview-sparse-${viewport}-${theme}`, { fullPage: true });
        run.checks += 6;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 4. No tasks at all, and a read across two Projects.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "empty" });
        await page.locator(`[data-overview-river="${phone ? "phone" : "desk"}"]`).waitFor();
        assert.equal(await summaryOf(page), "No status yet No target date set. 0 open.");
        assert.match(text(await page.locator("[data-overview-river]").innerText()), phone ? /No tasks yet\. Add one from New, at the top\./ : /No tasks yet/);
        await run.noSidewaysScroll(page, label);
        await run.axe(page, label);
        await run.shot(page, `overview-empty-${viewport}-${theme}`, { fullPage: true });
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "several" });
        await page.locator(`[data-overview-river="${phone ? "phone" : "desk"}"]`).waitFor();
        assert.equal(await summaryOf(page), "2 projects. 21 open, 3 late.");
        if (!phone) assert.deepEqual(await laneNames(page), ["Mara & Finn’s wedding: 19 open, 2 late", "Winter season launch: 2 open, 1 late"]);
        await run.axe(page, label);
        await run.shot(page, `overview-several-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      run.checks += 8;
    }
  }

  console.log(
    `PASS overview: ${run.checks} checks across wide, desk, tablet and phone, dark and light${capture ? `; ${run.shots.length} screenshots in ${path.relative(root, outDir).replace(/\\/g, "/")}` : ""}`,
  );
} finally {
  await run.close();
}
