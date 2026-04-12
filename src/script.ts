import { Pad } from "./pad/pad.js";
import { SettingsModal } from "./settings/settings-modal.js";

export type GlobalState = {
  settingsPressed: boolean;
};

const PAD_CONFIGS = [
  { id: "btn1", key: "q" },
  { id: "btn2", key: "w" },
  { id: "btn3", key: "e" },
  { id: "btn4", key: "a" },
  { id: "btn5", key: "s" },
  { id: "btn6", key: "d" },
  { id: "btn7", key: "z" },
  { id: "btn8", key: "x" },
  { id: "btn9", key: "c" },
];

class App {
  private pads: Pad[] = [];
  private settingsModal: SettingsModal;
  private globalState: GlobalState = { settingsPressed: false };

  constructor() {
    const audioCtx = new AudioContext();
    const dialogEl = document.getElementById("pad-settings-dialog") as HTMLDialogElement;
    this.settingsModal = new SettingsModal(dialogEl);

    // When a pad requests the settings modal, open it then reset settingsPressed
    document.addEventListener("open-pad-settings", (e: Event) => {
      const { settings, onSave } = (e as CustomEvent).detail;
      this.settingsModal.open(settings, onSave);
      this.globalState.settingsPressed = false;
      document.dispatchEvent(new CustomEvent("global-state-update"));
    });

    // Settings button toggles the "click a pad to configure it" mode
    document.getElementById("settings-button").addEventListener("click", () => {
      this.globalState.settingsPressed = !this.globalState.settingsPressed;
      document.dispatchEvent(new CustomEvent("global-state-update"));
    });

    // Export / Import / Clear
    document.getElementById("export-config").addEventListener("click", () => this.exportProject());
    document.getElementById("import-config").addEventListener("click", () => this.importProject());
    document.getElementById("clear-session").addEventListener("click", () => this.clearAll());

    // Request microphone once — stream is shared across all pads
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
      .then((stream) => {
        PAD_CONFIGS.forEach(({ id, key }, i) => {
          this.pads.push(new Pad(id, stream, audioCtx, this.globalState, this.pads, key, i));
        });
      })
      .catch((err) => console.error("Microphone access denied:", err));
  }

  private async exportProject() {
    try {
      const records = await Promise.all(this.pads.map(p => p.exportData()));
      const payload = {
        version: 2,
        exportDate: new Date().toISOString(),
        pads: records,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `looppad-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Error exporting project.");
    }
  }

  private importProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const payload = JSON.parse(text);

        if (!payload.pads || !Array.isArray(payload.pads)) {
          alert("Invalid project file.");
          return;
        }

        for (let i = 0; i < this.pads.length; i++) {
          if (payload.pads[i]) {
            await this.pads[i].importData(payload.pads[i]);
          }
        }
      } catch (err) {
        console.error("Import failed:", err);
        alert("Error loading project file.");
      }
    };

    input.click();
  }

  private async clearAll() {
    if (!confirm("Clear all pads? This cannot be undone.")) return;
    await Promise.all(this.pads.map(p => p.clearStorage()));
    location.reload();
  }
}

(window as any).app = new App();
