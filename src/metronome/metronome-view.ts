import { Metronome } from "@/metronome/metronome.js";

export class MetronomeView {
  private readonly toggleButton: HTMLButtonElement;
  private readonly bpmInput: HTMLInputElement;
  private readonly beatsPerBarInput: HTMLInputElement;
  private readonly progressElement: HTMLElement;

  constructor(container: HTMLElement, private readonly metronome: Metronome) {
    container.innerHTML = `
      <div class="metronome-header">
        <button data-role="toggle">Start</button>
        <label>BPM
          <input type="number" data-role="bpm" min="20" max="300" step="1" value="${metronome.currentBpm}">
        </label>
        <label>Beats/bar
          <input type="number" data-role="beats-per-bar" min="1" max="16" step="1" value="${metronome.currentBeatsPerBar}">
        </label>
      </div>
      <div class="metronome-progress-track">
        <div class="metronome-progress" data-role="progress"></div>
      </div>
    `;

    this.toggleButton = container.querySelector<HTMLButtonElement>('[data-role="toggle"]');
    this.bpmInput = container.querySelector<HTMLInputElement>('[data-role="bpm"]');
    this.beatsPerBarInput = container.querySelector<HTMLInputElement>('[data-role="beats-per-bar"]');
    this.progressElement = container.querySelector<HTMLElement>('[data-role="progress"]');

    this.toggleButton.addEventListener("click", () => {
      if (this.metronome.isRunning) this.metronome.stop();
      else this.metronome.start();
      this.render();
    });

    this.bpmInput.addEventListener("input", () => {
      const v = Number(this.bpmInput.value);
      if (Number.isFinite(v) && v > 0) {
        this.metronome.setBpm(v);
        this.render();
      }
    });

    this.beatsPerBarInput.addEventListener("input", () => {
      const v = Number(this.beatsPerBarInput.value);
      if (Number.isFinite(v) && v > 0 && Number.isInteger(v)) {
        this.metronome.setBeatsPerBar(v);
        this.render();
      }
    });

    this.render();
  }

  private render() {
    this.toggleButton.textContent = this.metronome.isRunning ? "Stop" : "Start";
    this.updateProgressAnimation();
  }

  private updateProgressAnimation() {
    const p = this.progressElement;

    if (!this.metronome.isRunning) {
      p.classList.remove("running");
      p.style.animation = "";
      return;
    }

    p.classList.remove("running");
    p.style.animation = "none";
    void p.offsetHeight;
    p.style.animation = "";
    p.style.animationDuration = `${this.metronome.barDurationSec}s`;
    p.classList.add("running");
  }
}
