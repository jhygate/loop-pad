import {
  PadStateMachine,
  PadState,
  PadEvent,
  ControllerPadEvent,
} from "./pad-state-machine.js";
import { PadSettings, DEFAULT_PAD_SETTINGS } from "./pad-settings.js";
import { PadViewHandler } from "./pad-view.js";
import { DOUBLE_CLICK_TIME, HOLD_TO_DELETE_TIME } from "./pad-constants.js";
import { PadAudioHandler } from "./pad-audio.js";
import { PadStorage } from "./pad-storage.js";
import { logger, PadLog } from "../debug/logger.js";
import { GlobalState } from "../script.js";

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
};

export class Pad {
  private stateMachine: PadStateMachine;
  private viewHandler: PadViewHandler;
  private audioHandler: PadAudioHandler;
  private storage: PadStorage;

  private settings: PadSettings;
  private htmlElement: HTMLElement;

  private holdTimerId: number;
  private syncTimerId: number;
  private held: boolean;
  private clickCount: number;

  private globalState: GlobalState;
  private allPads: Pad[];
  private key: string;
  private index: number;

  private log: PadLog;

  constructor(
    buttonId: string,
    stream: MediaStream,
    audioContext: AudioContext,
    globalState: GlobalState,
    allPads: Pad[],
    key: string,
    index: number
  ) {
    this.index = index;
    this.key = key;
    this.log = logger.scoped(index);

    this.stateMachine = new PadStateMachine();
    this.settings = { ...DEFAULT_PAD_SETTINGS };

    this.htmlElement = document.getElementById(buttonId);
    this.viewHandler = new PadViewHandler(this.htmlElement);
    this.audioHandler = new PadAudioHandler(
      stream, audioContext, this.htmlElement, this.settings, this.log
    );
    this.storage = new PadStorage(index);

    this.holdTimerId = -1;
    this.syncTimerId = -1;
    this.held = false;
    this.clickCount = 0;

    this.globalState = globalState;
    this.allPads = allPads;

    this.log.state(`pad created (key: "${key}")`);

    this.bindUI();
    this.setupListeners();
    this.loadFromStorage();
  }

  // ── Public getters ──────────────────────────────────────────────────────────

  public get state(): PadState {
    return this.stateMachine.state;
  }

  public get looping(): boolean {
    return this.stateMachine.looping;
  }

  // Seconds until current loop ends — only non-null when playing AND looping.
  // Other pads query this to calculate sync timer delays.
  public get timeUntilLoopEnd(): number | null {
    if (this.state !== "playing" || !this.looping) return null;
    return this.audioHandler.timeUntilEnd;
  }

  // ── UI binding ──────────────────────────────────────────────────────────────

