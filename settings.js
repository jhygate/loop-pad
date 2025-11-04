export class Settings {
  constructor(appState) {
    this.appState = appState;

    this.createSettingsDialog();
    this.settingsUIButton = document.getElementById("settings-icon");

    this.setButtonEventListeners();
    this.setFormEventListeners();
  }

  createSettingsDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = "settings";

    dialog.innerHTML = `
      <div class="settings-container">
        <div class="settings-header">
          <h1>Pad Settings</h1>
          <button type="button" class="close-btn" id="settings-close">×</button>
        </div>

        <form id="settings-form">
          <div class="settings-section">
            <h2>Audio Trimming</h2>
            <div class="setting-row">
              <input type="checkbox" id="trim-audio" class="checkbox">
              <label for="trim-audio">Enable Audio Trimming</label>
            </div>
            <div class="setting-row indent-1">
              <label for="trim-threshold">Threshold</label>
              <input type="number" id="trim-threshold" class="input-field" step="0.01" min="0" max="1">
            </div>
            <div class="setting-row indent-1">
              <input type="checkbox" id="trim-start" class="checkbox">
              <label for="trim-start">Trim Start</label>
            </div>
            <div class="setting-row indent-1">
              <input type="checkbox" id="trim-end" class="checkbox">
              <label for="trim-end">Trim End</label>
            </div>
          </div>

          <div class="settings-section">
            <h2>Loop Synchronization</h2>
            <div class="setting-row">
              <input type="checkbox" id="loop-sync" class="checkbox">
              <label for="loop-sync">Enable Loop Sync</label>
            </div>
            <div class="setting-row indent-1">
              <label for="sync-threshold">Sync Threshold (ms)</label>
              <input type="number" id="sync-threshold" class="input-field" step="100" min="0">
            </div>
            <div class="setting-row indent-2">
              <input type="checkbox" id="record-sync-start" class="checkbox">
              <label for="record-sync-start">Record Sync Start</label>
            </div>
            <div class="setting-row indent-2">
              <input type="checkbox" id="record-sync-end" class="checkbox">
              <label for="record-sync-end">Record Sync End</label>
            </div>
            <div class="setting-row indent-2">
              <input type="checkbox" id="play-sync-start" class="checkbox">
              <label for="play-sync-start">Play Sync Start</label>
            </div>
          </div>

          <div class="settings-section">
            <h2>Playback Options</h2>
            <div class="setting-row">
              <input type="checkbox" id="loopable" class="checkbox">
              <label for="loopable">Loopable</label>
            </div>
            <div class="setting-row">
              <span class="label-text">Press to:</span>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" id="press-option-stop" name="press-option" value="stop">
                  <span>Stop</span>
                </label>
                <label class="radio-label">
                  <input type="radio" id="press-option-restart" name="press-option" value="restart">
                  <span>Restart</span>
                </label>
              </div>
            </div>
          </div>

          <div class="settings-footer">
            <button id="settings-submit" type="submit" class="submit-btn">Save Settings</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(dialog);

    // Add close button listener
    dialog.querySelector('#settings-close').addEventListener('click', () => {
      dialog.close();
    });

    // Set the appState reference to the created dialog
    this.appState.settingsModal = dialog;
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

    document.querySelectorAll('input[name="press-option"]').forEach((el) => {
      el.addEventListener("change", (e) => {
        if (this.appState.settingsRecorder && e.target.checked)
          this.appState.settingsRecorder.playingPressOption = e.target.value;
      });
    });
  }
}
