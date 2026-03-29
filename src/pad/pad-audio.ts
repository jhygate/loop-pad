import { PadState } from "./pad-state-machine";

export class PadAudioHandler {
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[];

  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer;
  private sourceNode: AudioBufferSourceNode;

  constructor(stream: MediaStream, audioContext: AudioContext) {
    this.mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 128000 })
    this.chunks = [];

    this.audioContext = audioContext;
    this.audioBuffer = null;
    this.sourceNode = null;

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
    await this.audioContext.resume();

    console.log("state:", this.audioContext.state);
    console.log("buffer duration:", this.audioBuffer?.duration);
    console.log("buffer sampleRate:", this.audioBuffer?.sampleRate);

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);
    this.sourceNode.start();
  }

  public stopPlaying() {
    this.sourceNode?.stop();
    this.sourceNode = null;

  }

  public handleStateChange(padState: PadState) {
    if (padState == "recording") {
      this.startRecording();
    }
    if (padState == "recorded") {
      this.stopRecording();
    }
    if (padState == "playing") {
      this.startPlaying();
    }
  }


}
