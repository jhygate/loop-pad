// ─── Logger ───────────────────────────────────────────────────────────────────
//
// Singleton debug logger. Import `logger` anywhere and call:
//   logger.log("state", padIndex, "empty → recording")
//
// Or create a scoped helper for a pad (cleaner at call site):
//   const log = logger.scoped(2);
//   log.state("empty → recording");
//   log.input("pointerdown");
//
// The logger is a no-op until logger.enable() is called.
// ─────────────────────────────────────────────────────────────────────────────

export type LogChannel = "state" | "input" | "audio" | "storage" | "sync" | "settings";

export const ALL_CHANNELS: LogChannel[] = ["state", "input", "audio", "storage", "sync", "settings"];

export interface LogEntry {
  id: number;
  elapsed: number;          // ms since logger was created
  channel: LogChannel;
  padIndex: number | null;  // null = app-level (not pad-specific)
  message: string;
}

// The object returned by logger.scoped(padIndex) — one method per channel
export type PadLog = Record<LogChannel, (msg: string) => void>;

const MAX_ENTRIES = 500;

class Logger {
  private _enabled = false;
  private counter = 0;
  private startTime = performance.now();
  private entries: LogEntry[] = [];
  private listeners = new Set<(entry: LogEntry) => void>();

  enable() { this._enabled = true; }
  get isEnabled() { return this._enabled; }

  log(channel: LogChannel, padIndex: number | null, message: string) {
    if (!this._enabled) return;

    const entry: LogEntry = {
      id: ++this.counter,
      elapsed: performance.now() - this.startTime,
      channel,
      padIndex,
      message,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    this.listeners.forEach(fn => fn(entry));
  }

  // Returns a scoped helper bound to a specific pad index
  scoped(padIndex: number): PadLog {
    return Object.fromEntries(
      ALL_CHANNELS.map(ch => [ch, (msg: string) => this.log(ch, padIndex, msg)])
    ) as PadLog;
  }

  getEntries(): LogEntry[] { return [...this.entries]; }

  clear() {
    this.entries = [];
    this.listeners.forEach(fn => fn(null)); // null signals a clear
  }

  // Subscribe to new entries. Returns an unsubscribe function.
  onEntry(fn: (entry: LogEntry | null) => void): () => void {
    this.listeners.add(fn as any);
    return () => this.listeners.delete(fn as any);
  }
}

export const logger = new Logger();
