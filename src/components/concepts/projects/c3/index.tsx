"use client";

import { useState } from "react";
import { Experience } from "./experience";
import type { Scenario } from "./logic";

/**
 * Projects, concept 3: Weekly check-in.
 *
 * Attention, not inventory. Projects sit in lanes by what you should do
 * about them, each card leads with the reason in a plain sentence, and the
 * weekly status review becomes a sixty-second, one-card-at-a-time ritual.
 * Front-end only, on invented Orchard data.
 */
export default function Concept() {
  const [scenario, setScenario] = useState<Scenario>("default");
  // Keyed so each preview state starts from a clean slate.
  return <Experience key={scenario} scenario={scenario} onScenario={setScenario} />;
}
