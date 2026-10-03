import type { ComponentType } from "react";
/**
 * Concept gallery registry (review/demo only). Each concept lives in its own
 * folder: src/components/concepts/<view>/c<n>/{meta.ts,index.tsx,...}.
 */
import { meta as overview2Meta } from "./overview/c2/meta";
import { meta as overview3Meta } from "./overview/c3/meta";
import { meta as projects1Meta } from "./projects/c1/meta";
import { meta as projects2Meta } from "./projects/c2/meta";
import { meta as projects4Meta } from "./projects/c4/meta";
import { meta as files3Meta } from "./files/c3/meta";
import { meta as files5Meta } from "./files/c5/meta";
import { meta as board1Meta } from "./board/c1/meta";
import { meta as whiteboard1Meta } from "./whiteboard/c1/meta";
import { meta as list1Meta } from "./list/c1/meta";
import { meta as list3Meta } from "./list/c3/meta";
import { meta as calendar1Meta } from "./calendar/c1/meta";
import { meta as calendar2Meta } from "./calendar/c2/meta";
import { meta as calendar4Meta } from "./calendar/c4/meta";
import { meta as analytics4Meta } from "./analytics/c4/meta";
import { meta as analytics5Meta } from "./analytics/c5/meta";
import { meta as analytics6Meta } from "./analytics/c6/meta";
import { meta as apps5Meta } from "./apps/c5/meta";
import type { ConceptMeta } from "./types";

export const CONCEPTS: readonly ConceptMeta[] = [
  overview2Meta,
  overview3Meta,
  projects1Meta,
  projects2Meta,
  projects4Meta,
  files3Meta,
  files5Meta,
  board1Meta,
  list1Meta,
  list3Meta,
  calendar1Meta,
  calendar2Meta,
  calendar4Meta,
  analytics4Meta,
  analytics5Meta,
  analytics6Meta,
  apps5Meta,
  whiteboard1Meta,
];

export const CONCEPT_LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  "overview/2": () => import("./overview/c2"),
  "overview/3": () => import("./overview/c3"),
  "projects/1": () => import("./projects/c1"),
  "projects/2": () => import("./projects/c2"),
  "projects/4": () => import("./projects/c4"),
  "files/3": () => import("./files/c3"),
  "files/5": () => import("./files/c5"),
  "board/1": () => import("./board/c1"),
  "list/1": () => import("./list/c1"),
  "list/3": () => import("./list/c3"),
  "calendar/1": () => import("./calendar/c1"),
  "calendar/2": () => import("./calendar/c2"),
  "calendar/4": () => import("./calendar/c4"),
  "analytics/4": () => import("./analytics/c4"),
  "analytics/5": () => import("./analytics/c5"),
  "analytics/6": () => import("./analytics/c6"),
  "apps/5": () => import("./apps/c5"),
  "whiteboard/1": () => import("./whiteboard/c1"),
};
