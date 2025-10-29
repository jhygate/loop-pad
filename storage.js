// IndexedDB Management for LoopPad
import { playButton, TRIM_THRESH, SYNC_THRESH } from './script.js';

export const DB_NAME = 'LoopPadDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'recorders';

// Initialize IndexedDB
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Convert AudioBuffer to storable format
export function audioBufferToStorable(audioBuffer) {
  if (!audioBuffer) return null;

  const channels = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(Array.from(audioBuffer.getChannelData(i)));
  }

  return {
    sampleRate: audioBuffer.sampleRate,
    length: audioBuffer.length,
    duration: audioBuffer.duration,
    numberOfChannels: audioBuffer.numberOfChannels,
    channels: channels
  };
}

// Convert stored format back to AudioBuffer
export function storableToAudioBuffer(storable, audioContext) {
  if (!storable) return null;

  const audioBuffer = audioContext.createBuffer(
    storable.numberOfChannels,
    storable.length,
    storable.sampleRate
  );

  for (let i = 0; i < storable.numberOfChannels; i++) {
    audioBuffer.getChannelData(i).set(storable.channels[i]);
  }

  return audioBuffer;
}

// Save single recorder to IndexedDB
export async function saveRecorderToIndexedDB(recorder, index) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Only save if there's actual audio recorded
    const hasAudio = recorder.trimmedBuffer != null;

    const data = {
      id: index,
      recordingState: recorder.recordingState,
      loop: recorder.loop,
      trimAudio: recorder.trimAudio,
      trimThreshold: recorder.trimThreshold,
      trimAudioLeft: recorder.trimAudioLeft,
      trimAudioRight: recorder.trimAudioRight,
      loopSync: recorder.loopSync,
      syncThreshold: recorder.syncThreshold,
      recordSyncStart: recorder.recordSyncStart,
      recordSyncEnd: recorder.recordSyncEnd,
      playSyncStart: recorder.playSyncStart,
      loopable: recorder.loopable,
      playingPressOption: recorder.playingPressOption,
      audioBuffer: audioBufferToStorable(recorder.trimmedBuffer),
      hasAudio: hasAudio
    };

    console.log(`Saving recorder ${index}:`, {
      recordingState: data.recordingState,
      hasAudio: data.hasAudio,
      loop: data.loop
    });

    const request = store.put(data);
    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

  } catch (err) {
    console.error('Error saving recorder:', err);
  }
}

// Save all recorders
export async function saveAllRecorders(recorders) {
  try {
    console.log('recorders array:', recorders);
    console.log('recorders.length:', recorders?.length);

    if (!recorders || recorders.length === 0) {
      console.error('Recorders array is not available!');
      alert('Error: Recorders not initialized');
      return;
    }

    for (let i = 0; i < recorders.length; i++) {
      console.log(`Recorder ${i}:`, recorders[i]);
      console.log(`Recorder ${i} recordingState:`, recorders[i]?.recordingState);
      console.log(`Recorder ${i} trimmedBuffer:`, recorders[i]?.trimmedBuffer);
      await saveRecorderToIndexedDB(recorders[i], i);
    }
    console.log('All recorders saved!');
    alert('Session saved successfully!');
  } catch (err) {
    console.error('Error saving all recorders:', err);
    alert('Error saving session');
  }
}

// Load single recorder from IndexedDB
export async function loadRecorderFromIndexedDB(recorder, index) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const request = store.get(index);
    const data = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!data) return false;

    console.log(`Loading recorder ${index}:`, data);
    console.log(`Loading recorder ${index}:`, {
      recordingState: data.recordingState,
      hasAudio: data.hasAudio,
      loop: data.loop
    });

    // Restore settings
    recorder.loop = data.loop || false;
    recorder.trimAudio = data.trimAudio || false;
    recorder.trimThreshold = data.trimThreshold || TRIM_THRESH;
    recorder.trimAudioLeft = data.trimAudioLeft || false;
    recorder.trimAudioRight = data.trimAudioRight || false;
    recorder.loopSync = data.loopSync || false;
    recorder.syncThreshold = data.syncThreshold || SYNC_THRESH;
    recorder.recordSyncStart = data.recordSyncStart || false;
    recorder.recordSyncEnd = data.recordSyncEnd || false;
    recorder.playSyncStart = data.playSyncStart || false;
    recorder.loopable = data.loopable || false;
    recorder.playingPressOption = data.playingPressOption || "stop";

    // Restore audio if it exists (regardless of state - could be playing, recorded, etc.)
    if (data.audioBuffer && data.hasAudio) {
      console.log(`Restoring audio for recorder ${index}`);
      recorder.ctx = new AudioContext();
      recorder.trimmedBuffer = storableToAudioBuffer(data.audioBuffer, recorder.ctx);

      // Set to recorded state (not playing, since we can't resume mid-playback)
      recorder.recordingState = 'recorded';
      recorder.button.innerHTML = playButton;

      console.log(`Recorder ${index} restored with audio, state set to recorded`);
    } else {
      console.log(`No audio to restore for recorder ${index}`);
    }

    return true;
  } catch (err) {
    console.error('Error loading recorder:', err);
    return false;
  }
}

// Load all recorders
export async function loadAllRecorders(recorders) {
  try {
    console.log('loadAllRecorders called, recorders:', recorders);
    let loadedCount = 0;
    for (let i = 0; i < recorders.length; i++) {
      console.log(`About to load recorder ${i}, current state:`, recorders[i].recordingState);
      const loaded = await loadRecorderFromIndexedDB(recorders[i], i);
      console.log(`After loading recorder ${i}, new state:`, recorders[i].recordingState);
      if (loaded) loadedCount++;
    }
    if (loadedCount > 0) {
      console.log(`Loaded ${loadedCount} recorders from storage`);
    }
    console.log('Final recorders state:', recorders);
  } catch (err) {
    console.error('Error loading all recorders:', err);
  }
}

// Clear all saved data
export async function clearAllSavedData() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const request = store.clear();
    await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('All saved data cleared!');
    alert('All saved data cleared!');
  } catch (err) {
    console.error('Error clearing data:', err);
  }
}
