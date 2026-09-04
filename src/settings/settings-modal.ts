import type { PadSettings } from "@/pad/pad.js";
import type { Pad } from "@/pad/pad.js";
import { RECORDING_STATES } from "@/pad/pad.js";
import { signal, effect } from "@/signals.js";

export const settingsPressed = signal(false);
export const selectedPad = signal<number | null>(null);

type SettingsField =
  | { kind: "checkbox"; name: keyof PadSettings; label: string }
  | { kind: "number"; name: keyof PadSettings; label: string; step: number; min?: number }
  | { kind: "select"; name: keyof PadSettings; label: string; options: { value: string; label: string }[] };

const FIELDS: SettingsField[] = [
  { kind: "checkbox", name: "loopable", label: "Loopable" },
  { kind: "checkbox", name: "recordSyncStart", label: "Record sync start" },
  { kind: "number", name: "recordSyncStartThresholdMs", label: "Record sync start threshold (ms)", step: 10, min: 0 },
  { kind: "checkbox", name: "recordSyncEnd", label: "Record sync end" },
  { kind: "number", name: "recordSyncEndThresholdMs", label: "Record sync end threshold (ms)", step: 10, min: 0 },
  { kind: "checkbox", name: "playSyncStart", label: "Play sync start" },
  { kind: "number", name: "playSyncStartThresholdMs", label: "Play sync start threshold (ms)", step: 10, min: 0 },
  {
    kind: "select", name: "playingPressBehavior", label: "Play behavior",
    options: [{ value: "stop", label: "Stop" }, { value: "restart", label: "Restart" }],
  },
  { kind: "number", name: "audioThreshold", label: "Audio threshold", step: 0.01 },
  { kind: "checkbox", name: "thresholdStart", label: "Threshold start" },
  { kind: "checkbox", name: "thresholdEnd", label: "Threshold end" },
];

function fieldMarkup(field: SettingsField, settings: PadSettings): string {
  const value = settings[field.name];

  switch (field.kind) {
    case "checkbox":
      return `<label>${field.label}<input type="checkbox" name="${field.name}"${value ? " checked" : ""}></label>`;
    case "number":
      return `<label>${field.label}
          <input type="number" name="${field.name}" step="${field.step}"${field.min === undefined ? "" : ` min="${field.min}"`} value="${value}">
        </label>`;
    case "select":
      return `<label>${field.label}
          <select name="${field.name}">
            ${field.options.map(option =>
        `<option value="${option.value}"${value === option.value ? " selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>`;
  }
}

function getFilledTemplate(pad: Pad, allPadIds: number[]) {
  const s = pad.getSettings();
  const peerCheckboxes = allPadIds
    .filter(id => id !== pad.id)
    .map(id => `<label><input type="checkbox" name="recordSource" value="${id}"${s.recordSources.includes(id) ? " checked" : ""}> Pad ${id}</label>`)
    .join("");

  return `
    <form method="dialog">
      <div style="display: flex; flex-direction: column;">
        ${FIELDS.map(field => fieldMarkup(field, s)).join("")}
        <label>Volume
          <input type="range" name="volume" min="0" max="${pad.maxVolume}" step="0.01" value="${s.volume}">
        </label>
        <fieldset data-role="record-sources">
          <legend>Record from</legend>
          <label>Microphone<input type="checkbox" name="recordMic"${s.recordMic ? " checked" : ""}></label>
          ${peerCheckboxes}
        </fieldset>
        <button>Close</button>
      </div>
    </form>
  `;
}

function readSettings(form: HTMLFormElement): PadSettings {
  const data = new FormData(form);
  const settings: Record<string, unknown> = {};

  for (const field of FIELDS) {
    switch (field.kind) {
      case "checkbox":
        settings[field.name] = data.has(field.name);
        break;
      case "number":
        settings[field.name] = Number(data.get(field.name));
        break;
      case "select":
        settings[field.name] = data.get(field.name);
        break;
    }
  }

  settings.volume = Number(data.get("volume"));
  settings.recordMic = data.has("recordMic");
  settings.recordSources = data.getAll("recordSource").map(v => Number(v));
  return settings as PadSettings;
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
