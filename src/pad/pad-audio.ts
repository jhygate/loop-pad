import { PadState, ControllerPadEvent } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import { trimBuffer, computeMaxGain, type TrimOptions } from "@/audio-helpers.js";

export class PadAudioHandler {
  private readonly mediaRecorder: MediaRecorder;
  private readonly gainNode: GainNode;
  private chunks: Blob[] = [];
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private playStartTime: number | null = null;
  private _maxGain = 1;

  constructor(
    stream: MediaStream,
    private readonly audioContext: AudioContext,
    private readonly getSettings: () => PadSettings,
    private readonly onControllerEvent: (event: ControllerPadEvent) => void,
  ) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 });

    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = this.getSettings().volume;
    this.gainNode.connect(audioContext.destination);

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => this.processRecording();
  }

  public setVolume(v: number) {
    this.gainNode.gain.value = v;
  }

  public get maxGain(): number {
    return this._maxGain;
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
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
  }

  private async processRecording() {
    try {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffer = trimBuffer(buffer, this.audioContext, this.trimOptions());
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

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start();
    this.playStartTime = this.audioContext.currentTime;

    this.sourceNode.onended = () => {
      this.onControllerEvent('loop-end');
    };
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
}
