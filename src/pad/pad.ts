import {
  PadStateMachine,
  PadState,
  PadEvent,
  ControllerPadEvent
} from "@/pad/pad-state-machine.js";
import { settingsPressed, selectedPad } from "@/settings/settings-modal.js";
import { effect } from "@/signals.js";
import { PadViewHandler } from "@/pad/pad-view.js";
import {
  DOUBLE_CLICK_TIME,
  HOLD_TO_DELETE_TIME,
} from "@/pad/pad-constants.js";
import { PadAudioHandler } from "@/pad/pad-audio.js";


export type PadSettings = {
  recordSyncStart: boolean;
  recordSyncEnd: boolean;
  playingPressBehavior: "stop" | "restart";
  playSyncStart: boolean;
  loopable: boolean;
  audioThreshold: number;
  thresholdStart: boolean;
  thresholdEnd: boolean;
}

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
};



export class Pad {
  private stateMachine: PadStateMachine;
  private viewHandler: PadViewHandler;
  private audioHandler: PadAudioHandler;

  private settings: PadSettings;

  private htmlElement: HTMLElement;

  private holdTimerId: number;
  private holdStartTime: number | null;

  private clickCount: number;


  public readonly id: string;

  constructor(id: string, stream: MediaStream, audioContext: AudioContext) {
    this.id = id;
    this.stateMachine = new PadStateMachine();

    this.htmlElement = document.getElementById(id);
    this.viewHandler = new PadViewHandler(this.htmlElement);

    this.audioHandler = new PadAudioHandler(stream, audioContext, this.htmlElement, () => this.settings);

    this.holdTimerId = -1;
    this.clickCount = 0;
    this.holdStartTime = null;

    this.settings = {
      recordSyncStart: false,
      recordSyncEnd: false,
      playSyncStart: false,
      playingPressBehavior: "stop",
      loopable: true,
      audioThreshold: 0,
      thresholdStart: false,
      thresholdEnd: false,
    }

    this.bindUI();
    this.setupListeners();
    this.render();
  }

  public get state(): PadState {
    return this.stateMachine.state;
  }

  public get looping(): boolean {
    return this.stateMachine.looping;
  }

  public getSettings(): PadSettings {
    return this.settings;
  }

  public setSettings(updated: PadSettings) {
    this.settings = updated;
    if (!updated.loopable && this.stateMachine.looping) {
      this.stateMachine.looping = false;
    }
    this.render();
  }


  private bindUI() {
    this.htmlElement.addEventListener("pointerdown", () => {
      this.clickCount += 1;
      this.holdStartTime = performance.now();
      this.render();

      setTimeout(() => {
        this.clickCount = 0;
      }, DOUBLE_CLICK_TIME);

      this.holdTimerId = setTimeout(() => {
        this.transitionState("held");
      }, HOLD_TO_DELETE_TIME);
    });

    this.htmlElement.addEventListener("pointerup", () => {
      const wasHeld = this.holdStartTime !== null
        && performance.now() - this.holdStartTime >= HOLD_TO_DELETE_TIME;
      this.holdStartTime = null;
      clearTimeout(this.holdTimerId);
      this.render();

      if (wasHeld) return;

      if (settingsPressed.value === true) {
        selectedPad.value = this.id
        return;  // don't fall through to normal press logic
      }
      if (this.clickCount == 1) {
        this.transitionState("press");
      } else if (this.clickCount == 2) {
        this.transitionState("double-press");
      }
    });

    this.htmlElement.addEventListener("pointercancel", () => {
      this.holdStartTime = null;
      clearTimeout(this.holdTimerId);
      this.render();
    });
  }

  private setupListeners() {
    this.htmlElement.addEventListener('pad-update', (e: Event) => {
      const customEvent = e as CustomEvent<ControllerPadEvent>;
      this.transitionState(customEvent.detail);
    });

    effect(() => {
      this.render()
    })
  }

  private transitionState(event: PadEvent) {
    const padContext: PadContext = {
      settingsPressed: settingsPressed.value,
      settings: this.settings,
    };

    this.stateMachine.transition(event, padContext);

    if (event !== "double-press") {
      this.audioHandler.handleStateChange(this.state);
    }
    this.render();
  }

  public render() {
    this.viewHandler.render({
      padNumber: 1,
      state: this.state,
      looping: this.looping,
      settingsPressed: settingsPressed.value,
      holdStartTime: this.holdStartTime,
      settings: this.settings,
      audioLength: this.audioHandler.recordingDuration,
      audioPlayed: this.audioHandler.playbackElapsed,
    });
  }
}
