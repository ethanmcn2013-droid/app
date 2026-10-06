"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { MapView } from "./map-view";
import { River } from "./river";
import { ListView } from "./list-view";
import { PROJECTS, type Project } from "./data";
import type { Lens } from "./layout";
import s from "./map.module.css";

const PHONE = "(max-width: 720px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * null until the client knows the width. Until then both layouts render and
 * CSS picks one, so a phone never sees the desktop map first.
 */
function usePhone(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => null,
  );
}

/**
 * Project map: every project placed by when it lands (left to right) and how
 * it is going (top to bottom). Zoom into any project to make it its home.
 */
export default function ProjectMapConcept() {
  const phone = usePhone();
  const [sample, setSample] = useState<Project[]>(PROJECTS);
  const [blank, setBlank] = useState<Project[]>([]);
  const [emptyPreview, setEmptyPreview] = useState(false);
  const [lens, setLens] = useState<Lens>("health");
  const [view, setView] = useState<"map" | "list">("map");

  const projects = emptyPreview ? blank : sample;
  const setProjects = useCallback(
    (fn: (list: Project[]) => Project[]) => (emptyPreview ? setBlank(fn) : setSample(fn)),
    [emptyPreview],
  );

  if (view === "list") {
    return (
      <div className={s.root}>
        <ListView projects={projects} onMap={() => setView("map")} phone={!!phone} />
      </div>
    );
  }

  const river = <River projects={projects} onList={() => setView("list")} />;
  const map = (
    <MapView
      projects={projects}
      setProjects={setProjects}
      lens={lens}
      setLens={setLens}
      onList={() => setView("list")}
      isEmptyPreview={emptyPreview}
      setEmptyPreview={setEmptyPreview}
    />
  );

  return (
    <div className={s.root}>
      {/* Same tree before and after the client knows its width, so nothing remounts. */}
      <div className={s.onlyPhone}>{phone !== false ? river : null}</div>
      <div className={s.onlyDesktop}>{phone !== true ? map : null}</div>
    </div>
  );
}
