import { saveAllRecorders, loadAllRecorders, clearAllSavedData } from './storage.js';

const HOLD_TO_DELETE_TIME = 600;
export const TRIM_THRESH = 0.05;
export const SYNC_THRESH = 20000;

export const recordButton = '<div class="record"></div>';
export const recordingButton = '<div class="record pulsing"></div>';
export const playButton =
  '<div class="triangle-border"><div class="triangle"></div></div>';
export const playingButton =
  '<div class="triangle-border pulsing"><div class="triangle pulsing"></div></div>';
const settingsButtons ='<div><img src="icons/settings.svg"></div>'

const settingsModal = document.getElementById("settings");
const settingsButton = document.getElementById("settings-icon");

let settingsRecorder = null;

let settingsClicked = false;



function getTimeToStart(thresh) {
  const playingTracks = Recorder.instances.filter(
    (r) => r.recordingState === "playing" && r.loop === true
  );
  const timeToStarts = [];
  for (const recorder of playingTracks) {
    const timeToStart = recorder.trackLength - recorder.currentTime;
    const timeSinceStart = recorder.ctx.currentTime - recorder.startTime;
    if (timeSinceStart <= timeToStart) {
      timeToStarts.push(0 - timeSinceStart);
    } else {
      timeToStarts.push(timeToStart);
    }
  }
  console.log(playingTracks);
  console.log(timeToStarts);
  const filtered = timeToStarts.filter((t) => Math.abs(t) * 1000 < thresh);

  console.log(filtered, "FILTERED");
  if (filtered.length === 0) return null;

  const smallestAbs = filtered.reduce((a, b) => (Math.abs(a) < Math.abs(b) ? a : b));
  console.log(smallestAbs);
  return smallestAbs;
}
class Recorder {
  static instances = [];

  constructor(buttonId, key) {
    Recorder.instances.push(this);

    //Public
    this.recordingState = "not-recording";
    this.startTime = undefined;
    this.loop = false;

    //Private
    this.button = document.getElementById(buttonId);
    this.key = key;
    this.clickCount = 0;
    this.resetting = false;

    this.mediaRecorder = null; //Recorder object
    this.chunks = []; //Stores audio data
    this.silenceDuration = 0; //Stores silence to add at the beginning
    this.endTrim = 0; //Stores trim at the end

    this.trimmedBuffer = null; //Stores the audio
    this.ctx = null; //Audio Context?
    this.src = null; //Plays the sound

    this.trimAudio = false;
    this.trimThreshold = TRIM_THRESH;
    this.trimAudioLeft = false;
    this.trimAudioRight = false;

    this.loopSync = false;
    this.syncThreshold = SYNC_THRESH;
    this.recordSyncStart = false;
    this.recordSyncEnd = false;
    this.playSyncStart = false;

    this.loopable = false;

    this.playingPressOption = "stop" //Options "stop" "restart"

    this._bindUI();
    this._initMedia();
  }

  get trackLength() {
    return this.trimmedBuffer.duration;
  }

  get currentTime() {
    return this.ctx.currentTime - this.startTime;
  }

  showSettingsIcon() {
    this.button.innerHTML = settingsButtons;
  }

  showIcon() {
    if (this.recordingState === "not-recording") {
      this.button.innerHTML = recordButton;
    } else if (this.recordingState === "recording") {
      this.button.innerHTML = recordingButton;
    } else if (this.recordingState === "recorded") {
      this.button.innerHTML = playButton;
    } else if (this.recordingState === "playing") {
      this.button.innerHTML = playingButton;
    }
  }


  _bindUI() {
    this.button.innerHTML = recordButton;

    this.button.addEventListener("pointerdown", () => this._onPointerDown());
    this.button.addEventListener("pointerup", () => this._onPointerUp());
    this.button.style.setProperty("--delete-time", `${HOLD_TO_DELETE_TIME}ms`);

    document.addEventListener("keydown", (e) => this._onKeyDown(e));
    document.addEventListener("keyup", (e) => this._onKeyUp(e));
  }

  _onKeyDown(e) {
    if (e.key.toLowerCase() === this.key.toLowerCase() && !e.repeat) {
      this._onPointerDown();
    }
  }

  _onKeyUp(e) {
    if (e.key.toLowerCase() === this.key.toLowerCase()) {
      this._onPointerUp();
    }
  }

