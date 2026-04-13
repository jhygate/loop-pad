export type PadSettings = {
  // Playback
  loopable: boolean;
  playingPressBehavior: "stop" | "restart";

  // Loop Synchronisation
  loopSync: boolean;
  syncThreshold: number;     // ms — only snap to loops ending within this window
  recordSyncStart: boolean;
  recordSyncEnd: boolean;
  playSyncStart: boolean;

  // Audio Trimming
  trimAudio: boolean;
  trimThreshold: number;     // amplitude 0–1 below which a sample is "silent"
  trimAudioLeft: boolean;
  trimAudioRight: boolean;
};

export const DEFAULT_PAD_SETTINGS: PadSettings = {
  loopable: false,
  playingPressBehavior: "stop",

  loopSync: false,
  syncThreshold: 20000,
  recordSyncStart: false,
  recordSyncEnd: false,
  playSyncStart: false,

  trimAudio: false,
  trimThreshold: 0.05,
  trimAudioLeft: false,
  trimAudioRight: false,
};
