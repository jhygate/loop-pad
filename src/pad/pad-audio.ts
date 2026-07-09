import { PadState } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";

export class PadAudioHandler {
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[];

  private element: HTMLElement;

  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer;
  private sourceNode: AudioBufferSourceNode;
  private playStartTime: number | null;
  private getSettings: () => PadSettings;

  constructor(
    stream: MediaStream,
    audioContext: AudioContext,
    element: HTMLElement,
    getSettings: () => PadSettings,
  ) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 })
    this.chunks = [];

    this.element = element;

    this.audioContext = audioContext;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.playStartTime = null;
    this.getSettings = getSettings;

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    }

    this.mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.normalizeBuffer(buffer);
        this.audioBuffer = this.trimBuffer(buffer);
        this.chunks = [];
      } catch (e) {
        console.error("recording decode failed", e);
      } finally {
        this.element.dispatchEvent(new CustomEvent('pad-update', {
          detail: 'processing-recording-complete'
        }));
      }
    }
  }

  public startRecording() {
    this.chunks = [];
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
  }

  private normalizeBuffer(buffer: AudioBuffer): void {
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < ch.length; i++) {
        const abs = Math.abs(ch[i]);
        if (abs > peak) peak = abs;
      }
    }
    if (peak === 0) return;

    const scale = 1 / peak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const ch = buffer.getChannelData(c);
      for (let i = 0; i < ch.length; i++) {
        ch[i] *= scale;
      }
    }
  }

  private trimBuffer(buffer: AudioBuffer): AudioBuffer {
    const settings = this.getSettings();
    if (!settings.thresholdStart && !settings.thresholdEnd) return buffer;

    const channels: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    const audible = (i: number) =>
      channels.some(ch => Math.abs(ch[i]) > settings.audioThreshold);

    let start = 0;
    let end = buffer.length;

    if (settings.thresholdStart) {
      while (start < end && !audible(start)) start++;
    }
    if (settings.thresholdEnd) {
      while (end > start && !audible(end - 1)) end--;
    }

    const newLength = end - start;
    if (newLength <= 0) return buffer;

    const trimmed = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      newLength,
      buffer.sampleRate
    );
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      trimmed.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
    }
    return trimmed;
  }

  public async startPlaying() {
    if (!this.audioBuffer) {
      console.log("no bugger")
      return;
    }
    this.playStartTime = this.audioContext.currentTime;
    await this.audioContext.resume();

    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
    }

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.start();
    this.playStartTime = this.audioContext.currentTime;


    this.sourceNode.onended = () => {
      this.element.dispatchEvent(new CustomEvent('pad-update', {
        detail: 'loop-end'
      }))
    }
  }

  public stopPlaying() {
    this.sourceNode?.stop();
    this.sourceNode = null;
    this.playStartTime = null;
  }

  private deleteRecording() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
    }
    this.audioBuffer = null;
    this.sourceNode = null;
    this.playStartTime = null;
  }

  public get recordingDuration(): number | null {
    return this.audioBuffer?.duration ?? null;
  }

  public get playbackElapsed(): number | null {
    if (this.playStartTime === null) return null;
    return this.audioContext.currentTime - this.playStartTime;
  }

  public handleStateChange(padState: PadState) {
    switch (padState) {
      case "empty":
        this.deleteRecording();
        break
      case "recording":
        this.startRecording();
        break
      case "processing-recording":
        this.stopRecording();
        break
      case "recorded":
        this.stopPlaying();
        break
      case "playing":
        this.startPlaying();
        break;

    }
  }


}
