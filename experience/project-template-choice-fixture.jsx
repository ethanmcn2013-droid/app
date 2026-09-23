import React from "react";
import { createRoot } from "react-dom/client";
import { AddProjectRow } from "../src/components/studio-bar/projects-sidebar";

window.templateProbe = { calls: [], blank: [], selected: [], refreshes: 0 };
createRoot(document.getElementById("root")).render(
  <ul><AddProjectRow onCreated={() => { window.templateProbe.selected.push("opened"); }} /></ul>,
);
