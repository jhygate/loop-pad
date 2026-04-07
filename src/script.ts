import { Pad } from "./pad/pad.js";
import { SettingsModal } from "./settings/settings-modal.js";

export type GlobalState = {
  settingsPressed: boolean;
};

const globalState: GlobalState = { settingsPressed: false };

class main {
  pad1: Pad;
  pad2: Pad;
  settingsModal: SettingsModal;

  constructor() {
    const audioCtx = new AudioContext();
    const dialogEl = document.getElementById("pad-settings-dialog") as HTMLDialogElement;
    this.settingsModal = new SettingsModal(dialogEl);

    // Listen for pads requesting the modal
    document.addEventListener("open-pad-settings", (e: Event) => {
      const { settings, onSave } = (e as CustomEvent).detail;
      this.settingsModal.open(settings, onSave);
      globalState.settingsPressed = false;
      document.dispatchEvent(new CustomEvent('global-state-update'));

    });

    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getUserMedia(
        {
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        },
      )
        .then((stream) => {
          this.pad1 = new Pad("pad-box1", stream, audioCtx, globalState);
          this.pad2 = new Pad("pad-box2", stream, audioCtx, globalState);
        })
        .catch((err) => { console.error(err) });
    }
    document.getElementById("settings-button")
      .addEventListener("click", () => {
        globalState.settingsPressed = !globalState.settingsPressed;
        document.dispatchEvent(new CustomEvent('global-state-update'));
      });

  }
}

(window as any).app = new main();
