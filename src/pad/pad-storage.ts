import { PadSettings, DEFAULT_PAD_SETTINGS } from "./pad-settings.js";
import { logger } from "../debug/logger.js";

const DB_NAME = "LoopPadDB";
const DB_VERSION = 1;
const STORE_NAME = "recorders";

interface StorableAudioBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  channels: number[][];
}

interface StoredPadData {
  id: number;
  settings: PadSettings;
  audioBuffer: StorableAudioBuffer | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function audioBufferToStorable(buffer: AudioBuffer): StorableAudioBuffer {
  const channels: number[][] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(Array.from(buffer.getChannelData(i)));
  }
  return {
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    numberOfChannels: buffer.numberOfChannels,
    channels,
  };
}

function storableToAudioBuffer(
  storable: StorableAudioBuffer,
  audioContext: AudioContext
): AudioBuffer {
  const buffer = audioContext.createBuffer(
    storable.numberOfChannels,
    storable.length,
    storable.sampleRate
  );
  for (let i = 0; i < storable.numberOfChannels; i++) {
    buffer.getChannelData(i).set(storable.channels[i]);
  }
  return buffer;
}

export class PadStorage {
  constructor(private index: number) {}

  async save(settings: PadSettings, audioBuffer: AudioBuffer | null): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const data: StoredPadData = {
        id: this.index,
        settings,
        audioBuffer: audioBuffer ? audioBufferToStorable(audioBuffer) : null,
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.put(data);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      logger.log("storage", this.index, `saved — hasAudio: ${audioBuffer !== null}`);
    } catch (err) {
      console.error(`PadStorage[${this.index}]: save failed`, err);
      logger.log("storage", this.index, `save failed: ${err}`);
    }
  }

  async load(
    audioContext: AudioContext
  ): Promise<{ settings: PadSettings; audioBuffer: AudioBuffer | null } | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      const data: StoredPadData | undefined = await new Promise((resolve, reject) => {
        const req = store.get(this.index);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!data) {
        logger.log("storage", this.index, "no saved data");
        return null;
      }

      const audioBuffer = data.audioBuffer
        ? storableToAudioBuffer(data.audioBuffer, audioContext)
        : null;

      // Merge with defaults so any new settings added since last save get sane values
      const settings: PadSettings = { ...DEFAULT_PAD_SETTINGS, ...data.settings };

      logger.log("storage", this.index, `loaded — hasAudio: ${audioBuffer !== null}`);
      return { settings, audioBuffer };
    } catch (err) {
      console.error(`PadStorage[${this.index}]: load failed`, err);
      logger.log("storage", this.index, `load failed: ${err}`);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(this.index);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      logger.log("storage", this.index, "cleared");
    } catch (err) {
      console.error(`PadStorage[${this.index}]: clear failed`, err);
    }
  }

  // Returns a plain serialisable object for JSON export
  async exportData(): Promise<StoredPadData | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      return await new Promise((resolve, reject) => {
        const req = store.get(this.index);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error(`PadStorage[${this.index}]: exportData failed`, err);
      return null;
    }
  }

  // Writes raw exported data back — used during JSON import
  async importData(data: StoredPadData): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.put({ ...data, id: this.index });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error(`PadStorage[${this.index}]: importData failed`, err);
    }
  }
}
