import { PadState } from "./pad-state-machine.js";
import {
  emptyTemplate,
  recordingTemplate,
  recordedTemplate,
  playingTemplate,
  settingsTemplate,
  waitingTemplate,
  HOLD_TO_DELETE_TIME,
} from "./pad-constants.js";

const ALL_STATE_CLASSES = ["recording", "has-audio", "playing", "waiting"] as const;

export class PadViewHandler {
  constructor(private htmlElement: HTMLElement) {
    // Set the CSS var for the hold-to-delete animation once at construction
    this.htmlElement.style.setProperty("--delete-time", `${HOLD_TO_DELETE_TIME}ms`);
  }

  public render(
    state: PadState,
    looping: boolean,
    settingsPressed: boolean,
    padNumber: number
  ): void {
    // Clear all state classes then apply only the relevant ones for this state
    ALL_STATE_CLASSES.forEach(cls => this.htmlElement.classList.remove(cls));

    if (settingsPressed) {
      this.htmlElement.innerHTML = settingsTemplate(padNumber);
      return;
    }

    switch (state) {
      case "empty":
        this.htmlElement.innerHTML = emptyTemplate(padNumber);
        break;

      case "recording":
        this.htmlElement.innerHTML = recordingTemplate(padNumber);
        this.htmlElement.classList.add("recording");
        break;

      case "waiting-to-record":
        this.htmlElement.innerHTML = waitingTemplate(padNumber, "Waiting...");
        this.htmlElement.classList.add("waiting");
        break;

      case "recorded":
        this.htmlElement.innerHTML = recordedTemplate(padNumber, looping);
        this.htmlElement.classList.add("has-audio");
        break;

      case "waiting-to-end-recording":
        this.htmlElement.innerHTML = waitingTemplate(padNumber, "Waiting...");
        this.htmlElement.classList.add("waiting", "has-audio");
        break;

      case "playing":
        this.htmlElement.innerHTML = playingTemplate(padNumber, looping);
        this.htmlElement.classList.add("playing", "has-audio");
        break;

      case "waiting-to-play":
        this.htmlElement.innerHTML = waitingTemplate(padNumber, "Waiting...");
        this.htmlElement.classList.add("waiting", "has-audio");
        break;
    }
  }

  public startHoldAnimation(): void {
    this.htmlElement.classList.add("holding");
  }

  public stopHoldAnimation(): void {
    this.htmlElement.classList.remove("holding");
  }
}
