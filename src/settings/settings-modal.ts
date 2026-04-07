import type { PadSettings } from "../pad/pad-settings";

function getFilledTemplate(settings: PadSettings) {
  return `

  <form method="dialog">

    <div style="display: flex; flex-direction: column;">
      <label>Loopable
        <input type="checkbox" name="loopable" ${settings.loopable
      ? "checked" : ""}>
      </label>
      <label>recordSyncStart
        <input type="checkbox" name="recordSyncStart" ${settings.recordSyncStart
      ? "checked" : ""}>
      </label>
      <label>RecordSyncEnd
        <input type="checkbox" name="recordSyncEnd" ${settings.recordSyncEnd
      ? "checked" : ""}>
      </label>
      <label>playSyncStart
        <input type="checkbox" name="playSyncStart" ${settings.playSyncStart
      ? "checked" : ""}>
      </label>
      <label>Play behavior
        <select name="playingPressBehavior">
          <option value="stop"    ${settings.playingPressBehavior
      === "stop" ? "selected" : ""}>Stop</option>
          <option value="restart" ${settings.playingPressBehavior
      === "restart" ? "selected" : ""}>Restart</option>
        </select>
      </label>
      <button value="cancel">Cancel</button>
      <button value="confirm">Save</button>
    </div>
  </form>
`;
}

export class SettingsModal {
  private dialog: HTMLDialogElement;

  constructor(dialog: HTMLDialogElement) {
    this.dialog = dialog;
  }

  open(settings: PadSettings, onSave: (updated: PadSettings) =>
    void) {
    this.dialog.innerHTML = getFilledTemplate(settings);
    this.dialog.showModal();

    this.dialog.addEventListener("close", () => {
      if (this.dialog.returnValue === "confirm") {
        const data = new FormData(this.dialog.querySelector("form"))
        const newPadSettings: PadSettings = {
          loopable: data.has("loopable"),
          playingPressBehavior: data.get("playingPressBehavior") as
            "stop" | "restart",
          recordSyncStart: data.has("recordSyncStart"),
          recordSyncEnd: data.has("recordSyncEnd"),
          playSyncStart: data.has("playSyncStart")
        };

        onSave(newPadSettings);
      }
    }, { once: true });
  }
}
