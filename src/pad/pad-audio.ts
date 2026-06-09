import { PadState } from "./pad-state-machine";

export class PadAudioHandler {
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[];

  private element: HTMLElement;

  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer;
  private sourceNode: AudioBufferSourceNode;
  private playStartTime: number | null;

  constructor(stream: MediaStream, audioContext: AudioContext, element: HTMLElement) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 })
    this.chunks = [];

    this.element = element;

    this.audioContext = audioContext;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.playStartTime = null;

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    }

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
      const arrayBuffer = await blob.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.chunks = [];

      console.log(this.audioBuffer)
    }
  }

  public startRecording() {
    this.chunks = [];
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder.stop();
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
      case "recorded":
        this.stopRecording();
        this.stopPlaying();
        break
      case "playing":
        this.stopRecording();
        this.startPlaying();
        break;

    }
  }


}
