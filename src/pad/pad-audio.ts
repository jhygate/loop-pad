import { PadState, ControllerPadEvent } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import { trimBuffer, computeMaxGain, adjustRecording, type TrimOptions, type RecordingAdjustment } from "@/audio-helpers.js";
import { getCachedInputSource, ensureInputSource } from "@/input-devices.js";

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
  private pendingRecordingAdjustment: RecordingAdjustment = { prependMs: 0, appendMs: 0, trimEndMs: 0 };
  private pendingPlaybackOffsetMs = 0;

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
        this.startPlaying();
        break;
    }
  }

  public startRecording() {
    this.chunks = [];
    this.wireRecordSources();
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
    this.unwireRecordSources();
  }

  public prepareInputDevice(deviceId: string) {
    void ensureInputSource(this.audioContext, deviceId);
  }

  private wireRecordSources() {
    const s = this.getSettings();
    const sources: AudioNode[] = [];
    if (s.recordMic) sources.push(this.inputSource(s.inputDeviceId));
    for (const peerId of s.recordSources) {
      const tap = this.getPeerOutput(peerId);
      if (tap) sources.push(tap);
    }
    for (const source of sources) source.connect(this.recordInput);
    this.connectedSources = sources;
  }

  private inputSource(deviceId: string): AudioNode {
    if (!deviceId) return this.micSource;
    const cached = getCachedInputSource(deviceId);
    if (cached) return cached;
    console.warn(`input device ${deviceId} unavailable; using default mic`);
    return this.micSource;
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
      const trimmed = trimBuffer(buffer, this.audioContext, this.trimOptions());
      this.audioBuffer = adjustRecording(trimmed, this.audioContext, this.pendingRecordingAdjustment);
      this.pendingRecordingAdjustment = { prependMs: 0, appendMs: 0, trimEndMs: 0 };
      this._maxGain = computeMaxGain(this.audioBuffer);
    } catch (e) {
      console.error("recording decode failed", e);
    } finally {
      this.onControllerEvent('processing-recording-complete');
    }
  }

  public async startPlaying() {
    if (!this.audioBuffer) return;

    await this.audioContext.resume();

    this.stopSource();

    const offsetSec = Math.min(this.pendingPlaybackOffsetMs / 1000, this.audioBuffer.duration);
    this.pendingPlaybackOffsetMs = 0;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(0, offsetSec);
    this.playStartTime = this.audioContext.currentTime - offsetSec;

    this.sourceNode.onended = () => {
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
    this._maxGain = 1;
  }

  private stopSource() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
    }
    this.sourceNode = null;
    this.playStartTime = null;
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
    if (this.playStartTime === null) return null;
    return this.audioContext.currentTime - this.playStartTime;
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

  public nearestBoundary(): number | null {
    if (this.playStartTime === null || !this.audioBuffer) return null;
    const duration = this.audioBuffer.duration;
    if (duration <= 0) return null;
    const elapsed = this.audioContext.currentTime - this.playStartTime;
    const loopIndex = Math.round(elapsed / duration);
    return this.playStartTime + loopIndex * duration;
  }

  public setRecordingAdjustment(adjustment: RecordingAdjustment) {
    this.pendingRecordingAdjustment = adjustment;
  }

  public setPlaybackOffsetMs(ms: number) {
    this.pendingPlaybackOffsetMs = ms;
  }
}
