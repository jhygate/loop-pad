import { Pad } from "./pad/pad.js";
import { SettingsModal } from "./settings/settings-modal.js";
import { DebugPanel } from "./debug/debug-panel.js";
import { logger } from "./debug/logger.js";

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
    // Debug panel — mounts itself, enables the logger, backtick to toggle
    new DebugPanel();

    const audioCtx = new AudioContext();
    const dialogEl = document.getElementById("pad-settings-dialog") as HTMLDialogElement;
    this.settingsModal = new SettingsModal(dialogEl);

    // When a pad opens the settings modal, flip settingsPressed back off afterwards
    document.addEventListener("open-pad-settings", (e: Event) => {
      const { settings, onSave } = (e as CustomEvent).detail;
      this.settingsModal.open(settings, onSave);
      this.globalState.settingsPressed = false;
      document.dispatchEvent(new CustomEvent("global-state-update"));
    });

    // Settings button toggles "click a pad to configure it" mode
    document.getElementById("settings-button").addEventListener("click", () => {
      this.globalState.settingsPressed = !this.globalState.settingsPressed;
      logger.log("settings", null, `settings mode: ${this.globalState.settingsPressed ? "on" : "off"}`);
      document.dispatchEvent(new CustomEvent("global-state-update"));
    });

    document.getElementById("export-config").addEventListener("click", () => this.exportProject());
    document.getElementById("import-config").addEventListener("click", () => this.importProject());
    document.getElementById("clear-session").addEventListener("click", () => this.clearAll());

    // Microphone requested once — stream shared across all pads
    logger.log("state", null, "requesting microphone");
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
      .then((stream) => {
        logger.log("state", null, `microphone acquired — creating ${PAD_CONFIGS.length} pads`);
        PAD_CONFIGS.forEach(({ id, key }, i) => {
          this.pads.push(new Pad(id, stream, audioCtx, this.globalState, this.pads, key, i));
        });
        logger.log("state", null, "all pads created");
      })
      .catch((err) => {
        logger.log("state", null, `microphone denied: ${err.message}`);
        console.error("Microphone access denied:", err);
      });
  }

  private async exportProject() {
    try {
      logger.log("storage", null, "exporting project");
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
      logger.log("storage", null, "project exported");
    } catch (err) {
      logger.log("storage", null, `export failed: ${err}`);
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

      logger.log("storage", null, `importing project file: ${file.name}`);
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
        logger.log("storage", null, "project imported");
      } catch (err) {
        logger.log("storage", null, `import failed: ${err}`);
        console.error("Import failed:", err);
        alert("Error loading project file.");
      }
    };

    input.click();
  }

  private async clearAll() {
    if (!confirm("Clear all pads? This cannot be undone.")) return;
    logger.log("storage", null, "clearing all pads");
    await Promise.all(this.pads.map(p => p.clearStorage()));
    location.reload();
  }
}

(window as any).app = new App();
