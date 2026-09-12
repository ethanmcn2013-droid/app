/** Shared-store polling experiment. No process-local event bus or credentials. */
export type PollScope = Readonly<{ actorId: string; projectId: string; conversationId: string }>;
type Timer = ReturnType<typeof setTimeout>;
export type PollClock = Readonly<{
  set: (callback: () => void, delayMs: number) => Timer;
  clear: (timer: Timer) => void;
}>;

export class ConversationPoller<T> {
  private scope: PollScope | null = null;
  private visible = false;
  private active = true;
  private generation = 0;
  private failures = 0;
  private timer: Timer | null = null;
  private controller: AbortController | null = null;
  private inFlight = false;
  private readonly clock: PollClock;

  constructor(private readonly options: Readonly<{
    poll: (scope: PollScope, signal: AbortSignal) => Promise<T>;
    apply: (value: T, scope: PollScope) => void | Promise<void>;
    isRetryable?: (value: T) => boolean;
    onFailure?: (consecutiveFailures: number) => void;
    random?: () => number;
    clock?: PollClock;
  }>) {
    this.clock = options.clock ?? { set: (callback, ms) => setTimeout(callback, ms), clear: (timer) => clearTimeout(timer) };
  }

  /** Reconfiguration invalidates all responses from the previous session/scope. */
  configure(scope: PollScope | null, visible: boolean, active = true): void {
    this.generation++;
    this.scope = scope;
    this.visible = visible;
    this.active = active;
    this.failures = 0;
    this.cancelScheduled();
    this.controller?.abort();
    if (scope && visible && !this.inFlight) this.schedule(0);
  }

  stop(): void {
    this.configure(null, false);
  }

  private cancelScheduled(): void {
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number): void {
    this.cancelScheduled();
    this.timer = this.clock.set(() => { this.timer = null; void this.run(); }, delayMs);
  }

  private async run(): Promise<void> {
    if (!this.scope || !this.visible || this.inFlight) return;
    const scope = this.scope;
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.inFlight = true;
    try {
      const value = await this.options.poll(scope, controller.signal);
      if (generation === this.generation && !controller.signal.aborted) {
        await this.options.apply(value, scope);
        if (this.options.isRetryable?.(value)) throw new Error("retryable_poll_result");
        this.failures = 0;
      }
    } catch {
      if (generation === this.generation && !controller.signal.aborted) {
        this.failures++;
        this.options.onFailure?.(this.failures);
      }
    } finally {
      this.inFlight = false;
      this.controller = null;
      if (this.scope && this.visible) {
        const base = this.failures ? Math.min(30_000, 1_000 * 2 ** Math.min(this.failures, 5)) : this.active ? 1_000 : 15_000;
        const random = Math.max(0, Math.min(1, this.options.random?.() ?? Math.random()));
        this.schedule(generation !== this.generation ? 0 : Math.min(30_000, Math.round(base * (0.9 + random * 0.2))));
      }
    }
  }
}
