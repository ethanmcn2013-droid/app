"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./settings-overlay.module.css";
import { SettingsOverlayDrafts, type SettingsFieldValue } from "./settings-overlay-drafts";

const UNSAVED_MESSAGE =
  "You have a draft in Settings. Leave and discard your unsaved changes?";

type SettingsField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isSettingsField(target: EventTarget | null): target is SettingsField {
  if (target instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "file", "hidden"].includes(target.type);
  }
  return target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function readFieldValue(field: SettingsField): SettingsFieldValue {
  if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) {
    return field.checked;
  }
  return field.value;
}

export function SettingsOverlay({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const draftTrackerRef = useRef(new SettingsOverlayDrafts());
  const anonymousFieldKeysRef = useRef(new WeakMap<SettingsField, string>());
  const nextAnonymousFieldIdRef = useRef(0);
  const [hasDraft, setHasDraft] = useState(false);

  const fieldKey = useCallback((field: SettingsField) => {
    const tag = field.tagName.toLowerCase();
    if (field.id) return `${tag}:id:${field.id}`;
    if (field.name) {
      const form = field.form;
      const owner = form?.id || form?.getAttribute("name") || "settings";
      const groupValue = field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)
        ? `:${field.value}`
        : "";
      return `${tag}:name:${owner}:${field.name}${groupValue}`;
    }
    let key = anonymousFieldKeysRef.current.get(field);
    if (!key) {
      key = `anonymous:${nextAnonymousFieldIdRef.current++}`;
      anonymousFieldKeysRef.current.set(field, key);
    }
    return key;
  }, []);

  const captureBaseline = useCallback((field: SettingsField) => {
    draftTrackerRef.current.captureBaseline(fieldKey(field), readFieldValue(field));
  }, [fieldKey]);

  const setFieldDirty = useCallback((field: SettingsField) => {
    const dirty = draftTrackerRef.current.update(fieldKey(field), readFieldValue(field));
    setHasDraft(dirty);
  }, [fieldKey]);

  const dismiss = useCallback(() => {
    if (draftTrackerRef.current.hasDraft && !window.confirm(UNSAVED_MESSAGE)) return;
    router.back();
  }, [router]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const activeLink = activeElement?.closest<HTMLAnchorElement>("a[href]");
    const settingsLink = activeLink?.pathname === "/app/settings"
      ? activeLink
      : [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
          .find((link) => link.pathname === "/app/settings") ?? null;
    previousFocusRef.current = settingsLink ?? activeElement;

    // Capture the rendered controls before a mouse or keyboard action can
    // change them. Later tabs and async sections capture on focus instead.
    for (const field of dialog.querySelectorAll("input, select, textarea")) {
      if (isSettingsField(field)) captureBaseline(field);
    }
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [captureBaseline]);

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    dismiss();
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) dismiss();
  }

  function onInput(event: FormEvent<HTMLDialogElement>) {
    if (isSettingsField(event.target)) setFieldDirty(event.target);
  }

  function onBeforeInput(event: FormEvent<HTMLDialogElement>) {
    if (isSettingsField(event.target)) captureBaseline(event.target);
  }

  function onChange(event: FormEvent<HTMLDialogElement>) {
    if (isSettingsField(event.target)) setFieldDirty(event.target);
  }

  function onFocusCapture(event: FocusEvent<HTMLDialogElement>) {
    if (isSettingsField(event.target)) captureBaseline(event.target);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Settings"
      className={styles.dialog}
      onCancel={onCancel}
      onClick={onBackdropClick}
      onInput={onInput}
      onBeforeInput={onBeforeInput}
      onChange={onChange}
      onFocusCapture={onFocusCapture}
      data-has-draft={hasDraft ? "true" : undefined}
    >
      <section className={styles.surface}>
        <button
          type="button"
          className={styles.close}
          aria-label="Close Settings"
          onClick={dismiss}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
        <div className={styles.content}>{children}</div>
      </section>
    </dialog>
  );
}
