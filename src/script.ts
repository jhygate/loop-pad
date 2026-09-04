import { Pad } from "@/pad/pad.js";
import { SettingsModal } from "@/settings/settings-modal.js";
import { getStream } from "@/audio-helpers.js";
import { Metronome } from "@/metronome/metronome.js";
import { MetronomeView } from "@/metronome/metronome-view.js";

declare global {
  interface Window {
    app: App;
  }
}

class App {
  pads: Record<number, Pad> = {};
  settingsModal: SettingsModal;
  metronome: Metronome;
  metronomeView: MetronomeView;

  async init() {
    const audioCtx = new AudioContext();
    const stream = await getStream();
    if (!stream) return;

    this.metronome = new Metronome(audioCtx, 120, 4);
    const metronomeContainer = document.getElementById("metronome");
    this.metronomeView = new MetronomeView(metronomeContainer, this.metronome);

    for (let i = 1; i <= 9; i++) {
      this.pads[i] = new Pad(i, stream, audioCtx, this.pads, this.metronome);
    }

    this.settingsModal = new SettingsModal(
      "pad-settings-dialog",
      "settings-button",
      this.pads);
  }
}

window.app = new App();
window.app.init();
