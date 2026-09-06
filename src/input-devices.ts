const sources = new Map<string, MediaStreamAudioSourceNode>();
const pending = new Map<string, Promise<MediaStreamAudioSourceNode | null>>();

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === "audioinput");
  } catch (e) {
    console.error("could not enumerate audio inputs", e);
    return [];
  }
}

export function getCachedInputSource(deviceId: string): MediaStreamAudioSourceNode | null {
  return sources.get(deviceId) ?? null;
}

export function ensureInputSource(
  audioContext: AudioContext,
  deviceId: string,
): Promise<MediaStreamAudioSourceNode | null> {
  if (!deviceId) return Promise.resolve(null);

  const cached = sources.get(deviceId);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(deviceId);
  if (inFlight) return inFlight;

  const acquisition = navigator.mediaDevices
    .getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    .then(stream => {
      const source = audioContext.createMediaStreamSource(stream);
      sources.set(deviceId, source);
      return source;
    })
    .catch(e => {
      console.error(`could not open input device ${deviceId}`, e);
      return null;
    })
    .finally(() => {
      pending.delete(deviceId);
    });

  pending.set(deviceId, acquisition);
  return acquisition;
}

navigator.mediaDevices.addEventListener?.("devicechange", () => {
  for (const [deviceId, source] of sources) {
    const tracks = source.mediaStream.getAudioTracks();
    if (tracks.every(track => track.readyState === "ended")) sources.delete(deviceId);
  }
});
