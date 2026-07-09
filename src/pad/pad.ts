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

export type SyncDecision = "immediate" | "wait";

type RecordSyncPlan = {
  decision: SyncDecision;
  waitMs: number;
  prependMs: number;
  appendMs: number;
  trimEndMs: number;
};

type PlaySyncPlan = {
  decision: SyncDecision;
  waitMs: number;
  offsetMs: number;
};

export const RECORDING_STATES: PadState[] = [
  "waiting-to-record",
  "recording",
  "waiting-to-end-recording",
  "processing-recording",
];

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
  syncStartDecision: SyncDecision;
  syncEndDecision: SyncDecision;
  playSyncDecision: SyncDecision;
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
    const startPlan = this.planRecordSyncStart();
    const endPlan = this.planRecordSyncEnd();
    const playPlan = this.planPlaySyncStart();

    const padContext: PadContext = {
      settingsPressed: settingsPressed.value,
      settings: this.settings,
      syncStartDecision: startPlan.decision,
      syncEndDecision: endPlan.decision,
      playSyncDecision: playPlan.decision,
    };

    const prevState = this.state;
    this.stateMachine.transition(event, padContext);
    const nextState = this.state;
    this.stateSignal.value = nextState;

    this.clearPendingSyncTimer();
    this.applySyncSideEffects(prevState, nextState, startPlan, endPlan, playPlan);

    if (event !== "double-press") {
      this.audioHandler.handleStateChange(nextState);
    }
    this.render();
  }

  private applySyncSideEffects(
    prevState: PadState,
    nextState: PadState,
    startPlan: RecordSyncPlan,
    endPlan: RecordSyncPlan,
    playPlan: PlaySyncPlan,
  ) {
    if (prevState === "empty" && nextState === "waiting-to-record") {
      this.scheduleReady("ready-to-record", startPlan.waitMs);
    }
    if (prevState === "empty" && nextState === "recording") {
      this.audioHandler.setRecordingAdjustment({
        prependMs: startPlan.prependMs,
        appendMs: 0,
        trimEndMs: 0,
      });
    }
    if (prevState === "recording" && nextState === "waiting-to-end-recording") {
      this.scheduleReady("ready-to-end-recording", endPlan.waitMs);
    }
    if (prevState === "recording" && nextState === "processing-recording") {
      this.audioHandler.setRecordingAdjustment({
        prependMs: 0,
        appendMs: endPlan.appendMs,
        trimEndMs: endPlan.trimEndMs,
      });
    }
    if (prevState === "recorded" && nextState === "waiting-to-play") {
      this.scheduleReady("ready-to-play", playPlan.waitMs);
    }
    if (prevState === "recorded" && nextState === "playing") {
      this.audioHandler.setPlaybackOffsetMs(playPlan.offsetMs);
    }
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

  private planRecordSyncStart(): RecordSyncPlan {
    const noop: RecordSyncPlan = { decision: "immediate", waitMs: 0, prependMs: 0, appendMs: 0, trimEndMs: 0 };
    if (!this.settings.recordSyncStart) return noop;
    const nearest = this.nearestPeerBoundary();
    if (nearest === null) return noop;

    const deltaMs = (nearest - this.audioHandler.now()) * 1000;
    if (Math.abs(deltaMs) > this.settings.recordSyncStartThresholdMs) return noop;

    return deltaMs > 0
      ? { ...noop, decision: "wait", waitMs: deltaMs }
      : { ...noop, prependMs: -deltaMs };
  }

  private planRecordSyncEnd(): RecordSyncPlan {
    const noop: RecordSyncPlan = { decision: "immediate", waitMs: 0, prependMs: 0, appendMs: 0, trimEndMs: 0 };
    if (!this.settings.recordSyncEnd) return noop;
    const nearest = this.nearestPeerBoundary();
    if (nearest === null) return noop;

    const deltaMs = (nearest - this.audioHandler.now()) * 1000;
    if (Math.abs(deltaMs) > this.settings.recordSyncEndThresholdMs) return noop;

    return deltaMs > 0
      ? { ...noop, appendMs: deltaMs }
      : { ...noop, trimEndMs: -deltaMs };
  }

  private planPlaySyncStart(): PlaySyncPlan {
    if (!this.settings.playSyncStart) return { decision: "immediate", waitMs: 0, offsetMs: 0 };
    const nearest = this.nearestPeerBoundary();
    if (nearest === null) return { decision: "immediate", waitMs: 0, offsetMs: 0 };

    const deltaMs = (nearest - this.audioHandler.now()) * 1000;
    if (Math.abs(deltaMs) > this.settings.playSyncStartThresholdMs) {
      return { decision: "immediate", waitMs: 0, offsetMs: 0 };
    }
    return deltaMs > 0
      ? { decision: "wait", waitMs: deltaMs, offsetMs: 0 }
      : { decision: "immediate", waitMs: 0, offsetMs: -deltaMs };
  }

  private nearestPeerBoundary(): number | null {
    const now = this.audioHandler.now();
    let nearest: number | null = null;
    const consider = (b: number | null) => {
      if (b === null) return;
      if (nearest === null || Math.abs(b - now) < Math.abs(nearest - now)) {
        nearest = b;
      }
    };
    for (const peer of Object.values(this.peers)) {
      if (peer === this) continue;
      consider(peer.getNearestLoopBoundary());
    }
    if (this.metronome) consider(this.metronome.getNearestLoopBoundary());
    return nearest;
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
