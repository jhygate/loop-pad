import { Metronome } from "@/metronome/metronome.js";
import { settingsPressed } from "@/settings/settings-modal.js";
import { effect } from "@/signals.js";
import { playIcon, pauseIcon } from "@/pad/pad-view.js";
import { saveMetronome } from "@/persistence.js";

export class MetronomeView {
  private readonly dialog: HTMLDialogElement;
  private readonly labelElement: HTMLElement;
  private readonly iconElement: HTMLElement;
  private readonly progressElement: HTMLElement;

  private renderedIcon = "";
  private renderedProgressKey = "";

  constructor(container: HTMLElement, private readonly metronome: Metronome) {
    container.innerHTML = `
      <div class="pad-container">
        <div class="pad-header">
          <div class="pad-number" data-role="bpm"></div>
        </div>
        <div class="pad-icon" data-role="icon"></div>
        <div class="pad-progress" data-role="progress"></div>
      </div>
    `;

    this.labelElement = container.querySelector<HTMLElement>('[data-role="bpm"]');
    this.iconElement = container.querySelector<HTMLElement>('[data-role="icon"]');
    this.progressElement = container.querySelector<HTMLElement>('[data-role="progress"]');
    this.dialog = document.getElementById("pad-settings-dialog") as HTMLDialogElement;

    container.addEventListener("pointerup", () => this.onPress());

    effect(() => this.render());
    this.render();
  }

  private onPress() {
    if (settingsPressed.value) {
      settingsPressed.value = false;
      this.openSettings();
      return;
    }
    if (this.metronome.isRunning) this.metronome.stop();
    else this.metronome.start();
    this.render();
  }

  private openSettings() {
    this.dialog.innerHTML = `
      <form method="dialog">
        <div style="display: flex; flex-direction: column;">
          <label>BPM
            <input type="number" name="bpm" min="20" max="300" step="1" value="${this.metronome.currentBpm}">
          </label>
          <label>Beats/bar
            <input type="number" name="beatsPerBar" min="1" max="16" step="1" value="${this.metronome.currentBeatsPerBar}">
          </label>
          <button>Close</button>
        </div>
      </form>
    `;
    this.dialog.showModal();

    const form = this.dialog.querySelector("form");
    form.addEventListener("input", () => {
      const data = new FormData(form);
      const bpm = Number(data.get("bpm"));
      const beatsPerBar = Number(data.get("beatsPerBar"));
      if (bpm >= 20 && bpm <= 300) this.metronome.setBpm(bpm);
      if (Number.isInteger(beatsPerBar) && beatsPerBar >= 1 && beatsPerBar <= 16) {
        this.metronome.setBeatsPerBar(beatsPerBar);
      }
      saveMetronome({ bpm: this.metronome.currentBpm, beatsPerBar: this.metronome.currentBeatsPerBar });
      this.render();
    });
  }

  private render() {
    this.labelElement.textContent = `${this.metronome.currentBpm} BPM`;

    const icon = settingsPressed.value ? "settings" : this.metronome.isRunning ? pauseIcon : playIcon;
    if (icon !== this.renderedIcon) {
      this.iconElement.innerHTML = icon;
      this.renderedIcon = icon;
    }

    const progressKey = this.metronome.isRunning ? `${this.metronome.barDurationSec}` : "";
    if (progressKey === this.renderedProgressKey) return;
    this.renderedProgressKey = progressKey;

    if (!progressKey) {
      this.progressElement.style.animation = "";
      return;
    }
    this.progressElement.style.animation = "none";
    void this.progressElement.offsetHeight;
    this.progressElement.style.animation = `progressFill ${this.metronome.barDurationSec}s linear infinite`;
  }
}
