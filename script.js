import { saveAllRecorders, loadAllRecorders, clearAllSavedData, exportConfigToFile, importConfigFromFile } from './storage.js';
import { Recorder } from './recorder.js'

const settingsModal = document.getElementById("settings");
const settingsUIButton = document.getElementById("settings-icon");

let settingsRecorder = null;

const appState = {
  settingClicked: false
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

const recorders = [
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
loadAllRecorders(recorders);

settingsUIButton.addEventListener("click", () => {
  appState.settingsClicked = true;
  for (const recorder of recorders) {
    recorder.showSettingsIcon();
  }
});

// Handle settings form submission
const settingsForm = document.getElementById('settings-form');
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault(); // Prevent page refresh!

  if (!settingsRecorder) return;

  // Set the recorder's properties from form values
  settingsRecorder.trimAudio = document.getElementById('trim-audio').checked;
  settingsRecorder.trimThreshold = parseFloat(document.getElementById('trim-threshold').value);
  settingsRecorder.trimAudioLeft = document.getElementById('trim-start').checked;
  settingsRecorder.trimAudioRight = document.getElementById('trim-end').checked;

  settingsRecorder.loopSync = document.getElementById('loop-sync').checked;
  settingsRecorder.syncThreshold = parseFloat(document.getElementById('sync-threshold').value);
  settingsRecorder.recordSyncStart = document.getElementById('record-sync-start').checked;
  settingsRecorder.recordSyncEnd = document.getElementById('record-sync-end').checked;
  settingsRecorder.playSyncStart = document.getElementById('play-sync-start').checked;

  settingsRecorder.loopable = document.getElementById('loopable').checked;

  // Get the selected radio button value
  const pressOption = document.querySelector('input[name="press-option"]:checked')?.value;
  if (pressOption) {
    settingsRecorder.playingPressOption = pressOption;
  }

  // Close the modal
  settingsModal.close();
  settingsRecorder = null; // Clear reference

   for (const recorder of recorders) {
    recorder.showIcon();
  }
  


});

// Add event listeners for save/clear buttons once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('save-session');
  const clearButton = document.getElementById('clear-session');
  const exportButton = document.getElementById('export-config');
  const importButton = document.getElementById('import-config');

  if (saveButton) {
    saveButton.addEventListener('click', () => saveAllRecorders(recorders));
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
        clearAllSavedData();
        // Optionally reload the page to reset everything
        setTimeout(() => location.reload(), 500);
      }
    });
  }

  if (exportButton) {
    exportButton.addEventListener('click', () => exportConfigToFile(recorders));
  }

  if (importButton) {
    importButton.addEventListener('click', () => importConfigFromFile(recorders));
  }
});

