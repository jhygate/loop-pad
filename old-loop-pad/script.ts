import { loadAllRecorders, setupButtonListeners } from "./storage";
import { Recorder } from "./recorder";
import { Settings } from "./settings";

export type AppState = {
  settingsClicked: boolean;
  settingsRecorder: Recorder | null;
  settingsModal: HTMLDialogElement | null;
  recorders: Recorder[];
};

const appState: AppState = {
  settingsClicked: false,
  settingsRecorder: null,
  settingsModal: null,
  recorders: [],
};

const recorder1 = new Recorder("btn1", "q", appState, 0);
const recorder2 = new Recorder("btn2", "w", appState, 1);
const recorder3 = new Recorder("btn3", "e", appState, 2);
const recorder4 = new Recorder("btn4", "a", appState, 3);
const recorder5 = new Recorder("btn5", "s", appState, 4);
const recorder6 = new Recorder("btn6", "d", appState, 5);
const recorder7 = new Recorder("btn7", "z", appState, 6);
const recorder8 = new Recorder("btn8", "x", appState, 7);
const recorder9 = new Recorder("btn9", "c", appState, 8);

appState.recorders = [
  recorder1,
  recorder2,
  recorder3,
  recorder4,
  recorder5,
  recorder6,
  recorder7,
  recorder8,
  recorder9,
];

loadAllRecorders(appState.recorders);

const settings = new Settings(appState);

document.addEventListener("DOMContentLoaded", () => {
  setupButtonListeners(appState.recorders);
});
