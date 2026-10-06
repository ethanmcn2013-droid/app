"use client";

/**
 * Analytics reads the live store. `worldOf(state)` builds every lens's model
 * (Replay's histories, the wall's weekly counts and forecasts, Ask's answers)
 * from one store state, once: the result is kept per state object, so a
 * render, a hover or a lens switch never rebuilds it, and any edit made on the
 * board, the list or Projects (which makes a new state) shows on the next
 * render, dated today.
 */

import { useDemoStore } from "../../demo/store/client";
import { INITIAL_STATE, type DemoState } from "../../demo/store";
import { askWorld, type AskWorld } from "./ask-data";
import { toReplay, type Replay } from "./replay-model";
import { derive, wallProject, type Derived, type Project as WallProject } from "./wall-model";
import { rawProjects } from "./world";

export type World = {
  state: DemoState;
  /** Every project's history: active in the store's order, then finished. */
  replays: Replay[];
  replayById: (id: string) => Replay | undefined;
  /** Active projects, counted by week for the wall. */
  wall: WallProject[];
  /** Finished projects, counted the same way. */
  finished: WallProject[];
  wallById: (id: string) => WallProject | undefined;
  /** The wall's projects over the default 12 weeks: what the header and picker quote. */
  derived: Derived[];
  ask: AskWorld;
};

const cache = new WeakMap<DemoState, World>();

export function worldOf(state: DemoState): World {
  const hit = cache.get(state);
  if (hit) return hit;
  const replays = rawProjects(state).map(toReplay);
  const counted = replays.map((r) => wallProject(r, state));
  const wall = counted.filter((p) => p.doneOn === null);
  const finished = counted.filter((p) => p.doneOn !== null);
  const wallMap = new Map(counted.map((p) => [p.id, p]));
  const replayMap = new Map(replays.map((r) => [r.id, r]));
  const world: World = {
    state,
    replays,
    replayById: (id) => replayMap.get(id),
    wall,
    finished,
    wallById: (id) => wallMap.get(id),
    derived: wall.map((p) => derive(p, 12)),
    ask: askWorld(replays, (id) => wallMap.get(id)),
  };
  cache.set(state, world);
  return world;
}

/** The world for the live store; the server and first paint use the starting state. */
export function useWorld(): World {
  return useDemoStore(worldOf);
}

/** For code outside React (tests, a first render): the starting world. */
export const startingWorld = () => worldOf(INITIAL_STATE);
