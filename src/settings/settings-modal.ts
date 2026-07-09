import type { PadSettings } from "@/pad/pad.js";
import type { Pad } from "@/pad/pad.js";
import { signal, effect } from "@/signals.js";

export const settingsPressed = signal(false);
export const selectedPad = signal<number | null>(null);

const checkbox = (name: string, label: string, checked: boolean) =>
  `<label>${label}<input type="checkbox" name="${name}"${checked ? " checked" : ""}></label>`;

function getFilledTemplate(pad: Pad) {
  const s = pad.getSettings();
  return `
    <form method="dialog">
      <div style="display: flex; flex-direction: column;">
        ${checkbox("loopable", "Loopable", s.loopable)}
        ${checkbox("recordSyncStart", "Record sync start", s.recordSyncStart)}
        ${checkbox("recordSyncEnd", "Record sync end", s.recordSyncEnd)}
        ${checkbox("playSyncStart", "Play sync start", s.playSyncStart)}
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
    recordSyncEnd: data.has("recordSyncEnd"),
    playSyncStart: data.has("playSyncStart"),
    audioThreshold: Number(data.get("audioThreshold")),
    thresholdStart: data.has("thresholdStart"),
    thresholdEnd: data.has("thresholdEnd"),
    volume: Number(data.get("volume")),
  };
}

export class SettingsModal {
  private dialog: HTMLDialogElement;

  constructor(settingsModalId: string, settingsButtonId: string, pads: Record<number, Pad>) {
    this.dialog = document.getElementById(settingsModalId) as HTMLDialogElement;

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
    this.dialog.innerHTML = getFilledTemplate(pad);
    this.dialog.showModal();

    const form = this.dialog.querySelector("form");
    form.addEventListener("input", () => {
      pad.setSettings(readSettings(form));
    });
  }
}
