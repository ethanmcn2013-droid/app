"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useToast } from "@/components/primitives/toast";
import { updateUserPreferencesAction } from "@/server/actions/preferences";
import {
  setPersonalityPrefsAction,
} from "@/server/actions/personality";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import type { ThemeMode } from "@/server/db/preferences";
import { SectionHeader } from "../settings-app";

const OPTIONS: Array<{ value: ThemeMode; label: string; description: string }> = [
  {
    value: "system",
    label: "System",
    description: "Follows your device setting. Switches automatically.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always light, regardless of your device setting.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always dark, regardless of your device setting.",
  },
];

/**
 * Apply the choice to the live document, then let the server catch up.
 *
 * The app layout's resolver (src/app/app/theme-runtime.tsx) owns the two
 * attributes and the prefers-color-scheme listener; this only tells it the
 * choice changed. Writing data-theme directly here would work until the
 * user picked System, which has no fixed value — so the control sets the
 * mode and the resolver decides what that means right now.
 */
function applyThemeMode(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme-mode", mode);
  window.dispatchEvent(new Event("signal:theme"));
}

/**
 * The radio-group keyboard contract, as a pure function.
 *
 * WAI-ARIA's radio group pattern: the arrows move focus AND selection and
 * wrap at both ends, Home/End jump to the ends, and Space re-selects
 * wherever focus already sits. Given the key, the index it was pressed on
 * and how many radios there are, this returns the index that should become
 * both focused and checked — or null when the key is none of the group's
 * business and the browser should keep it (Tab, Enter, Escape, typing).
 *
 * It lives here rather than inline in the handler so the contract can be
 * proven without a browser: see appearance-radiogroup.test.ts.
 */
export function radioGroupKeyTarget(
  key: string,
  index: number,
  count: number,
): number | null {
  if (count <= 0 || index < 0 || index >= count) return null;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case " ":
    // "Spacebar" is the legacy KeyboardEvent.key spelling; still emitted by
    // older engines and cheap to honour.
    case "Spacebar":
      return index;
    default:
      return null;
  }
}

/**
 * One tab stop for the whole group, not one per radio: the checked option
 * is the group's entry point, and if somehow nothing is checked the first
 * option takes the stop. Everything else is reachable by arrow, not by Tab.
 */
export function rovingTabIndex(index: number, checkedIndex: number): 0 | -1 {
  const stop = checkedIndex < 0 ? 0 : checkedIndex;
  return index === stop ? 0 : -1;
}

const PERSONALITY_TOGGLES: Array<{
  key: keyof PersonalityPrefs;
  title: string;
  description: string;
}> = [
  {
    key: "greeting",
    title: "Greeting in your inbox",
    description: "A one-line contextual summary at the top of your inbox. Shows once per session.",
  },
  {
    key: "tips",
    title: "Tips while you work",
    description: "Occasional tips about features you may not have found. One per week at most.",
  },
  {
    key: "celebrations",
    title: "Milestone notes",
    description: "A note in your inbox when you reach 100, 250, 500 or 1000 completed tasks.",
  },
];

