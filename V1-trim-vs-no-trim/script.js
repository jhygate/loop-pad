let recordingState = "not-recording";
let constraintObj = {
  audio: true,
  video: false,
};

function handleButtonPress(mediaRecorder) {
  switch (recordingState) {
    case "not-recording":
      console.log("UPDATE");
      recordingState = "recording";
      mediaRecorder.start();
      document.getElementById("btn").innerHTML = "Recording";
      break;
    case "recording":
      recordingState = "recorded";
      mediaRecorder.stop();
      document.getElementById("btn").innerHTML = "Recorded";
  }
}

function handlePlayButtonPress(ctx, trimmedBuffer, currentSrcRef) {
  // stop currently playing source if one exists
  if (currentSrcRef.src) {
    try {
      currentSrcRef.src.stop();
    } catch {}
    currentSrcRef.src.disconnect();
    currentSrcRef.src = null;
  }

  const src = ctx.createBufferSource();
  src.buffer = trimmedBuffer;
  src.connect(ctx.destination);

  src.onended = () => {
    if (currentSrcRef.src === src) currentSrcRef.src = null;
  };

  src.start();
  currentSrcRef.src = src;
}

function trimBuffer(buffer, ctx, thr = 0.02) {
  const { numberOfChannels, sampleRate, length } = buffer;
  let start = 0,
    end = length - 1;
  const silent = (i) => {
    for (let c = 0; c < numberOfChannels; c++)
      if (Math.abs(buffer.getChannelData(c)[i]) >= thr) return false;
    return true;
  };
  while (start < end && silent(start)) start++;
  while (end > start && silent(end)) end--;

  const frames = Math.max(1, end - start + 1);
  const out = ctx.createBuffer(numberOfChannels, frames, sampleRate);
  for (let c = 0; c < numberOfChannels; c++) {
    out
      .getChannelData(c)
      .set(buffer.getChannelData(c).subarray(start, end + 1));
  }
  return out;
}

navigator.mediaDevices
  .getUserMedia(constraintObj)
  .then(function (mediaStreamObj) {
    let audioFull = document.getElementById("audioFull");
    let playAudioTrimmed = document.getElementById("playbtn");
    let btn = document.getElementById("btn");

    let mediaRecorder = new MediaRecorder(mediaStreamObj);
    let chunks = [];
    let ctx = null;
    const currentSrcRef = { src: null }; // mutable ref object for current source

    btn.addEventListener("click", (ev) => {
      handleButtonPress(mediaRecorder);
    });

    mediaRecorder.ondataavailable = function (ev) {
      chunks.push(ev.data);
    };

    mediaRecorder.onstop = async (ev) => {
      let blob = new Blob(chunks, { type: "audio/mp4;" });
      chunks = [];
      let audioURL = window.URL.createObjectURL(blob);
      audioFull.src = audioURL;

      const arrayBuffer = await blob.arrayBuffer();
      ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      trimmedBuffer = trimBuffer(audioBuffer, ctx, 0.02);
      playAudioTrimmed.addEventListener("click", async (ev) => {
        handlePlayButtonPress(ctx, trimmedBuffer, currentSrcRef);
      });
    };
  })
  .catch(function (err) {
    console.log(err.name, err.message);
  });
