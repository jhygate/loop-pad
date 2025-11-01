export class Settings {
  constructor(appState) {
    this.appState = appState;

    this.settingsUIButton = document.getElementById("settings-icon");

    this.setButtonEventListeners();
    this.setFormEventListeners();
  }

  setButtonEventListeners() {
    this.settingsUIButton.addEventListener("click", () => {
      this.appState.settingsClicked = true;
      for (const recorder of this.appState.recorders) {
        recorder.showSettingsIcon();
      }
    });

    // Handle settings form submission
    const settingsForm = document.getElementById("settings-form");
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Prevent page refresh!
      this.appState.settingsModal.close();
    });

    this.appState.settingsModal.addEventListener("close", (e) => {
      if (!this.appState.settingsRecorder) return;
      this.appState.settingsRecorder = null; // Clear reference
      for (const recorder of this.appState.recorders) {
        recorder.showIcon();
      }
    });
  }

  setFormEventListeners() {
    document.getElementById("trim-audio").addEventListener("change", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.trimAudio = e.target.checked;
    });

    document.getElementById("trim-start").addEventListener("change", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.trimAudioLeft = e.target.checked;
    });

    document.getElementById("trim-end").addEventListener("change", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.trimAudioRight = e.target.checked;
    });

    document.getElementById("loop-sync").addEventListener("change", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.loopSync = e.target.checked;
    });

    document
      .getElementById("record-sync-start")
      .addEventListener("change", (e) => {
        if (this.appState.settingsRecorder)
          this.appState.settingsRecorder.recordSyncStart = e.target.checked;
      });

    document
      .getElementById("record-sync-end")
      .addEventListener("change", (e) => {
        if (this.appState.settingsRecorder)
          this.appState.settingsRecorder.recordSyncEnd = e.target.checked;
      });

    document
      .getElementById("play-sync-start")
      .addEventListener("change", (e) => {
        if (this.appState.settingsRecorder)
          this.appState.settingsRecorder.playSyncStart = e.target.checked;
      });

    document.getElementById("loopable").addEventListener("change", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.loopable = e.target.checked;
    });

    document.getElementById("trim-threshold").addEventListener("input", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.trimThreshold =
          parseFloat(e.target.value) || 0;
    });

    document.getElementById("sync-threshold").addEventListener("input", (e) => {
      if (this.appState.settingsRecorder)
        this.appState.settingsRecorder.syncThreshold =
          parseFloat(e.target.value) || 0;
    });

    document.getElementById("press-option").forEach((el) => {
      el.addEventListener("change", (e) => {
        if (this.appState.settingsRecorder && e.target.checked)
          this.appState.settingsRecorder.playingPressOption = e.target.value;
      });
    });
  }
}
