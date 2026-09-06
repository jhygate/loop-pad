import { Pad } from "@/pad/pad.js";
import { SettingsModal } from "@/settings/settings-modal.js";
import { getStream } from "@/audio-helpers.js";
import { Metronome } from "@/metronome/metronome.js";
import { MetronomeView } from "@/metronome/metronome-view.js";
import { loadMetronome, loadPadState, loadRecordings, rebuildBuffer } from "@/persistence.js";

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

    const savedMetronome = loadMetronome();
    this.metronome = new Metronome(audioCtx, savedMetronome?.bpm ?? 120, savedMetronome?.beatsPerBar ?? 4);
    const metronomeContainer = document.getElementById("metronome");
    this.metronomeView = new MetronomeView(metronomeContainer, this.metronome);

    for (let i = 1; i <= 9; i++) {
      this.pads[i] = new Pad(i, stream, audioCtx, this.pads, this.metronome);
    }

    const recordings = await loadRecordings();
    for (let i = 1; i <= 9; i++) {
      const saved = loadPadState(i);
      const audio = recordings.get(i);
      if (!saved && !audio) continue;
      this.pads[i].restore(
        { ...this.pads[i].getSettings(), ...(saved?.settings ?? {}) },
        saved?.looping ?? true,
        audio ? rebuildBuffer(audioCtx, audio) : null,
      );
    }

    this.settingsModal = new SettingsModal(
      "pad-settings-dialog",
      "settings-button",
      this.pads);
  }
}

window.app = new App();
window.app.init();
