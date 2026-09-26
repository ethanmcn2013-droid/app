"use client";

import { useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useToast } from "@/components/primitives/toast";
import { updateUserPreferencesAction } from "@/server/actions/preferences";
import {
  setPersonalityPrefsAction,
} from "@/server/actions/personality";
import type { PersonalityPrefs } from "@/lib/personality-prefs";
import type { ThemeMode } from "@/server/db/preferences";
import { SectionHeader } from "../settings-app";
import {
  SettingsGroup,
  SettingsRow,
  cx,
  switchKnobClass,
  switchTrackClass,
  ui,
} from "../settings-ui";

// Light, Dark, System: the same order as the theme switch in the sidebar
// footer, so the two controls read as one choice made in two places.
const OPTIONS: Array<{ value: ThemeMode; label: string; description: string; icon: ReactNode }> = [
  {
    value: "light",
    label: "Light",
    description: "Always light, regardless of your device setting.",
    icon: (
      <path d="M8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5ZM8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
    ),
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always dark, regardless of your device setting.",
    icon: <path d="M13 9.6A5.25 5.25 0 1 1 6.4 3a4.25 4.25 0 0 0 6.6 6.6Z" />,
  },
  {
    value: "system",
    label: "System",
    description: "Follows your device setting. Switches automatically.",
    icon: (
      <>
        <rect x="2" y="3" width="12" height="8" rx="1.25" />
        <path d="M6 13.5h4M8 11v2.5" />
      </>
    ),
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
    <div>
      <SectionHeader
        title="Appearance"
        description="Choose a colour scheme. It applies everywhere you are signed in."
      />

      <section aria-labelledby="appearance-theme">
        <h3 id="appearance-theme" className="mb-2.5 px-0.5 text-[13.5px] font-semibold leading-5 text-[color:var(--v3-text)]">Theme</h3>
        <div>
          {/* One choice among three, so it announces itself as one: a radio
              group, not three unrelated buttons. Each card carries the
              plain-English line its option needs, which a segmented strip
              has no room for.

              Announcing the role means owing the keyboard contract that comes
              with it: one tab stop for the group (the checked card), arrows to
              move focus and selection, Home/End to the ends, Space to select.
              The logic is in radioGroupKeyTarget and rovingTabIndex above. */}
          <div role="radiogroup" aria-label="Colour scheme" className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((opt, index) => {
              const isActive = themeMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  // Not `disabled`: a disabled control loses focus to the body
                  // the instant the write starts. This keeps the card focused
                  // and dimmed, and handleChange refuses the re-entry.
                  aria-disabled={pending}
                  ref={(node) => {
                    radioRefs.current[index] = node;
                  }}
                  tabIndex={rovingTabIndex(index, checkedIndex)}
                  onClick={() => handleChange(opt.value)}
                  onKeyDown={(event) => handleRadioKeyDown(event, index)}
                  data-pending={pending ? "" : undefined}
                  className={cx(
                    "group flex w-full flex-col overflow-hidden rounded-[var(--v3-radius-lg)] border bg-[var(--v3-surface)] text-left transition-[border-color,box-shadow,transform] duration-200 ease-[var(--v3-ease)] aria-disabled:cursor-default aria-disabled:opacity-60 focus-visible:rounded-[var(--v3-radius-lg)]!",
                    isActive
                      ? "border-[color:var(--v3-accent)] shadow-[0_0_0_1px_var(--v3-accent),0_0_0_5px_color-mix(in_srgb,var(--v3-accent)_14%,transparent)]"
                      : "border-[color:var(--v3-border)] hover:-translate-y-px hover:border-[color:var(--v3-border-strong)] hover:shadow-[var(--v3-shadow-pop)]",
                  )}
                >
                  <ThemePreview mode={opt.value} />
                  <span className="flex w-full items-start gap-2.5 px-3.5 py-3">
                    {/* Radio indicator */}
                    <span
                      aria-hidden
                      className={cx(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isActive
                          ? "border-[color:var(--v3-accent)] bg-[var(--v3-accent)]"
                          : "border-[color:var(--v3-border-strong)] bg-[var(--v3-surface)]",
                      )}
                    >
                      {isActive ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--v3-on-accent)]" />
                      ) : null}
                    </span>
                    <span className="block min-w-0">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[color:var(--v3-text)]">
                        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--v3-text-3)]">
                          {opt.icon}
                        </svg>
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-[1.45] text-[color:var(--v3-text-2)]">
                        {opt.description}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-3 px-0.5 text-[12px] leading-[1.5] text-[color:var(--v3-text-3)]">
          Pages you share by link stay light for whoever opens them.
        </p>
      </section>

      {/* Personality group */}
      <SettingsGroup
        title="How the app speaks to you"
        description="All three are on by default. Turn any off and the app stays quiet in that area."
      >
        {PERSONALITY_TOGGLES.map((t) => (
          <SettingsRow key={t.key} label={t.title} description={t.description}>
            <PersonalityToggle
              checked={personalityPrefs[t.key]}
              onChange={(next) => handlePersonalityToggle(t.key, next)}
              disabled={personalityPending}
              label={t.title}
            />
          </SettingsRow>
        ))}
        <SettingsRow
          label="Dismissed tips"
          description="Bring back the tips you closed. They appear again as you work."
        >
          <button type="button" onClick={handleShowTipsAgain} className={ui.button}>
            Show tips again
          </button>
        </SettingsRow>
      </SettingsGroup>
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
      className={switchTrackClass(checked)}
    >
      <span className={switchKnobClass(checked)} aria-hidden />
    </button>
  );
}

