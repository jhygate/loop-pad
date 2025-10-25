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