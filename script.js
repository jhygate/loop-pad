import { loadAllRecorders } from './storage.js';
import { Recorder } from './recorder.js'
import { Settings } from './settings.js';


const appState = {
  settingClicked: false,
  settingsRecorder: null,
  settingsModal: document.getElementById("settings"),
  recorders: [],
};


const recorder1 = new Recorder("btn1", "q", appState);
const recorder2 = new Recorder("btn2", "w", appState);
const recorder3 = new Recorder("btn3", "e", appState);
const recorder4 = new Recorder("btn4", "a", appState);
const recorder5 = new Recorder("btn5", "s", appState);
const recorder6 = new Recorder("btn6", "d", appState);
const recorder7 = new Recorder("btn7", "z", appState);
const recorder8 = new Recorder("btn8", "x", appState);
const recorder9 = new Recorder("btn9", "c", appState);

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

// Load saved recordings immediately after recorders are created
loadAllRecorders(appState.recorders);

const settings = new Settings(appState);






