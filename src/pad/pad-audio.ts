import { PadState } from "./pad-state-machine.js";
import { PadSettings } from "./pad-settings.js";

export class PadAudioHandler {
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[];

  private element: HTMLElement;

  private audioContext: AudioContext;
  public audioBuffer: AudioBuffer | null;
  private sourceNode: AudioBufferSourceNode | null;

  // Tracks when the current playback started so we can compute timeUntilEnd
  private playbackStartTime: number = 0;

  private settings: PadSettings;

  constructor(
    stream: MediaStream,
    audioContext: AudioContext,
    element: HTMLElement,
    settings: PadSettings
  ) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
    this.chunks = [];
    this.element = element;
    this.audioContext = audioContext;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.settings = settings;

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      let buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.chunks = [];

      if (this.settings.trimAudio) {
        buffer = this.trimBuffer(buffer);
      }

      this.audioBuffer = buffer;

      // Signal to Pad that recording has been processed and is ready
      this.element.dispatchEvent(new CustomEvent("pad-recording-ready"));
    };
  }

  public updateSettings(settings: PadSettings) {
    this.settings = settings;
  }

  // Returns seconds until the current loop iteration ends; null if not playing
  public get timeUntilEnd(): number | null {
    if (!this.sourceNode || !this.audioBuffer) return null;
    const elapsed = this.audioContext.currentTime - this.playbackStartTime;
    const remaining = this.audioBuffer.duration - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  public startRecording() {
    this.chunks = [];
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
  }

  public async startPlaying() {
    if (!this.audioBuffer) return;

    // Always stop any existing playback first — handles the restart case
    this.stopPlaying();

    await this.audioContext.resume();

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.start();
    this.playbackStartTime = this.audioContext.currentTime;

    this.sourceNode.onended = () => {
      this.element.dispatchEvent(new CustomEvent("pad-update", {
        detail: "loop-end",
      }));
    };
  }

  public stopPlaying() {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
      } catch (_) {}
      try {
        this.sourceNode.disconnect();
      } catch (_) {}
      this.sourceNode = null;
    }
  }

  private deleteRecording() {
    this.stopPlaying();
    this.audioBuffer = null;
  }

  // Scans the buffer and removes leading/trailing silence based on settings.
  // Ported from main's trimBuffer helper.
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
        // stopRecording triggers onstop → processes chunks → dispatches pad-recording-ready
        // Only call stopRecording if we were actually recording (not coming from playing)
        if (this.mediaRecorder.state === "recording") {
          this.stopRecording();
        }
        this.stopPlaying();
        break;
      case "playing":
        this.startPlaying();
        break;
      // waiting states and "waiting-to-*" — no audio action needed, Pad handles the timer
    }
  }
}
