import { TRIM_THRESH, SYNC_THRESH, PLAYBUTTON, RECORDBUTTON, RECORDINGBUTTON, PLAYINGBUTTON, SETTINGSBUTTON, HOLD_TO_DELETE_TIME } from './constants.js'
import { getTimeToStart, trimBuffer } from "./helpers.js"
import { saveRecorderToIndexedDB } from './storage.js'


export class Recorder {

  constructor(buttonId, key, appState) {

    //Public
    this.recordingState = "not-recording";
    this.startTime = undefined;
    this.loop = false;

    //Private
    this.button = document.getElementById(buttonId);
    this.key = key;
    this.appState = appState;
    this.index = null; // Will be set after construction
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
    this.button.innerHTML = SETTINGSBUTTON;
    this._updatePadNumber();
  }

  showIcon() {
    if (this.recordingState === "not-recording") {
      this.button.innerHTML = RECORDBUTTON;
    } else if (this.recordingState === "recording") {
      this.button.innerHTML = RECORDINGBUTTON;
    } else if (this.recordingState === "recorded") {
      this.button.innerHTML = PLAYBUTTON;
    } else if (this.recordingState === "playing") {
      this.button.innerHTML = PLAYINGBUTTON;
    }
    this._updatePadNumber();
  }

  _updatePadNumber() {
    const padNumber = this.button.querySelector('.pad-number');
    if (padNumber && this.index !== null) {
      padNumber.textContent = this.index + 1;
    }
  }


  _bindUI() {
    this.button.innerHTML = RECORDBUTTON;
    // Note: pad number will be set after index is assigned in script.js

    this.button.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // Prevent default touch behavior
      this._onPointerDown();
    });

    this.button.addEventListener("pointerup", (e) => {
      e.preventDefault();
      this._onPointerUp();
    });

    this.button.addEventListener("pointercancel", () => this._onPointerUp());

    // Also listen on document for pointerup in case it happens outside button
    document.addEventListener("pointerup", (e) => {
      if (this._isPressed) {
        this._onPointerUp();
      }
    });

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

    // Auto-save after recording completes
    if (this.index !== null) {
      saveRecorderToIndexedDB(this, this.index);
    }
  }

  _onPointerDown() {
    this._isPressed = true;
    if (this.appState.settingsClicked) {
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
    if (!this._isPressed && !this.appState.settingsClicked) return;
    this._isPressed = false;

    if (this.appState.settingsClicked) {

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

      this.appState.settingsRecorder = this;
      this.appState.settingsModal.showModal();
      this.appState.settingsClicked = false;
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
    this.button.innerHTML = RECORDBUTTON;
    this._updatePadNumber();

    this.button.style.setProperty("filter", " drop-shadow(-4px 4px)");
    this.button.classList.remove("holding");
    this.button.classList.remove("playing");
    this.button.classList.remove("recording");
    this.button.classList.remove("has-audio");

    this.loop = false;
    this.resetting = true;

    this._stopAudio();

    // Clear the audio buffer so it's not saved
    this.trimmedBuffer = null;
    this.ctx = null;

    // Auto-save after deleting
    if (this.index !== null) {
      saveRecorderToIndexedDB(this, this.index);
    }
  }

  _startRecording() {
    if (!this.mediaRecorder) return;
    this.recordingState = "recording";
    this.button.innerHTML = RECORDINGBUTTON;
    this._updatePadNumber();
    this.button.classList.add("recording");

    const offset = getTimeToStart(this.syncThreshold, this.appState.recorders);

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
    const offset = getTimeToStart(this.syncThreshold, this.appState.recorders);

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
      this.button.innerHTML = PLAYBUTTON;
      this._updatePadNumber();
      this.button.classList.remove("recording");
      this.button.classList.add("has-audio");
      this.mediaRecorder.stop();
    }, stopDelay * 1000);
  }

  _setupAudioPlay() {
    let offset = getTimeToStart(this.syncThreshold, this.appState.recorders);

    // If sync is disabled or not in sync mode, play immediately
    if (!this.loopSync || !this.playSyncStart || offset == null) {
      offset = 0;
    }

    console.log(offset, "TIME TO START");
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
      this.button.innerHTML = PLAYINGBUTTON;
      this._updatePadNumber();

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
    this.button.innerHTML = PLAYBUTTON;
    this._updatePadNumber();
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
