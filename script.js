class Recorder {
  constructor(buttonId, key, loop = false) {
    this.button = document.getElementById(buttonId);
    this.key = key;
    this.recordingState = "not-recording";
    this.mediaRecorder = null;
    this.audioBuffer = null;
    this.trimmedBuffer = null;
    this.ctx = null;
    this.src = null;
    this.chunks = [];
    this.clickCount = 0;

    this.playing = false;
    this.progressTimer = null;

    this.loop = false;
    this.startTime = undefined;
    this.position = 0;

    this.loop_setting = loop;
    this._bindUI();
    this._initMedia();
  }

  _bindUI() {
    this.button.addEventListener("pointerdown", () => this._onPointerDown());
    this.button.addEventListener("pointerup", () => this._onPointerUp());

    // Keyboard support
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
    this.trimmedBuffer = trimBuffer(audioBuffer, this.ctx, 0.1);
    this.chunks = [];
  }

  _onPointerDown() {
    this.clickCount += 1;
    this._holdTimer = setTimeout(() => this._resetButton(), 600);
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
    if (this.held) {
      this.held = false;
      return;
    }

    this.handleButtonPress();
    this.button.style.setProperty("filter", " drop-shadow(-4px 4px)");
  }

  _resetButton() {
    this.recordingState = "not-recording";
    this.button.innerHTML = "Record";
    this.button.style.setProperty("filter", " drop-shadow(-4px 4px)");
    this.button.classList.remove("holding");
    this.button.classList.remove("playing");
    this.loop = false;
    this.held = true;
    if (this.src) {
      try {
        this.src.stop();
      } catch (_) {}
      try {
        this.src.disconnect();
      } catch (_) {}
      this.src = null;
    }
  }

  handleButtonPress() {
    switch (this.recordingState) {
      case "not-recording":
        if (!this.mediaRecorder) return;
        this.recordingState = "recording";
        this.mediaRecorder.start();
        this.button.innerHTML = "Recording";
        break;

      case "recording":
        this.recordingState = "recorded";
        this.mediaRecorder.stop();
        this.button.innerHTML = "Recorded";
        break;

      case "recorded":
        this.button.innerHTML = "Playing";
        this._play();
        this.recordingState = "playing";
        break;

      case "playing":
        console.log((this.ctx.currentTime - this.startTime)/this.trimmedBuffer.duration);
        if (this.loop_setting && this.clickCount == 2) {
          this.loop = !this.loop;
        }
        else{
          
          this._play();


        }
        break;

    }
  }

  _play() {
    if (!this.trimmedBuffer || !this.ctx) return;

    // Stop any currently playing source first
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
    this.startTime = this.ctx.currentTime

    src.onended = () => {
      if (this.loop) {
        this._play();
      } else {
        if (this.src === src) this.src = null;
        this.button.innerHTML = "Played";
        this.recordingState = "recorded";
        this.button.classList.remove("playing");
      }
    };

    
  }
}

const recorder1 = new Recorder("btn1", "q", true);
const recorder2 = new Recorder("btn2", "w");
const recorder3 = new Recorder("btn3", "e");

const recorder4 = new Recorder("btn4", "a");
const recorder5 = new Recorder("btn5", "s");
const recorder6 = new Recorder("btn6", "d");

const recorder7 = new Recorder("btn7", "z", true);
const recorder8 = new Recorder("btn8", "x");
const recorder9 = new Recorder("btn9", "c");