export function AppearanceSection({
  initialThemeMode,
  initialPersonalityPrefs,
}: {
  initialThemeMode: ThemeMode;
  initialPersonalityPrefs: PersonalityPrefs;
}) {
  const { toast } = useToast();
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [pending, startTransition] = useTransition();
  const [personalityPrefs, setPersonalityPrefs] = useState<PersonalityPrefs>(
    initialPersonalityPrefs,
  );
  const [personalityPending, startPersonalityTransition] = useTransition();
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const checkedIndex = OPTIONS.findIndex((o) => o.value === themeMode);

  function handleChange(next: ThemeMode) {
    // Re-entry guard. The radios are never `disabled` while the write is in
    // flight — disabling the focused control drops focus to the body and a
    // keyboard user loses their place mid-interaction — so this, not the
    // DOM, is what stops a second write landing on top of the first.
    if (pending) return;
    const previous = themeMode;
    setThemeMode(next);
    // The theme changes under the click, not after the round-trip: this is a
    // preference about how the app looks, so the app looking that way IS the
    // confirmation. If the write fails, the paint goes back with the state.
    applyThemeMode(next);
    startTransition(async () => {
      try {
        await updateUserPreferencesAction({ themeMode: next });
      } catch (e) {
        setThemeMode(previous);
        applyThemeMode(previous);
        toast("Could not save preference", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function handleRadioKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const target = radioGroupKeyTarget(event.key, index, OPTIONS.length);
    if (target === null) return;
    // Ours now: no page scroll on the arrows or Space, and no second
    // activation from the button's native Space-to-click.
    event.preventDefault();
    // Focus moves even while a write is in flight. The selection may be
    // refused by the guard above, but the caret is the reader's, not ours.
    radioRefs.current[target]?.focus();
    handleChange(OPTIONS[target].value);
  }

  function handlePersonalityToggle(key: keyof PersonalityPrefs, next: boolean) {
    // Optimistic update.
    setPersonalityPrefs((p) => ({ ...p, [key]: next }));
    startPersonalityTransition(async () => {
      try {
        await setPersonalityPrefsAction({ [key]: next });
      } catch (e) {
        setPersonalityPrefs((p) => ({ ...p, [key]: !next }));
        toast("Could not save preference", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function handleShowTipsAgain() {
    window.dispatchEvent(new CustomEvent("tips:reset"));
    toast("Tips will reappear as you work.", { tone: "success" });
  }

  return (
    <div className="space-y-10">
      {/* Theme group */}
      <div>
        <SectionHeader
          eyebrow="Appearance"
          title="How the app looks"
          description="Choose a colour scheme. It applies everywhere you are signed in."
        />

        {/* One choice among three, so it announces itself as one: a radio
            group, not three unrelated buttons. The cards are the section's
            existing grammar — they carry the plain-English line each option
            needs, which a segmented strip has no room for.

            Announcing the role means owing the keyboard contract that comes
            with it: one tab stop for the group (the checked card), arrows to
            move focus and selection, Home/End to the ends, Space to select.
            The logic is in radioGroupKeyTarget and rovingTabIndex above. */}
        <div role="radiogroup" aria-label="Colour scheme" className="space-y-3">
          {OPTIONS.map((opt, index) => {
            const isActive = themeMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                ref={(node) => {
                  radioRefs.current[index] = node;
                }}
                tabIndex={rovingTabIndex(index, checkedIndex)}
                onClick={() => handleChange(opt.value)}
                onKeyDown={(event) => handleRadioKeyDown(event, index)}
                // Not `disabled`: a disabled control loses focus to the body
                // the instant the write starts. This keeps the card focused
                // and dimmed, and handleChange refuses the re-entry.
                aria-disabled={pending}
                data-pending={pending ? "" : undefined}
                className={
                  "flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors aria-disabled:cursor-default aria-disabled:opacity-60 " +
                  (isActive
                    ? "border-brand/40 bg-brand-soft/30 ring-1 ring-brand/20"
                    : "border-line-soft bg-bg-elevated hover:border-line")
                }
              >
                {/* Radio indicator */}
                <span
                  className={
                    "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors " +
                    (isActive
                      ? "border-brand bg-brand"
                      : "border-ink-faint bg-paper")
                  }
                  aria-hidden
                >
                  {isActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>

                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {opt.label}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-[1.55] text-ink-soft">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p
          className="mt-4 text-[11.5px] leading-[1.55]"
          style={{ color: "var(--x-ink-quiet, var(--ink-quiet))" }}
        >
          Pages you share by link stay light for whoever opens them.
        </p>
      </div>

      {/* Personality group */}
      <div>
        <div className="mb-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            Personality
          </div>
          <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
            How the app speaks to you
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-[1.55] text-ink-soft">
            All three are on by default. Turn any off and the app stays quiet in that area.
          </p>
        </div>

        <ul className="space-y-3">
          {PERSONALITY_TOGGLES.map((t) => (
            <li
              key={t.key}
              className="flex items-start gap-4 rounded-xl border border-line-soft bg-bg-elevated p-5"
            >
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-ink">{t.title}</div>
                <p className="mt-1 max-w-[600px] text-[12.5px] leading-[1.6] text-ink-soft">
                  {t.description}
                </p>
              </div>
              <PersonalityToggle
                checked={personalityPrefs[t.key]}
                onChange={(next) => handlePersonalityToggle(t.key, next)}
                disabled={personalityPending}
                label={t.title}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleShowTipsAgain}
            className="text-[12.5px] text-ink-soft underline decoration-ink-faint underline-offset-2 transition-colors hover:text-ink hover:decoration-ink-soft"
          >
            Show tips again
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonalityToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative h-6 w-10 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 " +
        (checked ? "bg-brand" : "bg-ink-faint/60")
      }
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(20,21,26,0.2)] transition-transform " +
          (checked ? "translate-x-[18px]" : "translate-x-[2px]")
        }
        aria-hidden
      />
    </button>
  );
}
