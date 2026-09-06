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
  type LoopReference,
  type LoopReferenceSource,
  type SyncDecision,
  type SyncEffects,
} from "@/pad/pad-sync.js";
import type { Metronome } from "@/metronome/metronome.js";
import { savePadState, saveRecording } from "@/persistence.js";


export type PadSettings = {
  sync: boolean;
  recordStartBackPct: number;
  recordEndBackPct: number;
  playStartBackPct: number;
  playingPressBehavior: "stop" | "restart";
  loopable: boolean;
  audioThreshold: number;
  thresholdStart: boolean;
  thresholdEnd: boolean;
  volume: number;
  recordMic: boolean;
  inputDeviceId: string;
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
  sync: true,
  recordStartBackPct: 50,
  recordEndBackPct: 50,
  playStartBackPct: 50,
  playingPressBehavior: "stop",
  loopable: true,
  audioThreshold: 0,
  thresholdStart: false,
  thresholdEnd: false,
  volume: 1,
  recordMic: true,
  inputDeviceId: "",
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
    beginCapture: (capture) => this.audioHandler.beginCapture(capture),
    endCapture: (endBoundary) => this.audioHandler.endCapture(endBoundary),
    schedulePlayback: (boundaryTime) => this.audioHandler.schedulePlayback(boundaryTime),
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
      () => this.referenceSources(),
      () => this.audioHandler.activeCapture,
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
    this.audioHandler.setLooping(this.looping);
    this.audioHandler.setVolume(updated.volume);
    this.audioHandler.prepareInputDevice(updated.inputDeviceId);
    this.persistState();
    this.render();
  }

  public restore(settings: PadSettings, looping: boolean, buffer: AudioBuffer | null) {
    this.setSettings(settings);
    if (!looping) this.stateMachine.disableLooping();
    this.audioHandler.setLooping(this.looping);
    if (buffer && this.state === "empty") {
      this.audioHandler.setBuffer(buffer);
      this.transitionState("recording-loaded");
    }
  }

  private persistState() {
    savePadState(this.id, { settings: this.settings, looping: this.looping });
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

    const prevState = this.state;
    const prevLooping = this.looping;
    this.stateMachine.transition(event, padContext);
    this.stateSignal.value = this.state;
    this.audioHandler.setLooping(this.looping);

    if (this.state !== prevState) this.clearPendingSyncTimer();
    plan.apply(this.syncEffects);

    if (event !== "double-press") {
      this.audioHandler.handleStateChange(this.state);
    }

    if (prevState === "processing-recording" && this.state === "recorded") {
      void saveRecording(this.id, this.audioHandler.buffer);
    }
    if (this.state === "empty" && prevState !== "empty") {
      void saveRecording(this.id, null);
    }
    if (this.looping !== prevLooping) this.persistState();

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

  private referenceSources(): LoopReferenceSource[] {
    const sources: LoopReferenceSource[] = [];
    if (this.metronome) sources.push(this.metronome);
    for (const peer of Object.values(this.peers)) {
      if (peer !== this) sources.push(peer);
    }
    return sources;
  }

  public getLoopReference(): LoopReference | null {
    if (this.state !== "playing" || !this.looping || !this.settings.sync) return null;
    return this.audioHandler.loopReference;
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
      playbackStart: this.audioHandler.playbackStart,
    });
  }
}
