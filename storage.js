// IndexedDB Management for LoopPad
import { PLAYBUTTON, TRIM_THRESH, SYNC_THRESH } from './constants.js';

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
    if (!recorders || recorders.length === 0) {
      console.error('Recorders array is not available!');
      alert('Error: Recorders not initialized');
      return;
    }

    for (let i = 0; i < recorders.length; i++) {
      await saveRecorderToIndexedDB(recorders[i], i);
    }
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

    // Restore audio if it exists
    if (data.audioBuffer && data.hasAudio) {
      recorder.ctx = new AudioContext();
      recorder.trimmedBuffer = storableToAudioBuffer(data.audioBuffer, recorder.ctx);
      recorder.recordingState = 'recorded';
      recorder.button.innerHTML = PLAYBUTTON;
      recorder._updatePadNumber();
      recorder.button.classList.add("has-audio");
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
    for (let i = 0; i < recorders.length; i++) {
      await loadRecorderFromIndexedDB(recorders[i], i);
    }
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

    alert('All saved data cleared!');
  } catch (err) {
    console.error('Error clearing data:', err);
  }
}

// Export configuration to JSON file
export async function exportConfigToFile(recorders) {
  try {
    const config = {
      version: 1,
      exportDate: new Date().toISOString(),
      recorders: []
    };

    for (let i = 0; i < recorders.length; i++) {
      const recorder = recorders[i];
      const recorderData = {
        index: i,
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
        hasAudio: recorder.trimmedBuffer != null
      };
      config.recorders.push(recorderData);
    }

    const jsonString = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `looppad-config-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Configuration exported successfully!');
  } catch (err) {
    console.error('Error exporting config:', err);
    alert('Error exporting configuration');
  }
}

// Import configuration from JSON file
export async function importConfigFromFile(recorders) {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const config = JSON.parse(event.target.result);

          if (!config.version || !config.recorders) {
            alert('Invalid configuration file');
            return;
          }

          for (const recorderData of config.recorders) {
            const index = recorderData.index;
            if (index >= 0 && index < recorders.length) {
              const recorder = recorders[index];

              // Restore settings
              recorder.loop = recorderData.loop || false;
              recorder.trimAudio = recorderData.trimAudio || false;
              recorder.trimThreshold = recorderData.trimThreshold || TRIM_THRESH;
              recorder.trimAudioLeft = recorderData.trimAudioLeft || false;
              recorder.trimAudioRight = recorderData.trimAudioRight || false;
              recorder.loopSync = recorderData.loopSync || false;
              recorder.syncThreshold = recorderData.syncThreshold || SYNC_THRESH;
              recorder.recordSyncStart = recorderData.recordSyncStart || false;
              recorder.recordSyncEnd = recorderData.recordSyncEnd || false;
              recorder.playSyncStart = recorderData.playSyncStart || false;
              recorder.loopable = recorderData.loopable || false;
              recorder.playingPressOption = recorderData.playingPressOption || "stop";

              // Restore audio if it exists
              if (recorderData.audioBuffer && recorderData.hasAudio) {
                recorder.ctx = new AudioContext();
                recorder.trimmedBuffer = storableToAudioBuffer(recorderData.audioBuffer, recorder.ctx);
                recorder.recordingState = 'recorded';
                recorder.button.innerHTML = PLAYBUTTON;
                recorder._updatePadNumber();
                recorder.button.classList.add("has-audio");
              } else {
                // Reset to not-recording state if no audio
                recorder.recordingState = 'not-recording';
                recorder.trimmedBuffer = null;
                recorder.ctx = null;
                recorder.showIcon();
              }

              // Save each imported recorder to IndexedDB
              await saveRecorderToIndexedDB(recorder, index);
            }
          }

          alert('Configuration loaded successfully!');
        } catch (err) {
          console.error('Error parsing config file:', err);
          alert('Error loading configuration file');
        }
      };

      reader.readAsText(file);
    };

    input.click();
  } catch (err) {
    console.error('Error importing config:', err);
    alert('Error importing configuration');
  }
}

// Setup button event listeners - called from script.js after recorders are initialized
export function setupButtonListeners(recorders) {
  const clearButton = document.getElementById('clear-session');
  const exportButton = document.getElementById('export-config');
  const importButton = document.getElementById('import-config');

  if (!clearButton || !exportButton || !importButton) {
    console.error('Buttons not found in DOM!');
    return;
  }

  clearButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      clearAllSavedData();
      // Optionally reload the page to reset everything
      setTimeout(() => location.reload(), 500);
    }
  });

  exportButton.addEventListener('click', () => exportConfigToFile(recorders));
  importButton.addEventListener('click', () => importConfigFromFile(recorders));
}

