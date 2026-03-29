import { Pad } from "./pad/pad.js";

export type GlobalState = {
  settingsPressed: boolean;
};

const globalState: GlobalState = { settingsPressed: false };

class main {
  pad1: Pad;
  pad2: Pad;

  constructor() {
    const audioCtx = new AudioContext();

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
