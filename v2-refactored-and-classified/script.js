let recordingState = "not-recording";
let held = false;
let click_count = 0;
let button = document.getElementById("btn");
let chunks = [];
const mediaData = {
  mediaRecorder: null,
  src: null,
  ctx: null,
  trimmedBuffer: null,
};

function resetButton() {
  recordingState = "not-recording";
  button.innerHTML = "Record";
  held = true;
}

async function handleButtonPress(mediaData) {
  switch (recordingState) {
    case "not-recording":
      recordingState = "recording";
      mediaData.mediaRecorder.start();
      button.innerHTML = "Recording";
      break;
    case "recording":
      recordingState = "recorded";
      mediaData.mediaRecorder.stop();
      button.innerHTML = "Recorded";
      break;
    case "recorded":
      button.innerHTML = "Playing";
      handlePlayButtonPress(mediaData);
      recordingState = "playing";
      break;
    case "playing":
      if (click_count === 1) {
        try {
          mediaData.src.stop();
        } catch {}
        mediaData.src.disconnect();
        mediaData.src = null;
        recordingState = "recorded";
      }
      if (click_count === 2) {
        mediaData.src.loop = true;
      }
  }
}

function handlePlayButtonPress(mediaData) {
  const src = mediaData.ctx.createBufferSource();
  src.buffer = mediaData.trimmedBuffer;
  src.connect(mediaData.ctx.destination);

  src.onended = () => {
    if (mediaData.src === src) mediaData.src = null;
    document.getElementById("btn").innerHTML = "Played";
    recordingState = "recorded";
  };
  src.start();
  mediaData.src = src;
}

function handlePlayLoopedButtonPress(mediaData) {
  handlePlayButtonPress(mediaData);
  mediaData.src.loop = true;
}

navigator.mediaDevices
  .getUserMedia({
    audio: true,
    video: false,
  })
  .then(function (mediaStreamObj) {
    mediaData.mediaRecorder = new MediaRecorder(mediaStreamObj);

    mediaData.mediaRecorder.ondataavailable = function (ev) {
      chunks.push(ev.data);
    };

    mediaData.mediaRecorder.onstop = async (_) => {
      let blob = new Blob(chunks, { type: "audio/mp4;" });
      chunks = [];
      const arrayBuffer = await blob.arrayBuffer();
      mediaData.ctx = new AudioContext();
      const audioBuffer = await mediaData.ctx.decodeAudioData(arrayBuffer);
      mediaData.trimmedBuffer = trimBuffer(audioBuffer, mediaData.ctx, 0.02);
    };

    button.onpointerdown = function () {
      click_count += 1;
      timer = setTimeout(resetButton, 600);
      timer2 = setTimeout(() => {
        click_count = 0;
      }, 300);
    };

    button.onpointerup = function () {
      clearTimeout(timer);
      if (!held) {
        handleButtonPress(mediaData);
      } else {
        held = false;
      }
    };
  })
  .catch(function (err) {
    console.log(err.name, err.message);
  });
