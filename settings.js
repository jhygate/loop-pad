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
      <h1>Settings</h1>
      <form id="settings-form">
        <input type="checkbox" id="trim-audio"> <label for="trim-audio">Trim Audio</label><br>
        <input type="text" id="trim-threshold" style="margin-left: 30px;"> <label for="trim-threshold">Trim Threshold</label><br>
        <input type="checkbox" id="trim-start" style="margin-left: 30px;"> <label for="trim-start">Trim Start</label><br>
        <input type="checkbox" id="trim-end" style="margin-left: 30px;"> <label for="trim-end">Trim End</label><br>
        <br>
        <input type="checkbox" id="loop-sync"> <label for="loop-sync">Loop Sync</label><br>
        <input type="text" id="sync-threshold" style="margin-left: 30px;"> <label for="sync-threshold">(ms) Sync Threshold</label><br>
        <input type="checkbox" id="record-sync-start" style="margin-left: 60px;"> <label for="record-sync-start">Sync Start</label><br>
        <input type="checkbox" id="record-sync-end" style="margin-left: 60px;"> <label for="record-sync-end">Sync End</label><br>
        <input type="checkbox" id="play-sync-start" style="margin-left: 60px;"> <label for="play-sync-start">Sync Start</label><br>
        <br>
        <input type="checkbox" id="loopable"> <label for="loopable">Loopable</label><br>
        Press to
        <input type="radio" id="press-option-stop" name="press-option" value="stop"> <label for="press-option-stop">Stop</label>
        <input type="radio" id="press-option-restart" name="press-option" value="restart"> <label for="press-option-restart">Restart</label>
        <button id="settings-submit" type="submit">Submit</button>
      </form>
    `;

    document.body.appendChild(dialog);

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
