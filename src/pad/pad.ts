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

  constructor(
    buttonId: string,
    stream: MediaStream,
    audioContext: AudioContext,
    globalState: GlobalState,
    allPads: Pad[],
    key: string,
    index: number
  ) {
    this.stateMachine = new PadStateMachine();
    this.settings = { ...DEFAULT_PAD_SETTINGS };

    this.htmlElement = document.getElementById(buttonId);
    this.viewHandler = new PadViewHandler(this.htmlElement);
    this.audioHandler = new PadAudioHandler(stream, audioContext, this.htmlElement, this.settings);
    this.storage = new PadStorage(index);

    this.holdTimerId = -1;
    this.syncTimerId = -1;
    this.held = false;
    this.clickCount = 0;

    this.globalState = globalState;
    this.allPads = allPads;
    this.key = key;
    this.index = index;

    this.bindUI();
    this.setupListeners();
    this.loadFromStorage(audioContext);
  }

  // ── Public getters ──────────────────────────────────────────────────────────

  public get state(): PadState {
    return this.stateMachine.state;
  }

  public get looping(): boolean {
    return this.stateMachine.looping;
  }

  // Returns seconds until the current loop iteration ends.
  // Only non-null when this pad is playing AND looping — used by other pads for sync.
  public get timeUntilLoopEnd(): number | null {
    if (this.state !== "playing" || !this.looping) return null;
    return this.audioHandler.timeUntilEnd;
  }

  // ── UI binding ──────────────────────────────────────────────────────────────

  private bindUI() {
    // Pointer events
    this.htmlElement.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.onPointerDown();
    });

    this.htmlElement.addEventListener("pointerup", (e) => {
      e.preventDefault();
      this.onPointerUp();
    });

    this.htmlElement.addEventListener("pointercancel", () => {
      this.cancelHold();
    });

    // Keyboard events — bindings live in the Pad
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === this.key && !e.repeat) this.onPointerDown();
    });

    document.addEventListener("keyup", (e) => {
      if (e.key.toLowerCase() === this.key) this.onPointerUp();
    });
  }

  private onPointerDown() {
    this.clickCount += 1;
    // Reset click count after double-click window
    setTimeout(() => { this.clickCount = 0; }, DOUBLE_CLICK_TIME);

    this.viewHandler.startHoldAnimation();

    this.holdTimerId = setTimeout(() => {
      this.held = true;
      this.viewHandler.stopHoldAnimation();
      this.transitionState("held");
    }, HOLD_TO_DELETE_TIME) as unknown as number;
  }

  private onPointerUp() {
    if (this.held) {
      this.held = false;
      return;
    }

    this.cancelHold();

    if (this.globalState.settingsPressed) {
      document.dispatchEvent(new CustomEvent("open-pad-settings", {
        detail: {
          settings: this.settings,
          onSave: (updated: PadSettings) => {
            this.settings = updated;
            this.audioHandler.updateSettings(updated);
            // Persist new settings immediately (no audio change, just settings)
            this.storage.save(updated, this.audioHandler.audioBuffer);
          },
        },
      }));
      return;
    }

    if (this.clickCount === 1) {
      this.transitionState("press");
    } else if (this.clickCount >= 2) {
      this.transitionState("double-press");
    }
  }

  private cancelHold() {
    clearTimeout(this.holdTimerId);
    this.viewHandler.stopHoldAnimation();
  }

  // ── Internal event listeners ────────────────────────────────────────────────

  private setupListeners() {
    // Audio handler fires this when a recording has finished processing
    this.htmlElement.addEventListener("pad-recording-ready", () => {
      this.storage.save(this.settings, this.audioHandler.audioBuffer);
      this.render();
    });

    // Audio handler fires this when a loop playback iteration ends
    this.htmlElement.addEventListener("pad-update", (e: Event) => {
      const event = (e as CustomEvent<ControllerPadEvent>).detail;
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
    this.stateMachine.transition(event, ctx);
    const nextState = this.state;

    this.audioHandler.handleStateChange(nextState);

    // After a delete (→ empty) or recording stop (→ recorded), persist
    if (nextState === "empty") {
      this.storage.save(this.settings, null);
    }
    // Note: recorded state persistence is handled by pad-recording-ready event
    // because the audio buffer isn't ready synchronously when stopRecording() is called

    this.handleWaitingState();
    this.render();
  }

  // Checks if we've entered a waiting state and, if the relevant sync setting is
  // on and looping pads exist, sets a timer to fire the ready event at the soonest
  // loop boundary. Falls through to immediate fire if sync is off or no pads loop.
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
      this.transitionState(readyEvent);
      return;
    }

    // Find the soonest loop end among all OTHER looping pads
    const times = this.allPads
      .filter(p => p !== this)
      .map(p => p.timeUntilLoopEnd)
      .filter((t): t is number => t !== null);

    if (times.length === 0) {
      // No looping pads to sync to — fire immediately
      this.transitionState(readyEvent);
      return;
    }

    const soonestMs = Math.min(...times) * 1000;
    this.syncTimerId = setTimeout(
      () => this.transitionState(readyEvent),
      soonestMs
    ) as unknown as number;
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

  private async loadFromStorage(audioContext: AudioContext) {
    const saved = await this.storage.load(audioContext);
    if (!saved) {
      this.render();
      return;
    }

    this.settings = saved.settings;
    this.audioHandler.updateSettings(saved.settings);

    if (saved.audioBuffer) {
      this.audioHandler.audioBuffer = saved.audioBuffer;
      // Manually put the state machine into "recorded" to match the loaded audio
      this.stateMachine.state = "recorded";
    }

    this.render();
  }

  // Called by script.ts to get serialisable data for JSON export
  public async exportData() {
    return this.storage.exportData();
  }

  // Called by script.ts when importing a JSON project file
  public async importData(data: any) {
    await this.storage.importData(data);
    await this.loadFromStorage(this.audioHandler["audioContext"]);
  }

  // Called by script.ts for "Clear All Pads"
  public async clearStorage() {
    await this.storage.clear();
  }
}
