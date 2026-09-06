export async function getStream(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    console.error("getUserMedia not supported in this browser");
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  } catch (err) {
    console.error("Could not get mic stream:", err);
    return null;
  }
}

export type TrimOptions = {
  threshold: number;
  trimStart: boolean;
  trimEnd: boolean;
};

export function trimBuffer(
  buffer: AudioBuffer,
  audioContext: AudioContext,
  opts: TrimOptions,
): AudioBuffer {
  if (!opts.trimStart && !opts.trimEnd) return buffer;

  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const peak = peakAmplitude(channels);
  if (peak === 0) return buffer;
  const cutoff = peak * opts.threshold;

  const audible = (i: number) =>
    channels.some(ch => Math.abs(ch[i]) > cutoff);

  let start = 0;
  let end = buffer.length;

  if (opts.trimStart) {
    while (start < end && !audible(start)) start++;
  }
  if (opts.trimEnd) {
    while (end > start && !audible(end - 1)) end--;
  }

  const newLength = end - start;
  if (newLength <= 0) return buffer;

  const trimmed = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate,
  );
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    trimmed.copyToChannel(buffer.getChannelData(c).subarray(start, end), c);
  }
  return trimmed;
}

export function extractAligned(
  buffer: AudioBuffer,
  audioContext: AudioContext,
  startOffsetSec: number,
  lengthSamples: number,
): AudioBuffer {
  const rate = buffer.sampleRate;
  const startSample = Math.round(startOffsetSec * rate);
  const out = audioContext.createBuffer(buffer.numberOfChannels, lengthSamples, rate);
  const from = Math.max(0, startSample);
  const to = Math.min(buffer.length, startSample + lengthSamples);
  if (to > from) {
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      out.copyToChannel(buffer.getChannelData(c).subarray(from, to), c, from - startSample);
    }
  }
  return out;
}

export function computeMaxGain(buffer: AudioBuffer): number {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  const peak = peakAmplitude(channels);
  return peak > 0 ? 1 / peak : 1;
}

function peakAmplitude(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

export function refineOnset(
  buffer: AudioBuffer,
  fromSample: number,
  thresholdLinear: number,
  maxBackSamples: number,
): number {
  const channel = buffer.getChannelData(0);
  const hop = 64;
  let pos = Math.min(Math.max(0, fromSample), buffer.length);
  const limit = Math.max(0, pos - maxBackSamples);
  while (pos > limit) {
    const from = Math.max(limit, pos - hop);
    let peak = 0;
    for (let i = from; i < pos; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > peak) peak = abs;
    }
    if (peak <= thresholdLinear) return pos;
    pos = from;
  }
  return pos;
}
