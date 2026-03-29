import { Pad } from "./pad/pad.js";

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
          this.pad1 = new Pad("pad-box1", stream, audioCtx);
          this.pad2 = new Pad("pad-box2", stream, audioCtx);
        })
        .catch((err) => { console.error(err) });
    }


  }
}

(window as any).app = new main();
