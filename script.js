HOLD_TO_DELETE_TIME = 600;
class Recorder {
  constructor(buttonId, key, settings = { loop: false, restart: true }) {
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

    this.trimmedBuffer = null; //Stores the audio
    this.ctx = null; //Audio Context?
    this.src = null; //Plays the sound

    this.settings = settings;

    this._bindUI();
    this._initMedia();
  }

  get trackLength() {
    return this.trimmedBuffer.duration;
  }

  _bindUI() {
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
        audio: true,
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
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    // this.trimmedBuffer = trimBuffer(audioBuffer, this.ctx, 0.1);
    this.trimmedBuffer = audioBuffer;
    this.chunks = [];
  }

  _onPointerDown() {
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

  _onPointerUp() {
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
    this.button.innerHTML = "Record";

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
    this.button.innerHTML = "Recording";

    this.mediaRecorder.start();
  }

  _stopRecording() {
    this.recordingState = "recorded";
    this.button.innerHTML = "Recorded";

    this.mediaRecorder.stop();
  }

  _playAudio() {
    this.recordingState = "playing";
    this.button.innerHTML = "Playing";

    if (!this.trimmedBuffer || !this.ctx) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.trimmedBuffer;
    src.connect(this.ctx.destination);

    // Remove playing class first
    this.button.classList.remove("playing");
    const duration = this.trimmedBuffer.duration * 1000;
    this.button.style.setProperty("--play-duration", `${duration}ms`);

    // Use requestAnimationFrame to ensure the removal is processed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.button.classList.add("playing");
      });
    });

    src.start();
    this.src = src;
    this.startTime = this.ctx.currentTime;

    src.onended = () => {
      if (this.loop) {
        this._stopAudio();
        this._playAudio();
      } else {
        this._stopAudio();
      }
    };
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
    this.button.innerHTML = "Played";
    this.recordingState = "recorded";
    this.button.classList.remove("playing");
  }

  handleButtonPress() {
    console.log(this.recordingState);
    switch (this.recordingState) {
      case "not-recording":
        this._startRecording();
        break;

      case "recording":
        this._stopAudio();
        this._stopRecording();
        break;

      case "recorded":
        this.recordingState = "playing";
        this.button.innerHTML = "Playing";

        this._playAudio();
        break;

      case "playing":
        if (this.clickCount === 1) {
          console.log(this.clickCount, "click");
          if (this.settings["restart"] === true) {
            this._stopAudio();
            this._playAudio();
          }
          if (this.settings["restart"] === false){
            this._stopAudio();
            this.loop = false

          }
        }
        if (this.clickCount === 2) {
          console.log(this.clickCount, "click");
          if (this.settings["loop"] == true) this.loop = !this.loop;
        }
        break;
    }
  }
}

const recorder1 = new Recorder("btn1", "q", { loop: true, restart: true });
const recorder2 = new Recorder("btn2", "w");
const recorder3 = new Recorder("btn3", "e");

const recorder4 = new Recorder("btn4", "a");
const recorder5 = new Recorder("btn5", "s");
const recorder6 = new Recorder("btn6", "d");

const recorder7 = new Recorder("btn7", "z", { loop: true, restart: false });
const recorder8 = new Recorder("btn8", "x");
const recorder9 = new Recorder("btn9", "c");
