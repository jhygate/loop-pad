import {
  PadStateMachine,
  PadState,
  PadEvent,
  UserPadEvent,
} from "@/pad/pad-state-machine.js";
import { settingsPressed, selectedPad } from "@/settings/settings-modal.js";
import { effect } from "@/signals.js";
import { PadViewHandler } from "@/pad/pad-view.js";
import { PadAudioHandler } from "@/pad/pad-audio.js";
import { PadUserInputHandler } from "@/pad/pad-user-input.js";


export type PadSettings = {
  recordSyncStart: boolean;
  recordSyncEnd: boolean;
  playingPressBehavior: "stop" | "restart";
  playSyncStart: boolean;
  loopable: boolean;
  audioThreshold: number;
  thresholdStart: boolean;
  thresholdEnd: boolean;
  volume: number;
}

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
};



const DEFAULT_SETTINGS: PadSettings = {
  recordSyncStart: false,
  recordSyncEnd: false,
  playSyncStart: false,
  playingPressBehavior: "stop",
  loopable: true,
  audioThreshold: 0,
  thresholdStart: false,
  thresholdEnd: false,
  volume: 1,
};

export class Pad {
  public readonly id: number;
  private readonly htmlElement: HTMLElement;
  private readonly stateMachine = new PadStateMachine();
  private readonly viewHandler: PadViewHandler;
  private readonly audioHandler: PadAudioHandler;
  private readonly inputHandler: PadUserInputHandler;

  private settings: PadSettings = { ...DEFAULT_SETTINGS };

  constructor(id: number, stream: MediaStream, audioContext: AudioContext) {
    this.id = id;
    this.htmlElement = document.getElementById(`pad${id}`);
    this.viewHandler = new PadViewHandler(this.htmlElement);
    this.audioHandler = new PadAudioHandler(
      stream,
      audioContext,
      () => this.settings,
      (event) => this.transitionState(event),
    );
    this.inputHandler = new PadUserInputHandler(
      this.htmlElement,
      (gesture) => this.handleGesture(gesture),
      () => this.render(),
    );

    effect(() => this.render());
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
    if (!updated.loopable) this.stateMachine.disableLooping();
    this.audioHandler.setVolume(updated.volume);
    this.render();
  }

  public get maxVolume(): number {
    return this.audioHandler.maxGain;
  }


  private handleGesture(gesture: UserPadEvent) {
    if (settingsPressed.value && gesture !== "held") {
      selectedPad.value = this.id;
      return;
    }
    this.transitionState(gesture);
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
      padNumber: this.id,
      state: this.state,
      looping: this.looping,
      settingsPressed: settingsPressed.value,
      holdStartTime: this.inputHandler.holdStartTime,
      settings: this.settings,
      audioLength: this.audioHandler.recordingDuration,
      audioPlayed: this.audioHandler.playbackElapsed,
    });
  }
}
