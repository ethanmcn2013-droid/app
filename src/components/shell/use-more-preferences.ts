"use client";

import { useSyncExternalStore } from "react";
import { MORE_CUSTOMIZATION_ITEMS } from "./shell-nav";
import { cleanMorePreferences } from "./more-preferences-model";

const KEY = "signal:v3:more-customization";
const EVENT = "signal:more-customization";
const defaults = MORE_CUSTOMIZATION_ITEMS.filter(item => item.defaultVisible === false).map(item => item.id);
const ids = MORE_CUSTOMIZATION_ITEMS.map(item => item.id);
let lastRaw: string | null | undefined;
let cached: readonly string[] = defaults;
let memory: readonly string[] | null = null;

function snapshot(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== lastRaw) {
      lastRaw = raw;
      cached = raw === null ? defaults : cleanMorePreferences(raw, ids, defaults);
    }
    return memory ?? cached;
  } catch { return memory ?? cached; }
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) { memory = null; lastRaw = undefined; notify(); }
  };
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", onStorage); };
}

function save(hidden: readonly string[]) {
  memory = hidden;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, hidden }));
    memory = null;
  } catch { /* Appearance choices still work for this visit. */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Navigation appearance only; this preference never grants product access. */
export function useMorePreferences() {
  const hidden = useSyncExternalStore(subscribe, snapshot, () => defaults);
  return {
    hidden,
    toggle(id: string) {
      if (!ids.includes(id)) return;
      const current = snapshot();
      save(current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    },
    restore() { save(defaults); },
  };
}
