import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ReorderList } from "../src/components/ui/reorder-list";

type Row = { id: string; label: string };
declare global {
  interface Window {
    reorderPointerProbe: { toggleHits: number; openHits: number; orders: string[][] };
  }
}

window.reorderPointerProbe = { toggleHits: 0, openHits: 0, orders: [] };

function Probe() {
  const [items, setItems] = useState<Row[]>([
    { id: "alpha", label: "Alpha" }, { id: "beta", label: "Beta" },
  ]);
  const [done, setDone] = useState(false);
  return (
    <ReorderList
      items={items}
      ariaLabel="Pointer regression rows"
      onReorder={(next) => {
        setItems(next);
        window.reorderPointerProbe.orders.push(next.map((item) => item.id));
      }}
      renderItem={(item) => (
        <div style={{ display: "flex", gap: 16, minHeight: 48, alignItems: "center" }}>
          <button
            aria-label={`Toggle ${item.label}`}
            aria-pressed={item.id === "alpha" && done}
            onClick={() => {
              window.reorderPointerProbe.toggleHits++;
              if (item.id === "alpha") setDone((value) => !value);
            }}
            type="button"
          >{item.id === "alpha" && done ? "Done" : "To do"}</button>
          <button aria-label={`Open ${item.label}`} onClick={() => { window.reorderPointerProbe.openHits++; }} type="button">
            {item.label}
          </button>
        </div>
      )}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Probe />);
