import { PadState, ControllerPadEvent } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import type { CaptureWindow, LoopReference } from "@/pad/pad-sync.js";
import { trimBuffer, computeMaxGain, extractAligned, refineOnset, type TrimOptions } from "@/audio-helpers.js";
import { getCachedInputSource, ensureInputSource } from "@/input-devices.js";
import { MONITOR_FRAME_TIME, ONSET_BACKTRACK_MARGIN, ONSET_BACKTRACK_TIME } from "@/pad/pad-constants.js";

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
  private scheduledPlaybackPending = false;
  private discardRecording = false;
  private monitorAnalyser: AnalyserNode | null = null;
  private monitorSource: AudioNode | null = null;
  private monitorData: Float32Array<ArrayBuffer> | null = null;
  private monitorTimerId = -1;
  private monitorFrames: number[] = [];
  private noiseFloor = 0;
  private floorFrozen = false;
  private awaitingOnset = false;
  private aboveCount = 0;
  private _detectedOnsetTime: number | null = null;
  private _lastSoundTime: number | null = null;

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
      case "armed":
        this.startRecording();
        this.startMonitoring(true);
        break;
      case "waiting-to-record":
      case "recording":
        this.startRecording();
        if (this.getSettings().endTrigger === "sound") this.startMonitoring(false);
        else if (!this.awaitingOnset) this.stopMonitoring();
        break;
      case "processing-recording":
        this.stopRecording();
        this.stopMonitoring();
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

  public setCaptureStart(startBoundary: number) {
    if (!this.capture) return;
    this.capture.startBoundary = startBoundary;
    this.capture.noiseFloor = this.noiseFloor;
  }

  public endCapture(endBoundary: number) {
    if (this.capture) this.capture.endBoundary = endBoundary;
  }

  public get activeCapture(): CaptureWindow | null {
    return this.capture;
  }

  public get detectedOnsetTime(): number | null {
    return this._detectedOnsetTime;
  }

  public get lastSoundTime(): number | null {
    return this._lastSoundTime;
  }

  private startMonitoring(awaitOnset: boolean) {
    if (this.monitorTimerId !== -1) {
      if (!awaitOnset) this.awaitingOnset = false;
      return;
    }
    this.monitorSource = this.inputSource(this.getSettings().inputDeviceId);
    this.monitorAnalyser = this.audioContext.createAnalyser();
    this.monitorAnalyser.fftSize = 2048;
    this.monitorAnalyser.smoothingTimeConstant = 0;
    this.monitorSource.connect(this.monitorAnalyser);
    this.monitorData = new Float32Array(this.monitorAnalyser.fftSize);
    this.monitorFrames = [];
    this.noiseFloor = 0;
    this.floorFrozen = !awaitOnset;
    this.awaitingOnset = awaitOnset;
    this.aboveCount = 0;
    this._detectedOnsetTime = null;
    this._lastSoundTime = null;
    this.monitorTimerId = setInterval(() => this.monitorTick(), MONITOR_FRAME_TIME);
  }

  private stopMonitoring() {
    if (this.monitorTimerId === -1) return;
    clearInterval(this.monitorTimerId);
    this.monitorTimerId = -1;
    if (this.monitorSource && this.monitorAnalyser) {
      try { this.monitorSource.disconnect(this.monitorAnalyser); } catch { /* already disconnected */ }
    }
    this.monitorAnalyser = null;
    this.monitorSource = null;
    this.awaitingOnset = false;
  }

  private monitorTick() {
    if (!this.monitorAnalyser || !this.monitorData) return;
    this.monitorAnalyser.getFloatTimeDomainData(this.monitorData);
    let sumSquares = 0;
    for (const v of this.monitorData) sumSquares += v * v;
    const rms = Math.sqrt(sumSquares / this.monitorData.length);

    const s = this.getSettings();
    if (!this.floorFrozen) {
      this.monitorFrames.push(rms);
      if (this.monitorFrames.length > 300) this.monitorFrames.shift();
      const sorted = [...this.monitorFrames].sort((a, b) => a - b);
      this.noiseFloor = sorted[Math.floor(sorted.length / 2)];
    }
    const dbToLin = (db: number) => Math.pow(10, db / 20);
    const floor = Math.max(this.noiseFloor, dbToLin(s.floorClampDb));

    if (rms > floor * dbToLin(s.releaseMarginDb)) {
      this._lastSoundTime = this.audioContext.currentTime;
    }

    if (!this.awaitingOnset) return;
    if (rms > floor * dbToLin(s.triggerMarginDb)) {
      this.aboveCount += 1;
      if (this.aboveCount >= s.debounceFrames) {
        this.awaitingOnset = false;
        this.floorFrozen = true;
        this._detectedOnsetTime = this.audioContext.currentTime - this.aboveCount * MONITOR_FRAME_TIME / 1000;
        this.onControllerEvent('input-detected');
      }
    } else {
      this.aboveCount = 0;
    }
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
    if (this.discardRecording) {
      this.discardRecording = false;
      this.chunks = [];
      return;
    }
    let cancelled = false;
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
        const cycles = Math.round((capture.endBoundary - capture.startBoundary) / capture.ref.cycleSec);
        if (cycles === 0) {
          cancelled = true;
        } else {
          const startOffsetSec = capture.startBoundary - this.recorderStartTime;
          this.audioBuffer = extractAligned(buffer, this.audioContext, startOffsetSec, cycles * capture.ref.cycleSamples);
        }
      } else if (
        capture &&
        capture.startBoundary !== null &&
        capture.endBoundary !== null &&
        this.recorderStartTime !== null
      ) {
        const rate = buffer.sampleRate;
        const startSample = Math.round((capture.startBoundary - this.recorderStartTime) * rate);
        const endSample = Math.min(Math.round((capture.endBoundary - this.recorderStartTime) * rate), buffer.length);
        const threshold = (capture.noiseFloor ?? 0) * ONSET_BACKTRACK_MARGIN;
        const refined = refineOnset(buffer, startSample, threshold, Math.round(rate * ONSET_BACKTRACK_TIME / 1000));
        const length = Math.max(1, endSample - refined);
        this.audioBuffer = extractAligned(buffer, this.audioContext, refined / rate, length);
      } else {
        if (capture?.ref) {
          console.warn("sync capture incomplete, keeping raw take", JSON.stringify(capture), this.recorderStartTime);
        }
        this.audioBuffer = trimBuffer(buffer, this.audioContext, this.trimOptions());
      }
      if (this.audioBuffer) this._maxGain = computeMaxGain(this.audioBuffer);
    } catch (e) {
      console.error("recording decode failed", e);
    } finally {
      this.onControllerEvent(cancelled ? 'recording-cancelled' : 'processing-recording-complete');
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
      ? (now - boundaryTime) % this.audioBuffer.duration
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
    this.stopMonitoring();
    if (this.mediaRecorder.state === "recording") {
      this.discardRecording = true;
      this.stopRecording();
    }
    this.audioBuffer = null;
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

  public get buffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  public setBuffer(buffer: AudioBuffer) {
    this.audioBuffer = buffer;
    this._maxGain = computeMaxGain(buffer);
  }

  public get recordingDuration(): number | null {
    return this.audioBuffer?.duration ?? null;
  }

  public get playbackElapsed(): number | null {
    if (this.playStartTime === null || !this.audioBuffer) return null;
    const elapsed = this.audioContext.currentTime - this.playStartTime;
    if (elapsed < 0) return elapsed;
    return elapsed % this.audioBuffer.duration;
  }

  public get playbackStart(): number | null {
    return this.playStartTime;
  }

  public get loopReference(): LoopReference | null {
    if (this.playStartTime === null || !this.audioBuffer) return null;
    return {
      originTime: this.playStartTime,
      cycleSec: this.audioBuffer.duration,
      cycleSamples: this.audioBuffer.length,
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
