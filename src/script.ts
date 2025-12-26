import { Recorder } from "./recorder/recorder.js";

class main {
  recorder1: Recorder;
  recorder2: Recorder;

  constructor() {
    console.log("hello world");
    this.recorder1 = new Recorder("recorder-box1");
    this.recorder2 = new Recorder("recorder-box2");
  }
}

(window as any).app = new main();