// ── Theme previews ───────────────────────────────────────────────────
//
// A Light card has to look light while the app is dark, and the other way
// round, without a single hardcoded colour. `--v3-solid` / `--v3-on-solid`
// are the one token pair that swaps sides between themes (near-black on
// light, near-white on dark). PREVIEW_GROUND picks the light member of the
// pair as --pv-paper and the dark member as --pv-ink in either theme, keyed
// on the same data-theme attribute v3.css switches on. (Not light-dark():
// the document's color-scheme currently stays "light" in the dark theme.)
// Every other preview colour is a mix of the two.

const PREVIEW_GROUND =
  "[--pv-paper:var(--v3-on-solid)] [--pv-ink:var(--v3-solid)] [[data-theme=dark]_&]:[--pv-paper:var(--v3-solid)] [[data-theme=dark]_&]:[--pv-ink:var(--v3-on-solid)]";
const PAPER = "var(--pv-paper)";
const INK = "var(--pv-ink)";

function previewPalette(mode: "light" | "dark"): React.CSSProperties {
  const light = mode === "light";
  const [ground, figure] = light ? [PAPER, INK] : [INK, PAPER];
  const mix = (pct: number) => `color-mix(in srgb, ${figure} ${pct}%, ${ground})`;
  return {
    "--pv-shell": light ? mix(5) : ground,
    "--pv-canvas": light ? ground : mix(7),
    "--pv-border": mix(light ? 10 : 13),
    "--pv-line": mix(light ? 13 : 20),
    "--pv-line-strong": mix(light ? 30 : 42),
    "--pv-chip": mix(light ? 6 : 11),
  } as React.CSSProperties;
}

function PreviewScene({ mode }: { mode: "light" | "dark" }) {
  return (
    <span className="absolute inset-0 block bg-[var(--pv-shell)]" style={previewPalette(mode)}>
      {/* Sidebar */}
      <span className="absolute left-[10px] top-[11px] flex w-[27%] flex-col gap-[5px]">
        <span className="mb-[3px] flex items-center gap-[4px]">
          <span className="h-[7px] w-[7px] rounded-[2px] bg-[var(--v3-accent)]" />
          <span className="h-[4px] w-[58%] rounded-full bg-[var(--pv-line-strong)]" />
        </span>
        <span className="flex h-[10px] items-center rounded-[3px] bg-[var(--pv-canvas)] px-[4px] shadow-[0_0_0_1px_var(--pv-border)]">
          <span className="h-[3px] w-[60%] rounded-full bg-[var(--pv-line-strong)]" />
        </span>
        <span className="ml-[4px] h-[3px] w-[66%] rounded-full bg-[var(--pv-line)]" />
        <span className="ml-[4px] h-[3px] w-[52%] rounded-full bg-[var(--pv-line)]" />
        <span className="ml-[4px] h-[3px] w-[60%] rounded-full bg-[var(--pv-line)]" />
      </span>
      {/* Page */}
      <span className="absolute -bottom-px left-[37%] right-[8px] top-[8px] rounded-t-[6px] bg-[var(--pv-canvas)] shadow-[0_0_0_1px_var(--pv-border)]">
        <span className="absolute left-[9px] right-[9px] top-[9px] flex items-center justify-between">
          <span className="h-[5px] w-[38%] rounded-full bg-[var(--pv-line-strong)]" />
          <span className="h-[8px] w-[20%] rounded-[2px] bg-[var(--v3-accent)]" />
        </span>
        <span className="absolute left-[9px] top-[20px] h-[3px] w-[52%] rounded-full bg-[var(--pv-line)]" />
        <span className="absolute left-[9px] right-[9px] top-[31px] flex gap-[5px]">
          <span className="flex h-[30px] flex-1 flex-col gap-[4px] rounded-[3px] bg-[var(--pv-chip)] p-[5px] shadow-[0_0_0_1px_var(--pv-border)]">
            <span className="h-[3px] w-[70%] rounded-full bg-[var(--pv-line-strong)]" />
            <span className="h-[3px] w-[45%] rounded-full bg-[var(--pv-line)]" />
          </span>
          <span className="flex h-[30px] flex-1 flex-col gap-[4px] rounded-[3px] bg-[var(--pv-chip)] p-[5px] shadow-[0_0_0_1px_var(--pv-border)]">
            <span className="h-[3px] w-[55%] rounded-full bg-[var(--pv-line-strong)]" />
            <span className="h-[3px] w-[62%] rounded-full bg-[var(--pv-line)]" />
          </span>
        </span>
      </span>
    </span>
  );
}

function ThemePreview({ mode }: { mode: ThemeMode }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative block h-[96px] w-full overflow-hidden border-b border-[color:var(--v3-border)]",
        PREVIEW_GROUND,
      )}
    >
      {mode === "system" ? (
        <>
          <PreviewScene mode="light" />
          <span
            className="absolute inset-0 block"
            style={{ clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)" }}
          >
            <PreviewScene mode="dark" />
          </span>
        </>
      ) : (
        <PreviewScene mode={mode} />
      )}
    </span>
  );
}
