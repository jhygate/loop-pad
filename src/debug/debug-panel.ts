// ─── Debug Panel ──────────────────────────────────────────────────────────────
//
// Self-contained debug UI. Injects its own styles, creates its own DOM.
// Toggle with backtick (`) or the DBG button fixed to the bottom-right corner.
//
// Usage in script.ts:
//   import { DebugPanel } from "./debug/debug-panel.js";
//   new DebugPanel();   // enables the logger and mounts the panel
//
// ─────────────────────────────────────────────────────────────────────────────

import { logger, LogChannel, LogEntry, ALL_CHANNELS } from "./logger.js";

// ── Colour palette (one per channel) ─────────────────────────────────────────

const CHANNEL_COLORS: Record<LogChannel, string> = {
  state:    "#4a9eff",
  input:    "#ff8c42",
  audio:    "#a855f7",
  storage:  "#22c55e",
  sync:     "#eab308",
  settings: "#ec4899",
};

const CHANNEL_LABELS: Record<LogChannel, string> = {
  state:    "STATE",
  input:    "INPUT",
  audio:    "AUDIO",
  storage:  "STORE",
  sync:     "SYNC ",
  settings: "CONF ",
};

// ─────────────────────────────────────────────────────────────────────────────

export class DebugPanel {
  private root: HTMLElement;
  private panel: HTMLElement;
  private logList: HTMLElement;
  private isOpen = false;
  private activeChannels = new Set<LogChannel>(ALL_CHANNELS);
  private autoScroll = true;

