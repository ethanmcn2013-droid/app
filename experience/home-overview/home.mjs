/**
 * Browser check for Home: a busy account, one behind plan, a Monday morning,
 * no Projects, no target dates, an unread history, Chat switched off, a page
 * that could not read its Projects, loading and error.
 *
 *   node experience/home-overview/home.mjs            # checks only
 *   node experience/home-overview/home.mjs --capture  # checks, then screenshots
 *   node experience/home-overview/home.mjs --capture <dir>
 *
 * Bundles `home-fixture.tsx` with the real Home, its real styles and the v3
 * tokens, and stubs only the server seams listed below. It checks the
 * greeting, the launch pager by keyboard, the week and activity figures, the
 * activity views, every start card's links, the banned word list, sideways
 * scroll and axe, at four sizes in dark and light.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { BANNED, VIEWPORTS, bundleFixture, captureArgs, createRunner, root, text } from "./harness.mjs";

const { capture, outDir } = captureArgs("experience/output/home-overview/home");
const dump = process.argv.includes("--dump");

const stubs = new Map([
  ["next/navigation", `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`],
  ["next/link", `import {createElement} from "react";export default function Link({href,prefetch,scroll,...rest}){return createElement("a",{href,onClick:e=>e.preventDefault(),...rest})}`],
  ["@/components/system/arrival-settle", `export const ArrivalSettle=()=>null;`],
  ["@/lib/analytics/client", `export const captureClientEvent=e=>{(window.homeEvents??=[]).push(e)};`],
]);

const { js, css } = await bundleFixture("experience/home-overview/home-fixture.tsx", stubs);
const run = createRunner({ js, css, origin: "http://127.0.0.1:49274", title: "Home", capture, outDir });

const region = (page, name) => page.getByRole("region", { name, exact: true });
const hrefOf = (page, name) => page.getByRole("link", { name, exact: true }).getAttribute("href");

if (dump) {
  await run.launch();
  for (const state of ["busy", "behind", "monday", "none", "notarget", "unread", "chatoff", "unavailable", "loading", "error"]) {
    const { page, context, errors } = await run.open({ viewport: "desk", theme: "dark", state });
    await page.waitForTimeout(300);
    console.log(`\n== ${state}\n${text(await page.locator("#root").innerText())}\nerrors: ${JSON.stringify(errors)}`);
    await context.close();
  }
  await run.close();
  process.exit(0);
}


/** Every page: plain words, nothing sideways, axe, and a screenshot. */
async function common(page, label, shot, { fullPage = false } = {}) {
  assert.doesNotMatch(await page.locator("#root").innerText(), BANNED, `${label}: banned word`);
  await run.noSidewaysScroll(page, label);
  await run.axe(page, label);
  await run.shot(page, shot, { fullPage });
  run.checks += 1;
}

