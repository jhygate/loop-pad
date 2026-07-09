import { Pad } from "@/pad/pad.js";
import { SettingsModal } from "@/settings/settings-modal.js";
import { getStream } from "@/audio-helpers.js";
import { Metronome } from "@/metronome/metronome.js";

class main {
  pads: Record<number, Pad> = {};
  settingsModal: SettingsModal;
  metronome: Metronome;

  async init() {
    const audioCtx = new AudioContext();
    const stream = await getStream();
    if (!stream) return;

    this.metronome = new Metronome(audioCtx, 120);
    this.wireMetronomeControls();

    for (let i = 1; i <= 9; i++) {
      this.pads[i] = new Pad(i, stream, audioCtx, this.pads, this.metronome);
    }

    this.settingsModal = new SettingsModal(
      "pad-settings-dialog",
      "settings-button",
      this.pads);
  }

  private wireMetronomeControls() {
    const toggle = document.getElementById("metronome-toggle") as HTMLButtonElement;
    const bpmInput = document.getElementById("metronome-bpm") as HTMLInputElement;

    const syncToggleLabel = () => {
      toggle.textContent = this.metronome.isRunning ? "Stop" : "Start";
    };

    toggle.addEventListener("click", () => {
      if (this.metronome.isRunning) this.metronome.stop();
      else this.metronome.start();
      syncToggleLabel();
    });

    bpmInput.addEventListener("input", () => {
      const v = Number(bpmInput.value);
      if (Number.isFinite(v) && v > 0) this.metronome.setBpm(v);
    });

    syncToggleLabel();
  }
}

(window as any).app = new main();
(window as any).app.init();
