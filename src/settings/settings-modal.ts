import type { PadSettings } from "../pad/pad-settings.js";

const checked = (val: boolean) => val ? "checked" : "";

function getFilledTemplate(s: PadSettings): string {
  return `
    <div class="settings-container">
      <div class="settings-header">
        <h1>Pad Settings</h1>
        <button type="button" class="close-btn" value="cancel">×</button>
      </div>

      <form id="settings-form" method="dialog">
        <div class="settings-section">
          <h2>Playback Options</h2>
          <div class="setting-row">
            <input type="checkbox" id="loopable" name="loopable" class="checkbox" ${checked(s.loopable)}>
            <label for="loopable">Loopable (double-tap to toggle loop)</label>
          </div>
          <div class="setting-row">
            <span class="label-text">Press while playing:</span>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="playingPressBehavior" value="stop" ${checked(s.playingPressBehavior === "stop")}>
                <span>Stop</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="playingPressBehavior" value="restart" ${checked(s.playingPressBehavior === "restart")}>
                <span>Restart</span>
              </label>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h2>Audio Trimming</h2>
          <div class="setting-row">
            <input type="checkbox" id="trimAudio" name="trimAudio" class="checkbox" ${checked(s.trimAudio)}>
            <label for="trimAudio">Enable Audio Trimming</label>
          </div>
          <div class="setting-row indent-1">
            <label for="trimThreshold">Threshold</label>
            <input type="number" id="trimThreshold" name="trimThreshold" class="input-field"
              step="0.01" min="0" max="1" value="${s.trimThreshold}">
          </div>
          <div class="setting-row indent-1">
            <input type="checkbox" id="trimAudioLeft" name="trimAudioLeft" class="checkbox" ${checked(s.trimAudioLeft)}>
            <label for="trimAudioLeft">Trim Start</label>
          </div>
          <div class="setting-row indent-1">
            <input type="checkbox" id="trimAudioRight" name="trimAudioRight" class="checkbox" ${checked(s.trimAudioRight)}>
            <label for="trimAudioRight">Trim End</label>
          </div>
        </div>

        <div class="settings-section">
          <h2>Loop Synchronisation</h2>
          <div class="setting-row">
            <input type="checkbox" id="loopSync" name="loopSync" class="checkbox" ${checked(s.loopSync)}>
            <label for="loopSync">Enable Loop Sync</label>
          </div>
          <div class="setting-row indent-1">
            <label for="syncThreshold">Sync Threshold (ms)</label>
            <input type="number" id="syncThreshold" name="syncThreshold" class="input-field"
              step="100" min="0" value="${s.syncThreshold}">
          </div>
          <div class="setting-row indent-2">
            <input type="checkbox" id="recordSyncStart" name="recordSyncStart" class="checkbox" ${checked(s.recordSyncStart)}>
            <label for="recordSyncStart">Sync Record Start</label>
          </div>
          <div class="setting-row indent-2">
            <input type="checkbox" id="recordSyncEnd" name="recordSyncEnd" class="checkbox" ${checked(s.recordSyncEnd)}>
            <label for="recordSyncEnd">Sync Record End</label>
          </div>
          <div class="setting-row indent-2">
            <input type="checkbox" id="playSyncStart" name="playSyncStart" class="checkbox" ${checked(s.playSyncStart)}>
            <label for="playSyncStart">Sync Play Start</label>
          </div>
        </div>

      </form>
    </div>
  `;
}

export class SettingsModal {
  private dialog: HTMLDialogElement;

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;

    // Close button is rendered inside the dialog each time, so delegate
    this.dialog.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("close-btn")) {
        this.dialog.close("cancel");
      }
    });
  }

  open(settings: PadSettings, onSave: (updated: PadSettings) => void) {
    this.dialog.innerHTML = getFilledTemplate(settings);
    this.dialog.showModal();

    const form = this.dialog.querySelector("form") as HTMLFormElement;

    const readForm = (): PadSettings => {
      const data = new FormData(form);
      return {
        loopable: data.has("loopable"),
        playingPressBehavior: (data.get("playingPressBehavior") as "stop" | "restart") ?? "stop",
        trimAudio: data.has("trimAudio"),
        trimThreshold: parseFloat(data.get("trimThreshold") as string) || 0.05,
        trimAudioLeft: data.has("trimAudioLeft"),
        trimAudioRight: data.has("trimAudioRight"),
        loopSync: data.has("loopSync"),
        syncThreshold: parseFloat(data.get("syncThreshold") as string) || 20000,
        recordSyncStart: data.has("recordSyncStart"),
        recordSyncEnd: data.has("recordSyncEnd"),
        playSyncStart: data.has("playSyncStart"),
      };
    };

    form.addEventListener("change", () => onSave(readForm()));
  }
}