  private bindUI() {
    this.htmlElement.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.onPointerDown();
    });

    this.htmlElement.addEventListener("pointerup", (e) => {
      e.preventDefault();
      this.onPointerUp();
    });

    this.htmlElement.addEventListener("pointercancel", () => {
      this.log.input("pointercancel — cancelling hold");
      this.cancelHold();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === this.key && !e.repeat) this.onPointerDown();
    });

    document.addEventListener("keyup", (e) => {
      if (e.key.toLowerCase() === this.key) this.onPointerUp();
    });
  }

  private onPointerDown() {
    this.clickCount += 1;
    this.log.input(`pointerdown (clicks so far: ${this.clickCount})`);

    // Reset click count after the double-click window expires
    setTimeout(() => { this.clickCount = 0; }, DOUBLE_CLICK_TIME);

    this.viewHandler.startHoldAnimation();

    this.holdTimerId = setTimeout(() => {
      this.log.input(`hold threshold reached (${HOLD_TO_DELETE_TIME}ms) → held`);
      this.held = true;
      this.viewHandler.stopHoldAnimation();
      this.transitionState("held");
    }, HOLD_TO_DELETE_TIME) as unknown as number;
  }

  private onPointerUp() {
    if (this.held) {
      this.held = false;
      this.log.input("pointerup after hold — ignoring");
      return;
    }

    this.cancelHold();

    if (this.globalState.settingsPressed) {
      this.log.input("pointerup → opening pad settings modal");
      document.dispatchEvent(new CustomEvent("open-pad-settings", {
        detail: {
          settings: this.settings,
          onSave: (updated: PadSettings) => {
            this.log.settings(`settings saved — loopSync:${updated.loopSync} loopable:${updated.loopable} trim:${updated.trimAudio}`);
            this.settings = updated;
            this.audioHandler.updateSettings(updated);
            this.storage.save(updated, this.audioHandler.audioBuffer);
          },
        },
      }));
      return;
    }

    if (this.clickCount === 1) {
      this.log.input("pointerup → press");
      this.transitionState("press");
    } else if (this.clickCount >= 2) {
      this.log.input(`pointerup → double-press (${this.clickCount} clicks)`);
      this.transitionState("double-press");
    }
  }

  private cancelHold() {
    clearTimeout(this.holdTimerId);
    this.viewHandler.stopHoldAnimation();
  }

  // ── Internal event listeners ────────────────────────────────────────────────

  private setupListeners() {
    // Audio handler fires this when a recording finishes async processing
    this.htmlElement.addEventListener("pad-recording-ready", () => {
      this.log.audio("pad-recording-ready received — saving");
      this.storage.save(this.settings, this.audioHandler.audioBuffer);
      this.render();
    });

    // Audio handler fires this when a playback loop iteration ends
    this.htmlElement.addEventListener("pad-update", (e: Event) => {
      const event = (e as CustomEvent<ControllerPadEvent>).detail;
      this.log.audio(`pad-update received: "${event}"`);
      this.transitionState(event);
    });

    document.addEventListener("global-state-update", () => {
      this.render();
    });
  }

  // ── State transitions ───────────────────────────────────────────────────────

  private transitionState(event: PadEvent) {
    clearTimeout(this.syncTimerId);

    const ctx: PadContext = {
      settingsPressed: this.globalState.settingsPressed,
      settings: this.settings,
    };

    const prevState = this.state;
    const prevLooping = this.looping;
    this.stateMachine.transition(event, ctx);
    const nextState = this.state;
    const nextLooping = this.looping;

    const loopChange = prevLooping !== nextLooping
      ? ` [looping: ${prevLooping} → ${nextLooping}]`
      : nextLooping ? " [looping]" : "";

    this.log.state(`"${event}": ${prevState} → ${nextState}${loopChange}`);

    this.audioHandler.handleStateChange(nextState);

    if (nextState === "empty") {
      this.storage.save(this.settings, null);
    }
    // "recorded" persistence is deferred — handled by pad-recording-ready event
    // because the audio buffer isn't ready until the async onstop callback fires

    this.handleWaitingState();
    this.render();
  }

  // If we just entered a waiting-* state, decide whether to wait for a sync
  // loop boundary or fire the ready event immediately.
  private handleWaitingState() {
    const waitingMap: Record<string, { readyEvent: ControllerPadEvent; settingEnabled: boolean }> = {
      "waiting-to-record": {
        readyEvent: "ready-to-record",
        settingEnabled: this.settings.loopSync && this.settings.recordSyncStart,
      },
      "waiting-to-end-recording": {
        readyEvent: "ready-to-end-recording",
        settingEnabled: this.settings.loopSync && this.settings.recordSyncEnd,
      },
      "waiting-to-play": {
        readyEvent: "ready-to-play",
        settingEnabled: this.settings.loopSync && this.settings.playSyncStart,
      },
    };

    const entry = waitingMap[this.state];
    if (!entry) return;

    const { readyEvent, settingEnabled } = entry;

    if (!settingEnabled) {
      this.log.sync(`${this.state}: sync setting off — firing ${readyEvent} immediately`);
      this.transitionState(readyEvent);
      return;
    }

    // Poll all other pads for their loop positions
    const times = this.allPads
      .filter(p => p !== this)
      .map(p => p.timeUntilLoopEnd)
      .filter((t): t is number => t !== null);

    if (times.length === 0) {
      this.log.sync(`${this.state}: no looping pads — firing ${readyEvent} immediately`);
      this.transitionState(readyEvent);
      return;
    }

    const soonestMs = Math.min(...times) * 1000;
    this.log.sync(`${this.state}: waiting ${soonestMs.toFixed(0)}ms for nearest loop end → ${readyEvent}`);

    this.syncTimerId = setTimeout(() => {
      this.log.sync(`sync timer fired → ${readyEvent}`);
      this.transitionState(readyEvent);
    }, soonestMs) as unknown as number;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  public render() {
    this.viewHandler.render(
      this.state,
      this.looping,
      this.globalState.settingsPressed,
      this.index + 1  // 1-indexed display number
    );
  }

  // ── Storage ─────────────────────────────────────────────────────────────────

  private async loadFromStorage() {
    const saved = await this.storage.load(this.audioHandler.ctx);
    if (!saved) {
      this.render();
      return;
    }

    this.settings = saved.settings;
    this.audioHandler.updateSettings(saved.settings);

    if (saved.audioBuffer) {
      this.audioHandler.audioBuffer = saved.audioBuffer;
      // Manually set state machine to "recorded" to match the restored audio
      this.stateMachine.state = "recorded";
      this.log.storage("restored to recorded state with audio");
    }

    this.render();
  }

  public async exportData() {
    return this.storage.exportData();
  }

  public async importData(data: any) {
    await this.storage.importData(data);
    await this.loadFromStorage();
  }

  public async clearStorage() {
    await this.storage.clear();
  }
}
