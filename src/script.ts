import { Recorder } from "./recorder/recorder.js";

class main {
  recorder: Recorder;

  constructor() {
    console.log("hello world");
    this.recorder = new Recorder("recorder-box");
  }
}

(window as any).app = new main();
