import {
  PadStateMachine,
  PadState,
  PadEvent,
  UserPadEvent,
  ControllerPadEvent,
} from "@/pad/pad-state-machine.js";
import { settingsPressed, selectedPad } from "@/settings/settings-modal.js";
import { effect, signal } from "@/signals.js";
import { PadViewHandler } from "@/pad/pad-view.js";
import { PadAudioHandler } from "@/pad/pad-audio.js";
import { PadUserInputHandler } from "@/pad/pad-user-input.js";
import {
  PadSyncPlanner,
  type LoopBoundarySource,
  type SyncDecision,
  type SyncEffects,
} from "@/pad/pad-sync.js";
import type { Metronome } from "@/metronome/metronome.js";


export type PadSettings = {
  recordSyncStart: boolean;
  recordSyncStartThresholdMs: number;
  recordSyncEnd: boolean;
  recordSyncEndThresholdMs: number;
  playingPressBehavior: "stop" | "restart";
  playSyncStart: boolean;
  playSyncStartThresholdMs: number;
  loopable: boolean;
  audioThreshold: number;
  thresholdStart: boolean;
  thresholdEnd: boolean;
  volume: number;
  recordMic: boolean;
  recordSources: number[];
}

export const RECORDING_STATES: PadState[] = [
  "waiting-to-record",
  "recording",
  "waiting-to-end-recording",
  "processing-recording",
];

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
  syncDecision: SyncDecision;
};



const DEFAULT_SETTINGS: PadSettings = {
  recordSyncStart: false,
  recordSyncStartThresholdMs: 150,
  recordSyncEnd: false,
  recordSyncEndThresholdMs: 150,
  playSyncStart: false,
  playSyncStartThresholdMs: 150,
  playingPressBehavior: "stop",
  loopable: true,
  audioThreshold: 0,
  thresholdStart: false,
  thresholdEnd: false,
  volume: 1,
  recordMic: true,
  recordSources: [],
};

export class Pad {
  public readonly id: number;
  private readonly htmlElement: HTMLElement;
  private readonly stateMachine = new PadStateMachine();
  private readonly viewHandler: PadViewHandler;
  private readonly audioHandler: PadAudioHandler;
  private readonly inputHandler: PadUserInputHandler;
  private readonly syncPlanner: PadSyncPlanner;

  private readonly syncEffects: SyncEffects = {
    scheduleReady: (event, delayMs) => this.scheduleReady(event, delayMs),
    adjustRecording: (adjustment) => this.audioHandler.setRecordingAdjustment(adjustment),
    offsetPlayback: (offsetMs) => this.audioHandler.setPlaybackOffsetMs(offsetMs),
  };

  private settings: PadSettings = { ...DEFAULT_SETTINGS };
  private pendingSyncTimerId = -1;

  public readonly stateSignal = signal<PadState>("empty");

  constructor(
    id: number,
    stream: MediaStream,
    audioContext: AudioContext,
    private readonly peers: Record<number, Pad>,
    private readonly metronome: Metronome | null,
  ) {
    this.id = id;
    this.htmlElement = document.getElementById(`pad${id}`);
    this.viewHandler = new PadViewHandler(this.htmlElement);
    this.audioHandler = new PadAudioHandler(
      stream,
      audioContext,
      () => this.settings,
      (event) => this.transitionState(event),
      (peerId) => this.peers[peerId]?.getOutputTap() ?? null,
      () => this.render(),
    );
    this.inputHandler = new PadUserInputHandler(
      this.htmlElement,
      (gesture) => this.handleGesture(gesture),
      () => this.render(),
    );

    this.syncPlanner = new PadSyncPlanner(
      () => this.settings,
      () => this.audioHandler.now(),
      () => this.boundarySources(),
    );

    effect(() => this.render());
    this.render();
  }

  public getOutputTap(): AudioNode {
    return this.audioHandler.outputTap;
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
    const plan = this.syncPlanner.planFor(this.state, event);

    const padContext: PadContext = {
      settingsPressed: settingsPressed.value,
      settings: this.settings,
      syncDecision: plan.decision,
    };

    this.stateMachine.transition(event, padContext);
    this.stateSignal.value = this.state;

    this.clearPendingSyncTimer();
    plan.apply(this.syncEffects);

    if (event !== "double-press") {
      this.audioHandler.handleStateChange(this.state);
    }
    this.render();
  }

  private scheduleReady(event: ControllerPadEvent, delayMs: number) {
    this.pendingSyncTimerId = setTimeout(() => {
      this.pendingSyncTimerId = -1;
      this.transitionState(event);
    }, Math.max(0, delayMs));
  }

  private clearPendingSyncTimer() {
    if (this.pendingSyncTimerId !== -1) {
      clearTimeout(this.pendingSyncTimerId);
      this.pendingSyncTimerId = -1;
    }
  }

  private boundarySources(): LoopBoundarySource[] {
    const sources: LoopBoundarySource[] = Object.values(this.peers).filter(peer => peer !== this);
    if (this.metronome) sources.push(this.metronome);
    return sources;
  }

  public getNearestLoopBoundary(): number | null {
    if (this.state !== "playing" || !this.looping) return null;
    return this.audioHandler.nearestBoundary();
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
