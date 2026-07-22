"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsPreferences } from "../../lib/analytics/contracts";

interface CardDefinition {
  id: string;
  label: string;
}

interface CustomizeModeProps {
  cards: CardDefinition[];
  preferences: AnalyticsPreferences;
  endpoint: string;
}

function move(items: string[], id: string, direction: -1 | 1): string[] {
  const from = items.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function CustomizeMode({
  cards,
  preferences,
  endpoint,
}: CustomizeModeProps) {
  const router = useRouter();
  const defaults = cards.map((card) => card.id);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => new Set(preferences.hiddenCardIds));
  const [pinned, setPinned] = useState(() => new Set(preferences.pinnedCardIds));
  const [order, setOrder] = useState(() => {
    const known = preferences.cardOrder.filter((id) => defaults.includes(id));
    return [...known, ...defaults.filter((id) => !known.includes(id))];
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function save() {
    setStatus("saving");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hiddenCardIds: [...hidden],
          pinnedCardIds: [...pinned],
          cardOrder: order,
        }),
      });
      if (!response.ok) throw new Error("Preference update failed");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        className="signal-button-secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        Customize overview
      </button>
    );
  }

  return (
    <section className="signal-customize" aria-labelledby="customize-heading">
      <div className="signal-section-heading">
        <div>
          <p className="signal-eyebrow">Customize mode</p>
          <h2 id="customize-heading">Choose what stays in your overview</h2>
          <p>Hide, pin, or reorder the recommended cards. Source data is unchanged.</p>
        </div>
        <button
          className="signal-button-quiet"
          type="button"
          onClick={() => setOpen(false)}
        >
          Done
        </button>
      </div>

      <ol className="signal-customize-list">
        {order.map((id, index) => {
          const card = cards.find((candidate) => candidate.id === id);
          if (!card) return null;
          return (
            <li className="signal-customize-row" key={id}>
              <span>
                <strong>{card.label}</strong>
                {pinned.has(id) ? " · Pinned" : ""}
                {hidden.has(id) ? " · Hidden" : ""}
              </span>
              <div className="signal-customize-controls">
                <button
                  className="signal-button-quiet"
                  type="button"
                  disabled={index === 0}
                  onClick={() => setOrder((current) => move(current, id, -1))}
                >
                  Move up
                </button>
                <button
                  className="signal-button-quiet"
                  type="button"
                  disabled={index === order.length - 1}
                  onClick={() => setOrder((current) => move(current, id, 1))}
                >
                  Move down
                </button>
                <button
                  className="signal-button-quiet"
                  type="button"
                  onClick={() =>
                    setPinned((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                >
                  {pinned.has(id) ? "Unpin" : "Pin"}
                </button>
                <button
                  className="signal-button-quiet"
                  type="button"
                  onClick={() =>
                    setHidden((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                >
                  {hidden.has(id) ? "Show" : "Hide"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="signal-actions">
        <button
          className="signal-button"
          type="button"
          disabled={status === "saving"}
          onClick={save}
        >
          {status === "saving" ? "Saving…" : "Save overview"}
        </button>
        <button
          className="signal-button-secondary"
          type="button"
          onClick={() => {
            setHidden(new Set());
            setPinned(new Set());
            setOrder(defaults);
            setStatus("idle");
          }}
        >
          Restore recommended defaults
        </button>
        <span role="status" aria-live="polite" className="signal-freshness">
          {status === "saved"
            ? "Saved"
            : status === "error"
              ? "Could not save. Try again."
              : ""}
        </span>
      </div>
    </section>
  );
}
