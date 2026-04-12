import { PadState } from "./pad-state-machine.js";
import { PadSettings } from "./pad-settings.js";
import { PadLog } from "../debug/logger.js";

export class PadAudioHandler {
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[];

  private element: HTMLElement;

  private audioContext: AudioContext;
  public audioBuffer: AudioBuffer | null;
  private sourceNode: AudioBufferSourceNode | null;

  // Tracks audioContext.currentTime when playback began — used by timeUntilEnd
  private playbackStartTime: number = 0;

  private settings: PadSettings;
  private log: PadLog;

  constructor(
    stream: MediaStream,
    audioContext: AudioContext,
    element: HTMLElement,
    settings: PadSettings,
    log: PadLog,
  ) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
    this.chunks = [];
    this.element = element;
    this.audioContext = audioContext;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.settings = settings;
    this.log = log;

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      this.log.audio("processing recording chunks");
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      let buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.chunks = [];

      if (this.settings.trimAudio) {
        const before = buffer.duration;
        buffer = this.trimBuffer(buffer);
        this.log.audio(`trimmed: ${before.toFixed(3)}s → ${buffer.duration.toFixed(3)}s`);
      }

      this.audioBuffer = buffer;
      this.log.audio(`recording ready: ${buffer.duration.toFixed(3)}s`);

      // Signal to Pad that the async processing is done and it can save/re-render
      this.element.dispatchEvent(new CustomEvent("pad-recording-ready"));
    };
  }

  public updateSettings(settings: PadSettings) {
    this.settings = settings;
  }

  // Seconds remaining in the current loop iteration; null when not playing
  public get timeUntilEnd(): number | null {
    if (!this.sourceNode || !this.audioBuffer) return null;
    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const remaining = this.audioBuffer.duration - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  // Expose context so Pad can pass it to loadFromStorage without bracket access
  public get ctx(): AudioContext {
    return this.audioContext;
  }

  public startRecording() {
    this.chunks = [];
    this.mediaRecorder.start();
    this.log.audio("recording started");
  }

  public stopRecording() {
    this.mediaRecorder.stop();
    this.log.audio("recording stopped — processing async");
  }

  public async startPlaying() {
    if (!this.audioBuffer) {
      this.log.audio("startPlaying called but no buffer");
      return;
    }

    // Always stop first — handles the restart case cleanly
    this.stopPlaying();

    await this.audioContext.resume();

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.start();
    this.playbackStartTime = this.audioContext.currentTime;

    this.log.audio(`playback started (${this.audioBuffer.duration.toFixed(3)}s)`);

    this.sourceNode.onended = () => {
      this.log.audio("loop-end fired");
      this.element.dispatchEvent(new CustomEvent("pad-update", {
        detail: "loop-end",
      }));
    };
  }

  public stopPlaying() {
    if (!this.sourceNode) return;
    try { this.sourceNode.onended = null; this.sourceNode.stop(); } catch (_) {}
    try { this.sourceNode.disconnect(); } catch (_) {}
    this.sourceNode = null;
    this.log.audio("playback stopped");
  }

  private deleteRecording() {
    this.stopPlaying();
    this.audioBuffer = null;
    this.log.audio("recording deleted");
  }

  // Removes leading/trailing silence from a buffer based on current settings
  private trimBuffer(buffer: AudioBuffer): AudioBuffer {
    const { numberOfChannels, sampleRate, length } = buffer;
    const threshold = this.settings.trimThreshold;

    const isSilent = (i: number): boolean => {
      for (let c = 0; c < numberOfChannels; c++) {
        if (Math.abs(buffer.getChannelData(c)[i]) >= threshold) return false;
      }
      return true;
    };

    let start = 0;
    let end = length - 1;

    if (this.settings.trimAudioLeft) {
      while (start < end && isSilent(start)) start++;
    }
    if (this.settings.trimAudioRight) {
      while (end > start && isSilent(end)) end--;
    }

    const frames = Math.max(1, end - start + 1);
    const out = this.audioContext.createBuffer(numberOfChannels, frames, sampleRate);
    for (let c = 0; c < numberOfChannels; c++) {
      out.getChannelData(c).set(buffer.getChannelData(c).subarray(start, end + 1));
    }
    return out;
  }

  public handleStateChange(padState: PadState) {
    switch (padState) {
      case "empty":
        this.deleteRecording();
        break;
      case "recording":
        this.startRecording();
        break;
      case "recorded":
        // stopRecording is async — fires onstop → emits pad-recording-ready when done
        if (this.mediaRecorder.state === "recording") {
          this.stopRecording();
        }
        this.stopPlaying();
        break;
      case "playing":
        this.startPlaying();
        break;
      // waiting-* states have no audio action — Pad handles the sync timer
    }
  }
}
