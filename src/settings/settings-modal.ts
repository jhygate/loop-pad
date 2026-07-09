import type { PadSettings } from "@/pad/pad.js";
import type { Pad } from "@/pad/pad.js";
import { RECORDING_STATES } from "@/pad/pad.js";
import { signal, effect } from "@/signals.js";

export const settingsPressed = signal(false);
export const selectedPad = signal<number | null>(null);

const checkbox = (name: string, label: string, checked: boolean) =>
  `<label>${label}<input type="checkbox" name="${name}"${checked ? " checked" : ""}></label>`;

function getFilledTemplate(pad: Pad, allPadIds: number[]) {
  const s = pad.getSettings();
  const peerCheckboxes = allPadIds
    .filter(id => id !== pad.id)
    .map(id => `<label><input type="checkbox" name="recordSource" value="${id}"${s.recordSources.includes(id) ? " checked" : ""}> Pad ${id}</label>`)
    .join("");

  return `
    <form method="dialog">
      <div style="display: flex; flex-direction: column;">
        ${checkbox("loopable", "Loopable", s.loopable)}
        ${checkbox("recordSyncStart", "Record sync start", s.recordSyncStart)}
        <label>Record sync start threshold (ms)
          <input type="number" name="recordSyncStartThresholdMs" step="10" min="0" value="${s.recordSyncStartThresholdMs}">
        </label>
        ${checkbox("recordSyncEnd", "Record sync end", s.recordSyncEnd)}
        <label>Record sync end threshold (ms)
          <input type="number" name="recordSyncEndThresholdMs" step="10" min="0" value="${s.recordSyncEndThresholdMs}">
        </label>
        ${checkbox("playSyncStart", "Play sync start", s.playSyncStart)}
        <label>Play sync start threshold (ms)
          <input type="number" name="playSyncStartThresholdMs" step="10" min="0" value="${s.playSyncStartThresholdMs}">
        </label>
        <label>Play behavior
          <select name="playingPressBehavior">
            <option value="stop"${s.playingPressBehavior === "stop" ? " selected" : ""}>Stop</option>
            <option value="restart"${s.playingPressBehavior === "restart" ? " selected" : ""}>Restart</option>
          </select>
        </label>
        <label>Audio threshold
          <input type="number" name="audioThreshold" step="0.01" value="${s.audioThreshold}">
        </label>
        ${checkbox("thresholdStart", "Threshold start", s.thresholdStart)}
        ${checkbox("thresholdEnd", "Threshold end", s.thresholdEnd)}
        <label>Volume
          <input type="range" name="volume" min="0" max="${pad.maxVolume}" step="0.01" value="${s.volume}">
        </label>
        <fieldset data-role="record-sources">
          <legend>Record from</legend>
          ${checkbox("recordMic", "Microphone", s.recordMic)}
          ${peerCheckboxes}
        </fieldset>
        <button>Close</button>
      </div>
    </form>
  `;
}

function readSettings(form: HTMLFormElement): PadSettings {
  const data = new FormData(form);
  return {
    loopable: data.has("loopable"),
    playingPressBehavior: data.get("playingPressBehavior") as "stop" | "restart",
    recordSyncStart: data.has("recordSyncStart"),
    recordSyncStartThresholdMs: Number(data.get("recordSyncStartThresholdMs")),
    recordSyncEnd: data.has("recordSyncEnd"),
    recordSyncEndThresholdMs: Number(data.get("recordSyncEndThresholdMs")),
    playSyncStart: data.has("playSyncStart"),
    playSyncStartThresholdMs: Number(data.get("playSyncStartThresholdMs")),
    audioThreshold: Number(data.get("audioThreshold")),
    thresholdStart: data.has("thresholdStart"),
    thresholdEnd: data.has("thresholdEnd"),
    volume: Number(data.get("volume")),
    recordMic: data.has("recordMic"),
    recordSources: data.getAll("recordSource").map(v => Number(v)),
  };
}

export class SettingsModal {
  private dialog: HTMLDialogElement;
  private padIds: number[];

  constructor(settingsModalId: string, settingsButtonId: string, pads: Record<number, Pad>) {
    this.dialog = document.getElementById(settingsModalId) as HTMLDialogElement;
    this.padIds = Object.keys(pads).map(Number);

    effect(() => {
      if (selectedPad.value == null) return
      settingsPressed.value = false;

      const pad = pads[selectedPad.value];
      if (!pad) throw new Error(`Unknown pad id: ${selectedPad.value}`);

      this.open(pad);

    })

    const button = document.getElementById(settingsButtonId);
    button.addEventListener("click", () => {
      settingsPressed.value = true;
    });
  }



  open(pad: Pad) {
    this.dialog.innerHTML = getFilledTemplate(pad, this.padIds);
    this.dialog.showModal();

    const form = this.dialog.querySelector("form");
    form.addEventListener("input", () => {
      pad.setSettings(readSettings(form));
    });

    const volume = form.querySelector<HTMLInputElement>('input[name="volume"]');
    const recordSources = form.querySelector<HTMLFieldSetElement>('fieldset[data-role="record-sources"]');
    effect(() => {
      const disabled = RECORDING_STATES.includes(pad.stateSignal.value);
      volume.disabled = disabled;
      recordSources.disabled = disabled;
    });
  }
}
