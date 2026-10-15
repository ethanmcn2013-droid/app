"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createBrowserPingLocalSpeech, type PingLocalSpeech, type PingLocalSpeechSnapshot } from "@/lib/ping/local-speech";
import { PingDock, PingMic, PingOverlay } from "./ping-overlay";
import styles from "./ping-overlay.module.css";

type Outcome = "committed" | "unknown" | "refused" | "cancelled";
type Props<Capture> = Readonly<{
  projectName: string | null;
  selectedCount: number;
  contextKey: string;
  canStart: boolean;
  typedContent: ReactNode;
  capture: () => Capture | null;
  isCurrent: (capture: Capture) => boolean;
  run: (capture: Capture, text: string, isActive: () => boolean) => Promise<Outcome>;
  hasRecovery: boolean;
}>;
type Operation<Capture> = {
  epoch: number;
  contextKey: string;
  kind: "capture" | "install";
  capture: Capture | null;
  finishRequested: boolean;
  handedOff: boolean;
};
const INITIAL: PingLocalSpeechSnapshot = { phase: "idle", reason: null, elapsedMs: 0 };

/** Local dictation hands one final request to the existing typed command owner. */
export function PingLocalSpeechPanel<Capture>(props: Props<Capture>) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const mounted = useRef(false);
  const epoch = useRef(0);
  const operation = useRef<Operation<Capture> | null>(null);
  const controller = useRef<PingLocalSpeech | null>(null);
  const openRef = useRef(false);
  const modeRef = useRef<"voice" | "typed">("voice");
  const executionPending = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const [snapshot, setSnapshot] = useState(INITIAL);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const typedRegion = useRef<HTMLDivElement>(null);
  const voiceRegion = useRef<HTMLDivElement>(null);
  const previousOverlay = useRef({ open: false, mode });
  const focusOrigin = useRef<HTMLElement | null>(null);
  const previousContext = useRef(props.contextKey);
  const hadRecovery = useRef(props.hasRecovery);

  const isActive = useCallback((owned: Operation<Capture>) => {
    if (!mounted.current || operation.current !== owned || epoch.current !== owned.epoch ||
      !openRef.current || modeRef.current !== "voice" || latest.current.contextKey !== owned.contextKey) return false;
    if (owned.kind === "install") return true;
    try { return owned.capture !== null && latest.current.isCurrent(owned.capture); }
    catch { return false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const engine = createBrowserPingLocalSpeech({
      isContextCurrent: () => { const owned = operation.current; return Boolean(owned && isActive(owned)); },
      onState: (next) => { if (mounted.current && controller.current === engine) setSnapshot(next); },
      onFinal: async (text) => {
        const owned = operation.current;
        if (!owned || owned.kind !== "capture" || owned.capture === null || !owned.finishRequested || owned.handedOff || !isActive(owned)) return;
        owned.handedOff = true;
        executionPending.current = true; setPending(true);
        try {
          const result = await latest.current.run(owned.capture, text, () => isActive(owned));
          if (isActive(owned)) setOutcome(result);
        } catch {
          // A lost handoff response cannot establish that a task change was refused.
          if (isActive(owned)) setOutcome("unknown");
        } finally {
          executionPending.current = false;
          if (mounted.current) setPending(false);
        }
      },
    });
    controller.current = engine;
    return () => {
      mounted.current = false; operation.current = null;
      engine.dispose();
      if (controller.current === engine) controller.current = null;
    };
  }, [isActive]);

  const invalidate = useCallback((message: string) => {
    epoch.current++; operation.current = null;
    controller.current?.cancel();
    setNotice(executionPending.current
      ? "A task change may already be running. Use Type instead to check its original result."
      : message);
  }, []);
  const close = useCallback(() => {
    invalidate(""); openRef.current = false; setOpen(false);
  }, [invalidate]);
  const typeInstead = () => {
    invalidate(""); modeRef.current = "typed"; setMode("typed");
  };

  useLayoutEffect(() => {
    if (previousContext.current !== props.contextKey) {
      previousContext.current = props.contextKey;
      invalidate("The Project or selection changed. Start again for the current tasks.");
      setOutcome(null);
    }
    if (hadRecovery.current && !props.hasRecovery) setOutcome((current) => current === "committed" ? current : null);
    hadRecovery.current = props.hasRecovery;
  }, [props.contextKey, props.hasRecovery, invalidate]);

  // Keep one Dialog owner: initial focus belongs to Dialog; mode handoff focuses the field.
  useLayoutEffect(() => {
    const previous = previousOverlay.current;
    previousOverlay.current = { open, mode };
    if (open && previous.open && mode === "typed" && previous.mode !== "typed") {
      const field = typedRegion.current?.querySelector<HTMLElement>("textarea:not(:disabled), input:not(:disabled)");
      const fallback = typedRegion.current?.querySelector<HTMLElement>("button:not(:disabled):not([data-dialog-skip-focus])");
      (field ?? fallback)?.focus({ preventScroll: true });
    }
    const origin = focusOrigin.current;
    if (!open || mode !== "voice" || !origin) return;
    const active = document.activeElement;
    if (active !== origin && active !== document.body && active?.isConnected) { focusOrigin.current = null; return; }
    if (origin.isConnected && !origin.matches(":disabled")) return;
    const next = voiceRegion.current?.querySelector<HTMLElement>('button:not(:disabled), [data-testid="ping-local-state"]');
    if (next) { next.focus({ preventScroll: true }); focusOrigin.current = next; }
  });

  useEffect(() => {
    if (snapshot.phase !== "listening") return;
    const timer = window.setInterval(() => {
      const next = controller.current?.getSnapshot();
      if (next) setSnapshot(next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [snapshot.phase]);

  const start = async () => {
    if (!controller.current || executionPending.current || latest.current.hasRecovery || !latest.current.canStart ||
      ["checking", "installing", "listening", "finishing", "processing", "closing"].includes(controller.current.getSnapshot().phase) || outcome === "unknown") return;
    let captured: Capture | null = null;
    try { captured = latest.current.capture(); } catch { /* Invalid context stays closed to capture. */ }
    if (captured === null) { setOutcome("refused"); setNotice("Select supported tasks or clear the selection, then try again."); return; }
    const owned: Operation<Capture> = { epoch: ++epoch.current, contextKey: latest.current.contextKey,
      kind: "capture", capture: captured, finishRequested: false, handedOff: false };
    operation.current = owned; setOutcome(null); setNotice("");
    await controller.current.start();
  };
  const install = async () => {
    if (!controller.current || executionPending.current || controller.current.getSnapshot().phase !== "needs_install") return;
    const owned: Operation<Capture> = { epoch: ++epoch.current, contextKey: latest.current.contextKey,
      kind: "install", capture: null, finishRequested: false, handedOff: false };
    operation.current = owned; setOutcome(null); setNotice("");
    const installed = await controller.current.install();
    if (installed && isActive(owned)) setNotice("English voice is ready. Choose Start listening when you’re ready.");
  };
  const finish = () => {
    const owned = operation.current;
    if (!owned || owned.finishRequested || !isActive(owned) || controller.current?.getSnapshot().phase !== "listening") return;
    owned.finishRequested = true;
    controller.current.finish();
  };
  const launchVoice = () => {
    openRef.current = true; modeRef.current = "voice"; setMode("voice"); setOpen(true);
    if (!executionPending.current && !props.hasRecovery && outcome !== "unknown") void start();
  };
  const launchTyped = () => {
    invalidate(""); openRef.current = true; modeRef.current = "typed"; setMode("typed"); setOpen(true);
  };

  const phase = snapshot.phase;
  const recovering = props.hasRecovery || outcome === "unknown";
  const busy = pending || ["checking", "installing", "finishing", "processing", "closing"].includes(phase);
  const listening = phase === "listening";
  const closing = ["closing"].includes(phase);
  const closureUnconfirmed = snapshot.reason === "native_closure_unconfirmed";
  const title = closureUnconfirmed ? "Check microphone access" : closing ? "Stopping the microphone…" : pending ? "Working on your request…" : outcome === "committed" ? "Your result is saved" : recovering ? "Let’s check the result" :
    phase === "needs_install" ? "Set up English voice" : phase === "installing" ? "Installing English voice…" :
    listening ? "I’m listening" : phase === "checking" ? "Getting ready…" : phase === "finishing" ? "Finishing your request…" :
    phase === "unavailable" ? "Voice isn’t available here" : phase === "error" ? "Voice couldn’t continue" :
    outcome === "refused" ? "No changes were made" : "What should change?";
  const reasonCopy = snapshot.reason === "timeout" ? "The 30-second limit was reached. Nothing was sent. Try a shorter request." :
    snapshot.reason === "end_before_finish" ? "Voice ended before Finish. Nothing was sent. Start again or type your request." :
    snapshot.reason === "incomplete_result" || snapshot.reason === "no_match" || snapshot.reason === "invalid_or_over_limit_result"
      ? "A complete request wasn’t heard. Nothing was sent. Start again or type your request." :
    snapshot.reason === "install_failed" ? "English voice could not be installed. Try again or type your request." :
    phase === "error" ? "Voice could not continue. Type your request to continue." : "";
  const status = closureUnconfirmed ? "The microphone could not be confirmed off. Close this tab before trying again." :
    snapshot.reason === "readiness_timeout" || snapshot.reason === "install_timeout" ? "Voice setup took too long. Close and reopen this tab, or type your request." :
    closing ? "Waiting for the browser to confirm voice has ended. A new capture cannot start yet." :
    pending ? "Checking and applying this exact request. Closing cannot undo a change already sent." :
    outcome === "committed" ? "Your task result is confirmed as saved." :
    recovering ? "Use Type instead to check the original result before starting another request." :
    notice || (phase === "needs_install" ? "Install the free English language pack for voice on this device. The microphone stays off during setup." :
    phase === "installing" ? "Your browser is downloading the English language pack. This does not start the microphone." :
    listening ? "Say your request, then choose Finish and run. Cancel discards this capture." :
    phase === "checking" ? "Checking whether this browser supports voice on this device." :
    phase === "finishing" ? "Waiting for the complete voice result. No task change has been confirmed yet." :
    phase === "unavailable" ? "This browser cannot use English voice on this device. You can still type an exact request." :
    outcome === "refused" ? "This request could not be applied. Use Type instead to review the supported commands." :
    reasonCopy || (!props.canStart ? "Select supported tasks or clear the selection to create tasks." : "Say “status doing” for selected tasks."));
  const canListen = props.canStart && !recovering && !busy && !listening && phase !== "unavailable" && phase !== "needs_install";
  const seconds = Math.floor(snapshot.elapsedMs / 1000);

  return <>
    <PingDock selectedCount={props.selectedCount}>
      <button type="button" className={styles.launch} data-testid="ping-voice-start" aria-haspopup="dialog" aria-expanded={open && mode === "voice"} onClick={launchVoice}><PingMic />Talk to Ping</button>
      <button type="button" className={styles.typeLaunch} data-testid="ping-type-open" aria-haspopup="dialog" aria-expanded={open && mode === "typed"} onClick={launchTyped}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="16" height="12" rx="3" /><path d="M5.5 7.5h.01m3-.01h.01m3-.01h.01m3-.01h.01M5.5 10.5h.01m3-.01h.01m3-.01h.01m3-.01h.01M6.5 13h7" /></svg>Type a request</button>
    </PingDock>
    <PingOverlay open={open} onClose={close} projectName={props.projectName} selectedCount={props.selectedCount}>
      {mode === "typed" ? <div ref={typedRegion}>{props.typedContent}</div> :
        <div ref={voiceRegion} className={`${styles.voice} ${listening ? styles.listening : ""}`} data-testid="ping-local-speech-panel"
          onClickCapture={(event) => { const node = (event.target as HTMLElement).closest<HTMLButtonElement>("button"); if (node === document.activeElement) focusOrigin.current = node; }}>
          <div className={styles.signal} data-state={closing || closureUnconfirmed ? "idle" : busy ? "working" : outcome === "committed" ? "saved" : listening ? "listening" : "idle"} aria-hidden="true">
            <span className={styles.signalFrame} />
            <span className={styles.signalCore}>
              {closing || closureUnconfirmed ? <PingMic /> : busy ? <svg className={styles.workingMark} viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle className={styles.workingTrack} cx="20" cy="20" r="13" /><path d="M20 7a13 13 0 0 1 13 13" /></svg> : outcome === "committed" ? <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m11 20 6 6 12-13" /></svg> : <PingMic />}
            </span>
          </div>
          <h3 className={styles.title}>{title}</h3>
          <p tabIndex={-1} className={styles.status} role="status" aria-live="polite" data-testid="ping-local-state" data-phase={phase} data-outcome={outcome ?? ""}>{status}</p>
          {listening ? <p className={styles.timer}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · Microphone on · 30 seconds max</p> : null}
          <div className={styles.actions}>
            {phase === "needs_install" && !recovering ? <button type="button" className={styles.primary} data-testid="ping-local-install" onClick={() => void install()}>Install free English pack</button> : null}
            {listening ? <button type="button" className={styles.primary} data-testid="ping-local-finish" onClick={finish}>Finish and run</button> : null}
            {canListen ? <button type="button" className={styles.primary} data-testid="ping-local-start" onClick={() => void start()}>{outcome === "committed" ? "Speak again" : "Start listening"}</button> : null}
            {listening || phase === "checking" || phase === "installing" || phase === "finishing" ? <button type="button" className={styles.secondary} onClick={() => { invalidate("Capture cancelled. No voice request was sent."); setOutcome("cancelled"); }}>Cancel</button> : null}
            <button type="button" className={recovering || phase === "unavailable" ? styles.primary : styles.secondary} onClick={typeInstead}>Type instead</button>
          </div>
          <p className={styles.footnote}>English voice on this device. Use the same exact commands as typing. Finish runs your request in this Project.</p>
        </div>}
    </PingOverlay>
  </>;
}
