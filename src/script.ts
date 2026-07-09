import { Pad } from "@/pad/pad.js";
import { SettingsModal } from "@/settings/settings-modal.js";
import { getStream } from "@/audio-helpers.js";

class main {
  pads: Record<number, Pad> = {};
  settingsModal: SettingsModal;

  async init() {
    const audioCtx = new AudioContext();
    const stream = await getStream();
    if (!stream) return;

    for (let i = 1; i <= 9; i++) {
      this.pads[i] = new Pad(i, stream, audioCtx, this.pads);
    }

    this.settingsModal = new SettingsModal(
      "pad-settings-dialog",
      "settings-button",
      this.pads);
  }
}

(window as any).app = new main();
(window as any).app.init();
