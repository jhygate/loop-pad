class Recorder {
  constructor(buttonId) {
    this.button = document.getElementById(buttonId);
    this.recordingState = "not-recording";
    this.mediaRecorder = null;
    this.audioBuffer = null;
    this.trimmedBuffer = null;
    this.ctx = null;
    this.src = null;
    this.chunks = [];
    this.click_count = 0;

    this._bindUI();
    this._initMedia();
  }

  _bindUI() {
    this.button.addEventListener("pointerdown", () => this._onPointerDown());
    this.button.addEventListener("pointerup", () => this._onPointerUp());
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
    this.trimmedBuffer = trimBuffer(audioBuffer, this.ctx, 0.02);
    this.chunks = [];
  }

  _onPointerDown() {
    this.clickCount += 1;
    this._holdTimer = setTimeout(() => this._resetButton(), 600);
    clearTimeout(this._clickResetTimer);
    this._clickResetTimer = setTimeout(() => (this.clickCount = 0), 300);
  }

  _onPointerUp() {
    clearTimeout(this._holdTimer);
    if (this.held) {
      this.held = false;
      return;
    }

    this.handleButtonPress();
  }

  _resetButton() {
    this.recordingState = "not-recording";
    this.button.innerHTML = "Record";
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
        // single tap: stop playback
        if (this.clickCount === 1) {
          if (this.src) {
            try {
              this.src.stop();
            } catch (_) {}
            try {
              this.src.disconnect();
            } catch (_) {}
            this.src = null;
          }
          this.recordingState = "recorded";
        }
        // double tap: enable looping (while current source exists)
        if (this.clickCount === 2 && this.src) {
          this.src.loop = true;
        }
        break;
    }
  }

  _play(loop = false) {
    if (!this.trimmedBuffer || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.trimmedBuffer;
    src.connect(this.ctx.destination);
    src.loop = loop;

    src.onended = () => {
      if (this.src === src) this.src = null;
      this.button.innerHTML = "Played";
      this.recordingState = "recorded";
    };

    src.start();
    this.src = src;
  }
}

const recorder = new Recorder("btn");
const recorder1 = new Recorder("btn1");
const recorder2 = new Recorder("btn2");
const recorder3 = new Recorder("btn3");