  async _initMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (ev) => this.chunks.push(ev.data);
      this.mediaRecorder.onstop = async () => {
        await this._processChunks();
      };
    } catch (err) {
      console.error(err.name, err.message);
    }
  }

  async _processChunks() {
    this.ctx = new AudioContext();
    const arrayBuffer = await new Blob(this.chunks, {
      type: "audio/mp4;",
    }).arrayBuffer();
    let audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    if (this.trimAudio === true) {
      audioBuffer = trimBuffer(audioBuffer, this.ctx, this.trimThreshold);
    }

    // Add silence to the beginning if needed
    if (this.silenceDuration > 0) {
      const silenceSamples = Math.floor(
        this.silenceDuration * this.ctx.sampleRate
      );
      const newLength = audioBuffer.length + silenceSamples;
      const newBuffer = this.ctx.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        this.ctx.sampleRate
      );

      // Copy audio data after the silence
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const oldData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        newData.set(oldData, silenceSamples);
      }

      audioBuffer = newBuffer;
    }

    // Remove audio from the end if needed
    if (this.endTrim > 0) {
      const endTrimSamples = Math.floor(this.endTrim * this.ctx.sampleRate);
      const newLength = audioBuffer.length - endTrimSamples;
      const newBuffer = this.ctx.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        this.ctx.sampleRate
      );

      // Copy audio data without the end portion
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const oldData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        newData.set(oldData.subarray(0, newLength));
      }

      this.trimmedBuffer = newBuffer;
    } else {
      this.trimmedBuffer = audioBuffer;
    }

    this.chunks = [];
    this.silenceDuration = 0;
    this.endTrim = 0;
  }

  _onPointerDown() {
    if (settingsClicked) {
      return;
    }
    this.resetting = false;
    this.clickCount += 1;
    console.log(this.clickCount);
    this._holdTimer = setTimeout(
      () => this._resetButton(),
      HOLD_TO_DELETE_TIME
    );
    clearTimeout(this._clickResetTimer);
    this._clickResetTimer = setTimeout(() => (this.clickCount = 0), 300);
    this.button.style.setProperty("filter", " drop-shadow(0px 0px)");

    if (
      this.recordingState === "playing" ||
      this.recordingState === "recorded"
    ) {
      this.button.classList.add("holding");
    }
  }

  _onPointerUp(){
    
    if (settingsClicked) {

      document.getElementById('trim-audio').checked = this.trimAudio;
      document.getElementById('trim-threshold').value = this.trimThreshold;
      document.getElementById('trim-start').checked = this.trimAudioLeft;
      document.getElementById('trim-end').checked = this.trimAudioRight;
      
      document.getElementById('loop-sync').checked = this.loopSync;
      document.getElementById('sync-threshold').value = this.syncThreshold;
      document.getElementById('record-sync-start').checked = this.recordSyncStart;
      document.getElementById('record-sync-end').checked = this.recordSyncEnd;
      document.getElementById('play-sync-start').checked = this.playSyncStart;
      
      document.getElementById('loopable').checked = this.loopable;
      
      // Set radio button for playingPressOption
      if (this.playingPressOption === "stop") {
        document.getElementById('press-option-stop').checked = true;
      } else if (this.playingPressOption === "restart") {
        document.getElementById('press-option-restart').checked = true;
      }

      settingsRecorder = this;  
      settingsModal.showModal();
      settingsClicked = false;
      return;
    }

    clearTimeout(this._holdTimer);
    this.button.classList.remove("holding");
    this.button.style.setProperty("filter", " drop-shadow(-4px 4px)");

    if (this.resetting) {
      this.resetting = false;
      return;
    }

    this.handleButtonPress();
  }

  _resetButton() {
    this.recordingState = "not-recording";
    this.button.innerHTML = recordButton;

    this.button.style.setProperty("filter", " drop-shadow(-4px 4px)");
    this.button.classList.remove("holding");
    this.button.classList.remove("playing");

    this.loop = false;
    this.resetting = true;

    this._stopAudio();
  }

  _startRecording() {
    if (!this.mediaRecorder) return;
    this.recordingState = "recording";
    this.button.innerHTML = recordingButton;

    const offset = getTimeToStart(this.syncThreshold);

    let startDelay = 0;
    this.silenceDuration = 0;
    if (offset > 0) {
      startDelay = offset;
      this.silenceDuration = 0;
    }
    if (offset < 0) {
      this.silenceDuration = Math.abs(offset);
    }

    if (this.recordSyncStart === false) {
      this.silenceDuration = 0;
      this.startTrim = 0;
    }

    setTimeout(() => {
      this.mediaRecorder.start();
    }, startDelay * 1000);
  }

  _stopRecording() {
    const offset = getTimeToStart(this.syncThreshold);

    let stopDelay = 0;
    this.endTrim = 0;
    if (offset > 0) {
      stopDelay = offset;
    }
    if (offset < 0) {
      this.endTrim = Math.abs(offset);
    }

    if (this.recordSyncEnd === false) {
      this.endTrim = 0;
      this.stopDelay = 0;
    }

    setTimeout(() => {
      this.recordingState = "recorded";
      this.button.innerHTML = playButton;
      this.mediaRecorder.stop();
    }, stopDelay * 1000);
  }

  _setupAudioPlay() {
    const offset = getTimeToStart(this.syncThreshold);

    if (this.playSyncStart) {
     offset = 0;
    }

    console.log(offset, "TIME TO START");
    if (offset == null || offset === 0) {
      this._startAudio(0);
    }
    this._startAudio(offset);
  }

  _startAudio(offset) {
    let delay = 0;
    let trim = 0;
    if (offset < 0) {
      delay = 0;
      trim = 0 - offset;
    } else {
      delay = offset;
      trim = 0;
    }

    this._holdTimer = setTimeout(() => {
      console.log("STARTED");

      this.recordingState = "playing";
      this.button.innerHTML = playingButton;

      if (!this.trimmedBuffer || !this.ctx) return;

      const src = this.ctx.createBufferSource();
      src.buffer = this.trimmedBuffer;
      src.connect(this.ctx.destination);

      // Remove playing class first
      this.button.classList.remove("playing");
      const duration = (this.trimmedBuffer.duration - trim) * 1000;
      this.button.style.setProperty("--play-duration", `${duration}ms`);

      // Use requestAnimationFrame to ensure the removal is processed
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.button.classList.add("playing");
        });
      });

      src.start(0, trim);
      this.src = src;
      this.startTime = this.ctx.currentTime;

      src.onended = () => {
        if (this.loop) {
          this._stopAudio();
          this._startAudio(0);
        } else {
          this._endAudio();
        }
      };
    }, delay * 1000);
  }

  _stopAudio() {
    if (this.src) {
      try {
        this.src.onended = null;
        this.src.stop();
      } catch (_) {}
      try {
        this.src.disconnect();
      } catch (_) {}
      this.src = null;
    }
    this.button.classList.remove("playing");
  }

  _endAudio() {
    this._stopAudio();
    this.button.innerHTML = playButton;
    this.recordingState = "recorded";
  }

  handleButtonPress() {
    console.log(this.recordingState, "HANDLE BUTTON PRESS");
    switch (this.recordingState) {
      case "not-recording":
        this._startRecording();
        break;

      case "recording":
        this._endAudio();
        this._stopRecording();
        break;

      case "recorded":
        this._setupAudioPlay();
        break;

      case "playing":
        if (this.clickCount === 1 || this.loopable == false) {
          console.log(this.clickCount, "click");
          if (this.playingPressOption === "restart") {
            this._stopAudio();
            this._setupAudioPlay();
          }
          if (this.playingPressOption === "stop") {
            this._endAudio();
            this.loop = false;
          }
        }
        if (this.clickCount === 2 && this.loopable == true) {
          console.log(this.clickCount, "click");
          this.loop = !this.loop;
        }
        break;
    }
  }
}

const recorder1 = new Recorder("btn1", "q");
const recorder2 = new Recorder("btn2", "w");
const recorder3 = new Recorder("btn3", "e");

const recorder4 = new Recorder("btn4", "a");
const recorder5 = new Recorder("btn5", "s");
const recorder6 = new Recorder("btn6", "d");

const recorder7 = new Recorder("btn7", "z");
const recorder8 = new Recorder("btn8", "x");
const recorder9 = new Recorder("btn9", "c");

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

settingsButton.addEventListener("click", () => {
  settingsClicked = true;
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
});

