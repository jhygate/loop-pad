import { MONITOR_FRAME_TIME } from "@/pad/pad-constants.js";

export type GateSettings = {
  triggerMarginDb: number;
  releaseMarginDb: number;
  debounceFrames: number;
  floorClampDb: number;
};

type GateMode = "idle" | "armed" | "tracking";

const FLOOR_HISTORY_FRAMES = 300;

function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

export class InputGate {
  private analyser: AnalyserNode | null = null;
  private source: AudioNode | null = null;
  private data: Float32Array<ArrayBuffer> | null = null;
  private timerId = -1;
  private mode: GateMode = "idle";
  private frames: number[] = [];
  private aboveCount = 0;
  private _noiseFloor = 0;
  private _onsetTime: number | null = null;
  private _lastSoundTime: number | null = null;

  constructor(
    private readonly audioContext: AudioContext,
    private readonly getSettings: () => GateSettings,
    private readonly onTrigger: () => void,
  ) { }

  public get noiseFloor(): number {
    return this._noiseFloor;
  }

  public get onsetTime(): number | null {
    return this._onsetTime;
  }

  public get lastSoundTime(): number | null {
    return this._lastSoundTime;
  }

  public arm(source: AudioNode) {
    this.start(source, "armed");
  }

  public track(source: AudioNode) {
    this.start(source, "tracking");
  }

  public stop() {
    if (this.timerId === -1) return;
    clearInterval(this.timerId);
    this.timerId = -1;
    if (this.source && this.analyser) {
      try { this.source.disconnect(this.analyser); } catch { /* already disconnected */ }
    }
    this.analyser = null;
    this.source = null;
    this.mode = "idle";
  }

  private start(source: AudioNode, mode: GateMode) {
    if (this.timerId !== -1) {
      this.mode = mode;
      return;
    }
    this.source = source;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    source.connect(this.analyser);
    this.data = new Float32Array(this.analyser.fftSize);
    this.frames = [];
    this.aboveCount = 0;
    this._noiseFloor = 0;
    this._onsetTime = null;
    this._lastSoundTime = null;
    this.mode = mode;
    this.timerId = setInterval(() => this.tick(), MONITOR_FRAME_TIME);
  }

  private tick() {
    if (!this.analyser || !this.data) return;
    this.analyser.getFloatTimeDomainData(this.data);
    let sumSquares = 0;
    for (const v of this.data) sumSquares += v * v;
    const rms = Math.sqrt(sumSquares / this.data.length);

    const s = this.getSettings();
    if (this.mode === "armed") {
      this.frames.push(rms);
      if (this.frames.length > FLOOR_HISTORY_FRAMES) this.frames.shift();
      const sorted = [...this.frames].sort((a, b) => a - b);
      this._noiseFloor = sorted[Math.floor(sorted.length / 2)];
    }
    const floor = Math.max(this._noiseFloor, dbToLin(s.floorClampDb));

    if (rms > floor * dbToLin(s.releaseMarginDb)) {
      this._lastSoundTime = this.audioContext.currentTime;
    }

    if (this.mode !== "armed") return;
    if (rms > floor * dbToLin(s.triggerMarginDb)) {
      this.aboveCount += 1;
      if (this.aboveCount >= s.debounceFrames) {
        this._onsetTime = this.audioContext.currentTime - this.aboveCount * MONITOR_FRAME_TIME / 1000;
        this.mode = "tracking";
        this.onTrigger();
      }
    } else {
      this.aboveCount = 0;
    }
  }
}
