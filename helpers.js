export function trimBuffer(buffer, ctx, thr = 0.02) {
  const { numberOfChannels, sampleRate, length } = buffer;
  let start = 0,
    end = length - 1;
  const silent = (i) => {
    for (let c = 0; c < numberOfChannels; c++)
      if (Math.abs(buffer.getChannelData(c)[i]) >= thr) return false;
    return true;
  };
  while (start < end && silent(start)) start++;
  //   while (end > start && silent(end)) end--;

  const frames = Math.max(1, end - start + 1);
  const out = ctx.createBuffer(numberOfChannels, frames, sampleRate);
  for (let c = 0; c < numberOfChannels; c++) {
    out
      .getChannelData(c)
      .set(buffer.getChannelData(c).subarray(start, end + 1));
  }
  return out;
}

export function getTimeToStart(thresh, recorders) {
  const playingTracks = recorders.filter(
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

