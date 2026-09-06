import type { PadSettings } from "@/pad/pad.js";

const DB_NAME = "loop-pad";
const RECORDINGS_STORE = "recordings";
const PAD_KEY_PREFIX = "loop-pad.pad.";
const METRONOME_KEY = "loop-pad.metronome";

export type StoredAudio = {
  sampleRate: number;
  length: number;
  channels: Float32Array<ArrayBuffer>[];
};

export type StoredPadState = {
  settings: PadSettings;
  looping: boolean;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(RECORDINGS_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecording(padId: number, buffer: AudioBuffer | null): Promise<void> {
  try {
    const db = await openDb();
    const store = db.transaction(RECORDINGS_STORE, "readwrite").objectStore(RECORDINGS_STORE);
    if (!buffer) {
      await requestDone(store.delete(padId));
      return;
    }
    const channels: Float32Array<ArrayBuffer>[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }
    await requestDone(store.put({ sampleRate: buffer.sampleRate, length: buffer.length, channels }, padId));
  } catch (e) {
    console.warn("could not save recording for pad", padId, e);
  }
}

export async function loadRecordings(): Promise<Map<number, StoredAudio>> {
  try {
    const db = await openDb();
    const store = db.transaction(RECORDINGS_STORE, "readonly").objectStore(RECORDINGS_STORE);
    const keys = await requestDone(store.getAllKeys());
    const values: StoredAudio[] = await requestDone(store.getAll());
    const recordings = new Map<number, StoredAudio>();
    keys.forEach((key, i) => recordings.set(Number(key), values[i]));
    return recordings;
  } catch (e) {
    console.warn("could not load recordings", e);
    return new Map();
  }
}

export function rebuildBuffer(audioContext: AudioContext, stored: StoredAudio): AudioBuffer {
  const buffer = audioContext.createBuffer(stored.channels.length, stored.length, stored.sampleRate);
  stored.channels.forEach((channel, c) => buffer.copyToChannel(channel, c));
  return buffer;
}

export function savePadState(padId: number, state: StoredPadState) {
  try {
    localStorage.setItem(PAD_KEY_PREFIX + padId, JSON.stringify(state));
  } catch (e) {
    console.warn("could not save state for pad", padId, e);
  }
}

export function loadPadState(padId: number): Partial<StoredPadState> | null {
  try {
    const raw = localStorage.getItem(PAD_KEY_PREFIX + padId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMetronome(state: { bpm: number; beatsPerBar: number }) {
  try {
    localStorage.setItem(METRONOME_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("could not save metronome state", e);
  }
}

export function loadMetronome(): { bpm: number; beatsPerBar: number } | null {
  try {
    const raw = localStorage.getItem(METRONOME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed.bpm) || !Number.isFinite(parsed.beatsPerBar)) return null;
    return { bpm: parsed.bpm, beatsPerBar: parsed.beatsPerBar };
  } catch {
    return null;
  }
}