try {
  await run.launch();

  for (const viewport of Object.keys(VIEWPORTS)) {
    for (const theme of ["dark", "light"]) {
      // 1. The busy account: three launches, the soonest one behind plan.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme });
        await page.getByRole("heading", { name: "Good morning, Orla", level: 1 }).waitFor();
        assert.match(text(await page.locator("header").first().innerText()), /Tuesday 20 October/);
        const launch = region(page, "Autumn menu launch");
        assert.match(text(await launch.innerText()), /Next big day 1 of 3 Autumn menu launch 17 17 days to go Friday 6 November 2 tasks behind plan/i);
        assert.equal(await hrefOf(page, "Catch up: 3 due this week"), "/app/tasks?workspaceId=p-menu");
        assert.equal(await hrefOf(page, "Open timeline"), "/app/timeline?workspaceId=p-menu&open=project");
        assert.match(text(await launch.innerText()), /Next stage: Tasting · Thu 22 Oct/);

        const week = region(page, "Done this week");
        assert.match(text(await week.innerText()), /Ahead of last week 9 done so far That's already more than all of last week \(6\)\. Same time last week: 4\./);
        const activity = region(page, "Activity");
        assert.match(text(await activity.innerText()), /weeks in a row \d+ tasks done in the last year/);
        assert.equal(await activity.getByRole("button", { name: "Year" }).getAttribute("aria-pressed"), "true");

        const start = page.getByRole("region", { name: "Start something" });
        assert.equal(await start.getByRole("link", { name: "View 30 open tasks" }).getAttribute("href"), "/app/tasks");
        assert.equal(await start.getByRole("link", { name: "View 5 active projects" }).getAttribute("href"), "/app/project");
        assert.equal(await start.getByRole("link", { name: "View files, 24 added in the last 30 days" }).getAttribute("href"), "/app/files");
        assert.equal(await start.getByRole("link", { name: "View 4 new mentions and replies" }).getAttribute("href"), "/app/messages");
        assert.equal(await start.getByRole("link", { name: "New task" }).getAttribute("href"), "/app/tasks?create=task");
        assert.equal(await start.getByRole("link", { name: "New project" }).getAttribute("href"), "/app/project?create=project");
        assert.equal(await start.getByRole("link", { name: "Upload file" }).getAttribute("href"), "/app/files");
        assert.equal(await start.getByRole("link", { name: "Start chat" }).getAttribute("href"), "/app/messages");
        assert.deepEqual(await page.evaluate(() => window.homeEvents), ["home_viewed"], "one view event");
        run.checks += 18;
        await common(page, label, `home-busy-${viewport}-${theme}`);
        if (theme === "dark" || viewport === "phone") await run.shot(page, `home-busy-${viewport}-${theme}-full`, { fullPage: true });
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 2. The pager by keyboard keeps focus on the button; the activity views switch; arrows read the week.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme });
        const next = page.getByRole("button", { name: "Next launch" });
        await next.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "Ping Private Release", level: 2 }).waitFor();
        assert.equal(await next.evaluate((el) => el === document.activeElement), true, "focus stays on Next launch");
        assert.match(text(await region(page, "Ping Private Release").innerText()), /Coming up 2 of 3 .*31 days to go .*On track/i);
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "Website refresh", level: 2 }).waitFor();
        await page.getByRole("button", { name: "Previous launch" }).click();
        await page.getByRole("heading", { name: "Ping Private Release", level: 2 }).waitFor();
        run.checks += 4;

        const activity = region(page, "Activity");
        for (const view of ["By week", "By hour", "Year", "By hour"]) {
          await activity.getByRole("button", { name: view }).click();
          assert.equal(await activity.getByRole("button", { name: view }).getAttribute("aria-pressed"), "true", `${label}: ${view}`);
          run.checks += 1;
        }
        await common(page, `${label} by hour`, `home-hour-${viewport}-${theme}`);

        const days = region(page, "Done this week").getByRole("group");
        await days.focus();
        await page.keyboard.press("ArrowLeft");
        await page.waitForFunction(() => [...document.querySelectorAll("[aria-live]")].some((el) => /Monday: 5 tasks this week · 2 tasks last week/.test(el.textContent)));
        run.checks += 1;
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 3. Behind plan, a Monday morning, no Projects, no target dates.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "behind" });
        await page.getByRole("heading", { name: "Ping Private Release", level: 2 }).waitFor();
        assert.match(text(await region(page, "Ping Private Release").innerText()), /1 of 2 .*4 tasks behind plan .*Catch up: 2 due this week/i);
        run.checks += 1;
        await common(page, label, `home-behind-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "monday" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.match(text(await region(page, "Done this week").innerText()), /New week 0 done so far New week\. Last week you finished 6, and 8 tasks are due this week\./);
        run.checks += 1;
        await common(page, label, `home-monday-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "none" });
        await page.getByRole("heading", { name: "Welcome to Signal Studio", level: 1 }).waitFor();
        assert.equal(await hrefOf(page, "Set up your first project"), "/welcome");
        assert.match(text(await region(page, "Activity").innerText()), /Your year starts here/);
        assert.equal(await page.getByRole("link", { name: "View 0 open tasks" }).count(), 1);
        run.checks += 3;
        await common(page, label, `home-none-${viewport}-${theme}`, { fullPage: viewport === "phone" });
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "notarget" });
        await page.getByRole("heading", { name: "No target dates yet", level: 2 }).waitFor();
        assert.equal(await hrefOf(page, "Set a target date"), "/app/project");
        run.checks += 1;
        await common(page, label, `home-notarget-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 4. Figures that were not read are not guessed; with Chat off, Notes takes its place.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "unread" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.match(text(await region(page, "Done this week").innerText()), /– done so far This week's finished work could not be read just now\./);
        assert.match(text(await region(page, "Activity").innerText()), /Could not be read just now/);
        assert.equal(await page.getByRole("link", { name: "Open Files. The count could not be read just now" }).getAttribute("href"), "/app/files");
        run.checks += 3;
        await common(page, label, `home-unread-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "chatoff" });
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.equal(await page.getByRole("link", { name: "Start chat" }).count(), 0);
        assert.equal(await hrefOf(page, "New note"), "/app/notes");
        run.checks += 2;
        await common(page, label, `home-chatoff-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }

      // 5. Projects could not be read, loading and error.
      {
        const { page, context, errors, label } = await run.open({ viewport, theme, state: "unavailable" });
        await page.getByRole("heading", { name: "Home could not read your work just now", level: 1 }).waitFor();
        assert.equal(await hrefOf(page, "Open Tasks"), "/app/tasks");
        run.checks += 1;
        await common(page, label, `home-unavailable-${viewport}-${theme}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
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
      run.checks += 3;
    }
  }

  // 6. With motion allowed, the page settles and nothing but the today pulse is left running.
  {
    const { page, context, errors } = await run.open({ viewport: "desk", theme: "dark", reducedMotion: "no-preference" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(3000);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName ?? "waapi"));
    assert.deepEqual(running, [], "animations still running after arrival");
    assert.equal(await page.locator("section").first().evaluate((el) => getComputedStyle(el).opacity), "1");
    assert.deepEqual(errors, []);
    run.checks += 2;
    await context.close();
  }

  console.log(
    `PASS home: ${run.checks} checks across wide, desk, tablet and phone, dark and light${capture ? `; ${run.shots.length} screenshots in ${path.relative(root, outDir).replace(/\\/g, "/")}` : ""}`,
  );
} finally {
  await run.close();
}