  constructor() {
    logger.enable();
    this.injectStyles();
    this.root = this.buildDOM();
    document.body.appendChild(this.root);

    this.panel   = this.root.querySelector(".dbg-panel")!;
    this.logList = this.root.querySelector(".dbg-log")!;

    this.bindEvents();

    // Replay any entries already captured before the panel mounted
    logger.getEntries().forEach(e => this.appendRow(e));

    // Subscribe to future entries
    logger.onEntry(entry => {
      if (entry === null) {
        this.logList.innerHTML = "";
      } else {
        this.appendRow(entry);
      }
    });

    logger.log("state", null, "debug panel ready — press ` to toggle");
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildDOM(): HTMLElement {
    const root = document.createElement("div");
    root.className = "dbg-root";
    root.innerHTML = `
      <button class="dbg-toggle" title="Toggle debug panel (\`)">DBG</button>

      <div class="dbg-panel">
        <div class="dbg-header">
          <span class="dbg-title">Debug Log</span>
          <div class="dbg-header-actions">
            <button class="dbg-btn dbg-clear-btn">Clear</button>
            <button class="dbg-btn dbg-close-btn">×</button>
          </div>
        </div>

        <div class="dbg-filters">
          ${ALL_CHANNELS.map(ch => `
            <label class="dbg-filter-label" data-channel="${ch}">
              <input type="checkbox" class="dbg-filter-check" data-channel="${ch}" checked>
              <span class="dbg-filter-dot" style="background:${CHANNEL_COLORS[ch]}"></span>
              <span class="dbg-filter-name">${CHANNEL_LABELS[ch].trim()}</span>
            </label>
          `).join("")}
        </div>

        <div class="dbg-log-wrapper">
          <div class="dbg-log" role="log" aria-live="polite"></div>
        </div>

        <div class="dbg-footer">
          <span class="dbg-entry-count">0 entries</span>
          <label class="dbg-autoscroll-label">
            <input type="checkbox" class="dbg-autoscroll-check" checked>
            Auto-scroll
          </label>
        </div>
      </div>
    `;
    return root;
  }

  // ── Event wiring ────────────────────────────────────────────────────────────

  private bindEvents() {
    // Toggle button
    this.root.querySelector(".dbg-toggle")!.addEventListener("click", () => this.toggle());

    // Close button
    this.root.querySelector(".dbg-close-btn")!.addEventListener("click", () => this.close());

    // Clear button
    this.root.querySelector(".dbg-clear-btn")!.addEventListener("click", () => logger.clear());

    // Channel filter checkboxes
    this.root.querySelectorAll<HTMLInputElement>(".dbg-filter-check").forEach(cb => {
      cb.addEventListener("change", () => {
        const ch = cb.dataset.channel as LogChannel;
        if (cb.checked) {
          this.activeChannels.add(ch);
        } else {
          this.activeChannels.delete(ch);
        }
        this.refilter();
      });
    });

    // Auto-scroll toggle
    this.root.querySelector<HTMLInputElement>(".dbg-autoscroll-check")!.addEventListener("change", e => {
      this.autoScroll = (e.target as HTMLInputElement).checked;
    });

    // Pause auto-scroll when user manually scrolls up
    this.root.querySelector(".dbg-log-wrapper")!.addEventListener("scroll", e => {
      const el = e.target as HTMLElement;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (!atBottom) {
        this.autoScroll = false;
        (this.root.querySelector<HTMLInputElement>(".dbg-autoscroll-check")!).checked = false;
      }
    });

    // Keyboard shortcut — backtick
    document.addEventListener("keydown", e => {
      if (e.key === "\`" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  // ── Panel show / hide ───────────────────────────────────────────────────────

  private toggle() {
    this.isOpen ? this.close() : this.open();
  }

  private open() {
    this.isOpen = true;
    this.panel.classList.add("dbg-panel--open");
    this.scrollToBottom();
  }

  private close() {
    this.isOpen = false;
    this.panel.classList.remove("dbg-panel--open");
  }

  // ── Log rendering ───────────────────────────────────────────────────────────

  private appendRow(entry: LogEntry) {
    const hidden = !this.activeChannels.has(entry.channel);
    const row = this.buildRow(entry, hidden);
    this.logList.appendChild(row);
    this.updateCount();
    if (this.autoScroll && this.isOpen) this.scrollToBottom();
  }

  private buildRow(entry: LogEntry, hidden: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "dbg-row";
    row.dataset.channel = entry.channel;
    if (hidden) row.classList.add("dbg-row--hidden");

    const elapsed = (entry.elapsed / 1000).toFixed(3);
    const padLabel = entry.padIndex !== null ? `P${entry.padIndex + 1}` : "APP";
    const color = CHANNEL_COLORS[entry.channel];
    const label = CHANNEL_LABELS[entry.channel];

    row.innerHTML = `
      <span class="dbg-row-time">+${elapsed}s</span>
      <span class="dbg-row-badge" style="background:${color}">${label}</span>
      <span class="dbg-row-pad">${padLabel}</span>
      <span class="dbg-row-msg">${escapeHtml(entry.message)}</span>
    `;
    return row;
  }

  // Re-apply channel filter without clearing the log
  private refilter() {
    this.logList.querySelectorAll<HTMLElement>(".dbg-row").forEach(row => {
      const ch = row.dataset.channel as LogChannel;
      row.classList.toggle("dbg-row--hidden", !this.activeChannels.has(ch));
    });
    this.updateCount();
  }

  private updateCount() {
    const total = this.logList.querySelectorAll(".dbg-row").length;
    const visible = this.logList.querySelectorAll(".dbg-row:not(.dbg-row--hidden)").length;
    const countEl = this.root.querySelector(".dbg-entry-count")!;
    countEl.textContent = total === visible
      ? `${total} entries`
      : `${visible} / ${total} entries`;
  }

  private scrollToBottom() {
    const wrapper = this.root.querySelector(".dbg-log-wrapper") as HTMLElement;
    wrapper.scrollTop = wrapper.scrollHeight;
  }

  // ── Styles (self-contained, no dependency on styles.css) ───────────────────

  private injectStyles() {
    if (document.getElementById("dbg-styles")) return;
    const style = document.createElement("style");
    style.id = "dbg-styles";
    style.textContent = `
      /* Root wrapper — fixed bottom-right */
      .dbg-root {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: "Space Grotesk", ui-monospace, monospace;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        pointer-events: none;
      }

      .dbg-root * { box-sizing: border-box; }

      /* Toggle button — always visible */
      .dbg-toggle {
        pointer-events: all;
        padding: 6px 12px;
        background: #0a0a0a;
        color: #66ff99;
        border: 2px solid #66ff99;
        font-family: inherit;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 2px;
        cursor: pointer;
        box-shadow: 3px 3px 0 #66ff99;
        transition: transform 0.1s, box-shadow 0.1s;
        user-select: none;
      }
      .dbg-toggle:hover {
        transform: translate(-1px, -1px);
        box-shadow: 4px 4px 0 #66ff99;
      }
      .dbg-toggle:active {
        transform: translate(1px, 1px);
        box-shadow: 2px 2px 0 #66ff99;
      }

      /* Panel — hidden by default */
      .dbg-panel {
        pointer-events: all;
        width: 480px;
        background: #0a0a0a;
        border: 3px solid #66ff99;
        box-shadow: 6px 6px 0 #66ff99;
        display: none;
        flex-direction: column;
        max-height: 480px;
      }
      .dbg-panel--open {
        display: flex;
      }

      /* Header */
      .dbg-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 2px solid #1a1a1a;
        gap: 8px;
        flex-shrink: 0;
      }
      .dbg-title {
        color: #66ff99;
        font-weight: 900;
        font-size: 13px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .dbg-header-actions {
        display: flex;
        gap: 6px;
      }
      .dbg-btn {
        background: transparent;
        border: 1px solid #444;
        color: #aaa;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        cursor: pointer;
        transition: border-color 0.1s, color 0.1s;
      }
      .dbg-btn:hover { border-color: #66ff99; color: #66ff99; }
      .dbg-close-btn { font-size: 16px; padding: 0 8px; }

      /* Channel filters */
      .dbg-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 2px solid #1a1a1a;
        flex-shrink: 0;
      }
      .dbg-filter-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        user-select: none;
        opacity: 0.5;
        transition: opacity 0.1s;
      }
      .dbg-filter-label:has(.dbg-filter-check:checked) { opacity: 1; }
      .dbg-filter-check { display: none; }
      .dbg-filter-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dbg-filter-name {
        color: #ccc;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Log area */
      .dbg-log-wrapper {
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }
      .dbg-log {
        padding: 4px 0;
      }

      /* Individual log rows */
      .dbg-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 2px 12px;
        border-bottom: 1px solid #111;
        min-height: 22px;
      }
      .dbg-row--hidden { display: none; }
      .dbg-row:hover { background: #111; }

      .dbg-row-time {
        color: #555;
        font-size: 10px;
        white-space: nowrap;
        flex-shrink: 0;
        width: 60px;
        font-variant-numeric: tabular-nums;
      }
      .dbg-row-badge {
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.5px;
        padding: 1px 5px;
        color: #000;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .dbg-row-pad {
        color: #666;
        font-size: 10px;
        font-weight: 700;
        flex-shrink: 0;
        width: 30px;
        text-align: right;
      }
      .dbg-row-msg {
        color: #ddd;
        font-size: 11px;
        word-break: break-all;
        flex: 1;
      }

      /* Footer */
      .dbg-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 12px;
        border-top: 2px solid #1a1a1a;
        flex-shrink: 0;
      }
      .dbg-entry-count {
        color: #555;
        font-size: 10px;
      }
      .dbg-autoscroll-label {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #555;
        font-size: 10px;
        cursor: pointer;
        user-select: none;
      }
      .dbg-autoscroll-label:has(.dbg-autoscroll-check:checked) { color: #66ff99; }
      .dbg-autoscroll-check { accent-color: #66ff99; cursor: pointer; }

      /* Scrollbar */
      .dbg-log-wrapper::-webkit-scrollbar { width: 6px; }
      .dbg-log-wrapper::-webkit-scrollbar-track { background: #111; }
      .dbg-log-wrapper::-webkit-scrollbar-thumb { background: #333; }
      .dbg-log-wrapper::-webkit-scrollbar-thumb:hover { background: #555; }
    `;
    document.head.appendChild(style);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
