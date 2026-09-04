const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;
const CLICK_DURATION_SEC = 0.05;
const CLICK_FREQ_HZ = 900;
const CLICK_PEAK_GAIN = 0.3;

export class Metronome {
  private bpm: number;
  private beatsPerBar: number;
  private _startTime: number | null = null;
  private nextBeatIndex = 0;
  private schedulerTimerId = -1;
  private _isRunning = false;

  constructor(
    private readonly audioContext: AudioContext,
    bpm = 120,
    beatsPerBar = 4,
  ) {
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get currentBpm(): number {
    return this.bpm;
  }

  public get currentBeatsPerBar(): number {
    return this.beatsPerBar;
  }

  public get startTime(): number | null {
    return this._startTime;
  }

  public get barDurationSec(): number {
    return (60 / this.bpm) * this.beatsPerBar;
  }

  public start() {
    if (this._isRunning) return;
    this.audioContext.resume();
    this._startTime = this.audioContext.currentTime;
    this.nextBeatIndex = 0;
    this._isRunning = true;
    this.tick();
  }

  public stop() {
    this._isRunning = false;
    this._startTime = null;
    if (this.schedulerTimerId !== -1) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = -1;
    }
  }

  public setBpm(bpm: number) {
    if (bpm <= 0 || !Number.isFinite(bpm)) return;
    this.bpm = bpm;
    this.restartIfRunning();
  }

  public setBeatsPerBar(n: number) {
    if (n <= 0 || !Number.isFinite(n) || !Number.isInteger(n)) return;
    this.beatsPerBar = n;
    this.restartIfRunning();
  }

  private restartIfRunning() {
    if (!this._isRunning) return;
    this.stop();
    this.start();
  }

  public getNearestLoopBoundary(): number | null {
    if (!this._isRunning || this._startTime === null) return null;
    const barSec = this.barDurationSec;
    const elapsed = this.audioContext.currentTime - this._startTime;
    const barIndex = Math.round(elapsed / barSec);
    return this._startTime + barIndex * barSec;
  }

  private tick = () => {
    if (!this._isRunning || this._startTime === null) return;
    const beatSec = 60 / this.bpm;
    const horizon = this.audioContext.currentTime + SCHEDULE_AHEAD_SEC;

    while (true) {
      const beatTime = this._startTime + this.nextBeatIndex * beatSec;
      if (beatTime >= horizon) break;
      this.playClick(beatTime);
      this.nextBeatIndex++;
    }

    this.schedulerTimerId = setTimeout(this.tick, LOOKAHEAD_MS);
  }

  private playClick(when: number) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.frequency.value = CLICK_FREQ_HZ;
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    gain.gain.setValueAtTime(CLICK_PEAK_GAIN, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + CLICK_DURATION_SEC);
    osc.start(when);
    osc.stop(when + CLICK_DURATION_SEC);
  }
}
