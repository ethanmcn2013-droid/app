/**
 * Browser check for Home: a busy account, a sparse one, an empty one, no
 * Projects, a failed read, review mode, loading and error.
 *
 *   node experience/home-overview/home.mjs            # checks only
 *   node experience/home-overview/home.mjs --capture  # checks, then screenshots
 *   node experience/home-overview/home.mjs --capture <dir>
 *
 * Bundles `home-fixture.tsx` with the real Home, its real styles and the v3
 * tokens, and stubs only the server seams listed below. It checks the count
 * line, every group, ticking a task and taking it back through the task
 * action, a refused write, Nudge, the Home and Overview tabs by keyboard, the
 * C shortcut, the greeting on the viewer's own clock, the banned word list,
 * sideways scroll and axe, at four sizes in dark and light.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { BANNED, VIEWPORTS, bundleFixture, captureArgs, createRunner, root, text } from "./harness.mjs";

const { capture, outDir } = captureArgs("experience/output/home-overview/home");

const stubs = new Map([
  ["next/navigation", `export const useRouter=()=>({push:u=>window.homeProbe.pushed.push(u),replace:u=>window.homeProbe.pushed.push(u),refresh:()=>{}});`],
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,...rest}){return createElement("a",{href,onClick:e=>e.preventDefault(),...rest})}`],
  ["@/components/shell/app-sidebar", `const H=[1,2,3,4,8,9];export const projectColor=id=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return "var(--v3-project-"+H[h%H.length]+")"};`],
  ["@/components/system/arrival-settle", `export const ArrivalSettle=()=>null;`],
  ["@/lib/analytics/client", `export const captureClientEvent=()=>{};`],
  [
    "@/server/actions/tasks",
    // The board's own toggle: an open task lands in Done, a done one in To do.
    `export const toggleCompleteAction=async id=>{const p=window.homeProbe;p.toggled.push(id);if(p.refuse)return [];const was=p.lanes[id]??(id==="t-invoice"?"done":"todo");const repeats=id==="t-rota";p.lanes[id]=repeats?"todo":was==="done"?"todo":"done";await new Promise(r=>setTimeout(r,30));return [{id,lane:p.lanes[id]}]};`,
  ],
  ["@/server/actions/nudge", `export const sendNudgeAction=async id=>{window.homeProbe.nudged.push(id);return {ok:true,nudgedCount:1,lastNudgedAt:null,nudged:[{id:"u-aoife",name:"Aoife Brennan"}],alreadyNudged:[]}};`],
]);

const { js, css } = await bundleFixture("experience/home-overview/home-fixture.tsx", stubs);
const run = createRunner({ js, css, origin: "http://127.0.0.1:49274", title: "Home", capture, outDir });

const section = (page, name) => page.getByRole("region", { name, exact: true });
const rowTitles = (page, name) => section(page, name).locator("li a").allInnerTexts();
const heading = (page, name) => section(page, name).locator("h2").innerText().then(text);

try {
  await run.launch();

  for (const viewport of Object.keys(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
      // 1. The busy account.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme });
        await page.getByRole("heading", { name: "Good morning, Orla", level: 1 }).waitFor();
        assert.equal(text(await page.locator("header p").first().innerText()), "7 things need you today · 10 late across your projects · 32 done this week");
        assert.match(text(await page.locator("header").innerText()), /Monday 5 October/);
        assert.match(text(await page.locator("header").innerText()), /Chase the florist deposit has been in Waiting with no change for 7 days\. Nudge Aoife Brennan · 2 more stuck/);

        assert.equal(await heading(page, "Late"), "Late 3");
        assert.deepEqual(await rowTitles(page, "Late"), ["Agree the winter price list", "Chase the headcount from Mark", "Approve the brochure copy"]);
        assert.equal(await heading(page, "Due today"), "Due today 2 · 1 done");
        assert.equal(await heading(page, "Due this week"), "Due this week 3");
        assert.equal(await heading(page, "Waiting to be checked"), "Waiting to be checked 2");
        assert.equal(await heading(page, "You are waiting on"), "You are waiting on 1");
        assert.match(text(await section(page, "Late").innerText()), /Keane Legal retreat · in Waiting 3 days late/);
        assert.match(text(await section(page, "Waiting to be checked").innerText()), /from Seán, no change in 5 days To check/);
        // Nothing to tick on work that is someone else's to finish.
        assert.equal(await section(page, "Waiting to be checked").getByRole("button").count(), 0);

        const side = page.getByRole("complementary", { name: "Coming up" });
        assert.match(text(await side.innerText()), /Next big day Menu tasting Mara & Finn’s wedding Today, Monday 5 October At risk 21 open 2 late See the timeline Open its tasks/);
        assert.equal(text(await section(page, "Projects").locator("h2").innerText()), "Projects See all 10");
        assert.deepEqual((await section(page, "Projects").locator("li").allInnerTexts()).map(text).slice(0, 3), [
          "Winter season launch Past its date · 4 late · 28 Sep",
          "Mara & Finn’s wedding At risk · 2 late · 5 Oct",
          "Barn roof and heating works At risk · 3 late · 10 Oct",
        ]);
        assert.match(text(await side.innerText()), /3 tasks are due today across your projects\. 10 late in all\./);
        // One create button per screen, and it is the top bar's: Home has none.
        assert.equal(await page.getByRole("link", { name: /^New task/ }).count() + (await page.getByRole("button", { name: /^New task/ }).count()), 0);
        run.checks += 16;

        // Plain words, lined-up figures, and one fixed thing only (the toast slot).
        assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned word`);
        assert.match(await section(page, "Late").locator("li span").last().evaluate((el) => getComputedStyle(el).fontVariantNumeric), /tabular-nums/);
        await run.noSidewaysScroll(page, label);
        await run.axe(page, label);
        await run.shot(page, `home-busy-${viewport}-${theme}`);
        if (theme === "dark" || viewport === "phone") await run.shot(page, `home-busy-${viewport}-${theme}-full`, { fullPage: true });
        run.checks += 2;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 2. Ticking, Undo, Nudge, tabs and keys.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme });
        const tick = page.getByRole("button", { name: "Mark Agree the winter price list done" });
        await tick.click();
        await page.getByText("Marked done").waitFor();
        assert.deepEqual(await page.evaluate(() => window.homeProbe.toggled), ["t-prices"]);
        assert.equal(await heading(page, "Late"), "Late 2 · 1 done");
        assert.match(text(await section(page, "Late").locator("li").first().innerText()), /Done$/);
        assert.equal(text(await page.locator("header p").first().innerText()).startsWith("6 things need you today"), true, "the count follows the tick");
        await run.axe(page, `${label} ticked`);
        await run.shot(page, `home-ticked-${viewport}-${theme}`);

        // Undo is the same action again, and the row comes back as it was.
        await page.getByRole("button", { name: "Undo" }).click();
        await page.getByRole("button", { name: "Mark Agree the winter price list done" }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.homeProbe.toggled), ["t-prices", "t-prices"]);
        assert.equal(await heading(page, "Late"), "Late 3");
        assert.equal(await page.getByText("Marked done").count(), 0);

        // A task ticked earlier today can be reopened from its row.
        await page.getByRole("button", { name: "Mark Send the final invoice to Mara and Finn not done" }).click();
        await page.getByText("Marked not done").waitFor();
        assert.equal(await heading(page, "Due today"), "Due today 3");

        // A repeating task comes round again, so there is nothing to undo.
        await page.getByRole("button", { name: "Mark Send the weekend rota done" }).click();
        await page.getByText("Marked done. It repeats, so it is back on your list with its next date.").waitFor();
        assert.equal(await page.getByRole("button", { name: "Undo" }).count(), 0);

        // Nudge goes through the real action and names who it reached.
        await page.getByRole("button", { name: "Nudge Aoife Brennan" }).click();
        await page.getByText("Nudged Aoife Brennan.").waitFor();
        assert.deepEqual(await page.evaluate(() => window.homeProbe.nudged), ["t-florist"]);
        assert.equal(await page.getByText("Nudged today").count(), 1);
        assert.equal(await page.getByRole("button", { name: /^Nudge/ }).count(), 0);

        // Home and Overview: a tablist, one tab stop, arrows open the other view.
        const tabs = page.getByRole("tablist", { name: "Home views" });
        assert.deepEqual(await tabs.getByRole("tab").allInnerTexts(), ["Home", "Overview"]);
        assert.equal(await tabs.getByRole("tab", { name: "Home" }).getAttribute("aria-selected"), "true");
        assert.equal(await tabs.getByRole("tab", { name: "Overview" }).getAttribute("tabindex"), "-1");
        assert.equal(await tabs.getByRole("tab", { name: "Overview" }).getAttribute("href"), "/app/home/briefing?contextVersion=2&workspaceId=p-mara");
        assert.equal(await page.getByRole("tabpanel").getAttribute("aria-labelledby"), await tabs.getByRole("tab", { name: "Home" }).getAttribute("id"));
        await tabs.getByRole("tab", { name: "Home" }).focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await tabs.getByRole("tab", { name: "Overview" }).evaluate((el) => el === document.activeElement), true);
        assert.deepEqual(await page.evaluate(() => window.homeProbe.pushed), ["/app/home/briefing?contextVersion=2&workspaceId=p-mara"]);

        // C starts a new task by the top bar's own route; where the add-task
        // dialog is mounted it answers C itself, so Home stays out of it.
        await page.locator("body").press("c");
        assert.equal(await page.evaluate(() => window.homeProbe.pushed.at(-1)), "/app/tasks?create=task&workspaceId=p-mara");
        await page.evaluate(() => document.documentElement.setAttribute("data-create-ready", ""));
        await page.locator("body").press("c");
        assert.equal(await page.evaluate(() => window.homeProbe.pushed.length), 2);
        run.checks += 22;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 3. A write the server refused changes nothing on screen.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, query: "&refuse=1" });
        await page.getByRole("button", { name: "Mark Agree the winter price list done" }).click();
        await page.getByText("That did not save. Open the task to change it there.").waitFor();
        assert.equal(await heading(page, "Late"), "Late 3");
        assert.equal(await page.getByRole("button", { name: "Undo" }).count(), 0);
        run.checks += 2;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 4. Review: nothing is saved or sent, and Nudge is not offered.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "review" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.equal(await page.getByRole("button", { name: /^Nudge/ }).count(), 0);
        await page.getByRole("button", { name: "Mark Agree the winter price list done" }).click();
        await page.getByText("This is a review copy, so nothing is saved.").waitFor();
        assert.deepEqual(await page.evaluate(() => window.homeProbe.toggled), []);
        run.checks += 3;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 5. The sparse account: one Project, nine tasks, none assigned.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "sparse" });
        await page.getByRole("heading", { name: "Good morning, Orla", level: 1 }).waitFor();
        assert.equal(text(await page.locator("header p").first().innerText()), "2 things need you today · 1 late in Test project · 1 done this week");
        assert.equal(await heading(page, "Late"), "Late 1");
        assert.match(text(await section(page, "Late").innerText()), /Pick a date for the first tasting no one assigned 3 days late/);
        assert.equal(await page.getByRole("region", { name: "Waiting to be checked" }).count(), 0, "an empty optional group is not drawn");
        assert.equal(await page.getByRole("region", { name: "You are waiting on" }).count(), 0, "an empty optional group is not drawn");
        assert.equal(await page.getByRole("link", { name: "5 of your open tasks have no date yet" }).getAttribute("href"), "/app/tasks?workspaceId=p-test");
        assert.match(text(await page.getByRole("complementary").innerText()), /Next big day No big day is set\./);
        assert.equal(text(await section(page, "Projects").locator("h2").innerText()), "Projects Open Projects");
        assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned word`);
        await run.noSidewaysScroll(page, label);
        await run.axe(page, label);
        await run.shot(page, `home-sparse-${viewport}-${theme}`, { fullPage: viewport === "phone" });
        run.checks += 9;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 6. A Project with no tasks, no Projects at all, and counts that could not be read.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "empty" });
        await page.getByText("Nothing needs you today").waitFor();
        assert.equal(text(await section(page, "Late").innerText()), "Late 0 Nothing of yours is late.");
        assert.equal(text(await section(page, "Due today").innerText()), "Due today 0 Nothing of yours is due today.");
        await run.axe(page, label);
        await run.shot(page, `home-empty-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "none" });
        await page.getByRole("heading", { name: "No projects yet" }).waitFor();
        assert.equal(await page.getByRole("link", { name: "New project" }).getAttribute("href"), "/app/project");
        assert.equal(await page.locator("header p").count(), 0, "no count line without projects");
        await run.axe(page, label);
        await run.shot(page, `home-no-projects-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "partial" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.equal(text(await page.locator("header p").first().innerText()), "8 things need you today", "figures that were not read are not shown");
        await run.axe(page, label);
        await run.shot(page, `home-partial-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 7. Loading and error.
      {
        const { page, context, label } = await run.open({ viewport, theme, state: "loading" });
        await page.getByRole("status", { name: "Opening Home" }).waitFor();
        await run.noSidewaysScroll(page, label);
        await run.shot(page, `home-loading-${viewport}-${theme}`);
        await context.close();
      }
      {
        const { page, context, label } = await run.open({ viewport, theme, state: "error" });
        await page.getByRole("heading", { name: "Home did not load", level: 1 }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Try again" }).count(), 1);
        await run.axe(page, label);
        await run.shot(page, `home-error-${viewport}-${theme}`);
        await context.close();
      }
      run.checks += 8;
    }
  }

  // 8. The greeting follows the viewer's own clock, not the server's.
  for (const [timezoneId, hello] of [["Pacific/Auckland", "Good evening"], ["America/Los_Angeles", "Still up"], ["Europe/Dublin", "Good morning"]]) {
    const { page, context } = await run.open({ viewport: "desk", theme: "dark", query: "&hour=local", timezoneId });
    await page.clock.setFixedTime(new Date("2026-10-05T09:30:00+01:00"));
    await page.reload();
    await page.getByRole("heading", { name: `${hello}, Orla`, level: 1 }).waitFor();
    run.checks += 1;
    await context.close();
  }

  // 9. With motion allowed, the page still settles and nothing is left mid-animation.
  {
    const { page, context, errors } = await run.open({ viewport: "desk", theme: "dark", reducedMotion: "no-preference" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("[data-home-board] [class*='grid']").first().evaluate((el) => getComputedStyle(el).opacity), "1");
    assert.deepEqual(errors, []);
    run.checks += 1;
    await context.close();
  }

  console.log(
    `PASS home: ${run.checks} checks across wide, desk, tablet and phone, dark and light${capture ? `; ${run.shots.length} screenshots in ${path.relative(root, outDir).replace(/\\/g, "/")}` : ""}`,
  );
} finally {
  await run.close();
}
