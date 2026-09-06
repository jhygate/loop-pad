import { PadState, ControllerPadEvent } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import type { CaptureWindow, LoopReference } from "@/pad/pad-sync.js";
import { trimBuffer, computeMaxGain, extractAligned, type TrimOptions } from "@/audio-helpers.js";

export class PadAudioHandler {
  private readonly mediaRecorder: MediaRecorder;
  private readonly gainNode: GainNode;
  private readonly micSource: MediaStreamAudioSourceNode;
  private readonly recordInput: MediaStreamAudioDestinationNode;
  private connectedSources: AudioNode[] = [];
  private chunks: Blob[] = [];
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private playStartTime: number | null = null;
  private _maxGain = 1;
  private looping = true;
  private capture: CaptureWindow | null = null;
  private recorderStartTime: number | null = null;
  private cycleSamples: number | null = null;
  private scheduledPlaybackPending = false;

  constructor(
    stream: MediaStream,
    private readonly audioContext: AudioContext,
    private readonly getSettings: () => PadSettings,
    private readonly onControllerEvent: (event: ControllerPadEvent) => void,
    private readonly getPeerOutput: (padId: number) => AudioNode | null,
    private readonly onChange: () => void,
  ) {
    this.recordInput = audioContext.createMediaStreamDestination();
    this.mediaRecorder = new MediaRecorder(this.recordInput.stream, { audioBitsPerSecond: 128000 });
    this.micSource = audioContext.createMediaStreamSource(stream);

    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = this.getSettings().volume;
    this.gainNode.connect(audioContext.destination);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => this.processRecording();
  }

  public get outputTap(): AudioNode {
    return this.gainNode;
  }

  public handleStateChange(padState: PadState) {
    switch (padState) {
      case "empty":
        this.deleteRecording();
        break;
      case "waiting-to-record":
      case "recording":
        this.startRecording();
        break;
      case "processing-recording":
        this.stopRecording();
        break;
      case "recorded":
        this.stopPlaying();
        break;
      case "playing":
        if (this.scheduledPlaybackPending) this.scheduledPlaybackPending = false;
        else this.startPlaying();
        break;
    }
  }

  public beginCapture(capture: CaptureWindow) {
    this.capture = capture;
  }

  public endCapture(endBoundary: number) {
    if (this.capture) this.capture.endBoundary = endBoundary;
  }

  public get activeCapture(): CaptureWindow | null {
    return this.capture;
  }

  public startRecording() {
    if (this.mediaRecorder.state === "recording") return;
    this.chunks = [];
    this.wireRecordSources();
    this.recorderStartTime = this.audioContext.currentTime;
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
    this.unwireRecordSources();
  }

  private wireRecordSources() {
    const s = this.getSettings();
    const sources: AudioNode[] = [];
    if (s.recordMic) sources.push(this.micSource);
    for (const peerId of s.recordSources) {
      const tap = this.getPeerOutput(peerId);
      if (tap) sources.push(tap);
    }
    for (const source of sources) source.connect(this.recordInput);
    this.connectedSources = sources;
  }

  private unwireRecordSources() {
    for (const source of this.connectedSources) {
      try { source.disconnect(this.recordInput); } catch { /* already disconnected */ }
    }
    this.connectedSources = [];
  }

  private async processRecording() {
    try {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const capture = this.capture;
      if (
        capture?.ref &&
        capture.startBoundary !== null &&
        capture.endBoundary !== null &&
        this.recorderStartTime !== null
      ) {
        const cycles = Math.max(1, Math.round((capture.endBoundary - capture.startBoundary) / capture.ref.cycleSec));
        const startOffsetSec = capture.startBoundary - this.recorderStartTime;
        this.audioBuffer = extractAligned(buffer, this.audioContext, startOffsetSec, cycles * capture.ref.cycleSamples);
        this.cycleSamples = capture.ref.cycleSamples;
      } else {
        if (capture?.ref) {
          console.warn("sync capture incomplete, keeping raw take", JSON.stringify(capture), this.recorderStartTime);
        }
        this.audioBuffer = trimBuffer(buffer, this.audioContext, this.trimOptions());
        this.cycleSamples = capture?.sync ? this.audioBuffer.length : null;
      }
      this._maxGain = computeMaxGain(this.audioBuffer);
    } catch (e) {
      console.error("recording decode failed", e);
    } finally {
      this.onControllerEvent('processing-recording-complete');
    }
  }

  public setLooping(looping: boolean) {
    this.looping = looping;
    if (this.sourceNode) this.sourceNode.loop = looping;
  }

  public schedulePlayback(boundaryTime: number) {
    if (!this.audioBuffer) return;
    void this.audioContext.resume();
    this.stopSource();
    const now = this.audioContext.currentTime;
    const offsetSec = boundaryTime < now
      ? Math.min(now - boundaryTime, this.audioBuffer.duration)
      : 0;
    this.startSource(Math.max(boundaryTime, now), offsetSec, boundaryTime);
    this.scheduledPlaybackPending = true;
  }

  public startPlaying() {
    if (!this.audioBuffer) return;
    void this.audioContext.resume();
    this.stopSource();
    this.startSource(0, 0, this.audioContext.currentTime);
  }

  private startSource(when: number, offsetSec: number, claimedStartTime: number) {
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = this.looping;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(when, offsetSec);
    this.playStartTime = claimedStartTime;

    this.sourceNode.onended = () => {
      this.sourceNode = null;
      this.playStartTime = null;
      this.onControllerEvent('loop-end');
    };

    this.onChange();
  }

  public stopPlaying() {
    this.stopSource();
  }

  private deleteRecording() {
    this.stopSource();
    this.audioBuffer = null;
    this.cycleSamples = null;
    this.capture = null;
    this._maxGain = 1;
  }

  private stopSource() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
    }
    this.sourceNode = null;
    this.playStartTime = null;
    this.scheduledPlaybackPending = false;
  }

  private trimOptions(): TrimOptions {
    const s = this.getSettings();
    return {
      threshold: s.audioThreshold,
      trimStart: s.thresholdStart,
      trimEnd: s.thresholdEnd,
    };
  }

  public get recordingDuration(): number | null {
    return this.audioBuffer?.duration ?? null;
  }

  public get playbackElapsed(): number | null {
    if (this.playStartTime === null || !this.audioBuffer) return null;
    const elapsed = this.audioContext.currentTime - this.playStartTime;
    if (elapsed < 0) return null;
    return elapsed % this.audioBuffer.duration;
  }

  public get playbackStart(): number | null {
    return this.playStartTime;
  }

  public get loopReference(): LoopReference | null {
    if (this.playStartTime === null || this.cycleSamples === null) return null;
    return {
      originTime: this.playStartTime,
      cycleSec: this.cycleSamples / this.audioContext.sampleRate,
      cycleSamples: this.cycleSamples,
    };
  }

  public setVolume(v: number) {
    this.gainNode.gain.value = v;
  }

  public get maxGain(): number {
    return this._maxGain;
  }

  public now(): number {
    return this.audioContext.currentTime;
  }
}
