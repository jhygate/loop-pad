import {
  PadStateMachine,
  PadState,
  PadEvent,
  ControllerPadEvent
} from "./pad-state-machine.js";
import type { PadSettings } from "./pad-settings.js";
import { PadViewHandler } from "./pad-view.js";
import {
  DOUBLE_CLICK_TIME,
  HOLD_TO_DELETE_TIME,
} from "./pad-constants.js";
import { PadAudioHandler } from "./pad-audio.js";


import { GlobalState } from "../script.js";

export type PadContext = {
  settingsPressed: boolean;
  settings: PadSettings;
};

//ToDo:
// - Implement View (Icons, animation handling)
// - Implement StateActioner (SyncActioner, AudioActioner)
// - Implement Settings

export class Pad {
  private stateMachine: PadStateMachine;
  private viewHandler: PadViewHandler;
  private audioHandler: PadAudioHandler;

  private settings: PadSettings;

  private htmlElement: HTMLElement;

  private holdTimerId: number;
  private holdStartTime: number | null;

  private clickCount: number;

  private globalState: GlobalState

  constructor(buttonId: string, stream: MediaStream, audioContext: AudioContext, globalState: GlobalState) {
    this.stateMachine = new PadStateMachine();

    this.htmlElement = document.getElementById(buttonId);
    this.viewHandler = new PadViewHandler(this.htmlElement);

    this.audioHandler = new PadAudioHandler(stream, audioContext, this.htmlElement);

    this.holdTimerId = -1;
    this.clickCount = 0;
    this.holdStartTime = null;

    this.settings = {
      recordSyncStart: false,
      recordSyncEnd: false,
      playSyncStart: false,
      playingPressBehavior: "stop",
      loopable: true,

    }
    this.globalState = globalState;

    this.bindUI();
    this.setupListeners();
    this.render();
  }

  public get state(): PadState {
    return this.stateMachine.state;
  }

  public get looping(): boolean {
    return this.stateMachine.looping;
  }


  private bindUI() {
    this.htmlElement.addEventListener("pointerdown", () => {
      this.clickCount += 1;
      this.holdStartTime = performance.now();
      this.render();

      setTimeout(() => {
        this.clickCount = 0;
      }, DOUBLE_CLICK_TIME);

      this.holdTimerId = setTimeout(() => {
        this.transitionState("held");
      }, HOLD_TO_DELETE_TIME);
    });

    this.htmlElement.addEventListener("pointerup", () => {
      const wasHeld = this.holdStartTime !== null
        && performance.now() - this.holdStartTime >= HOLD_TO_DELETE_TIME;
      this.holdStartTime = null;
      clearTimeout(this.holdTimerId);

      if (wasHeld) {
        this.render();
        return;
      }

      if (this.globalState.settingsPressed) {
        this.render();
        document.dispatchEvent(new CustomEvent("open-pad-settings", {
          detail: {
            settings: this.settings,
            onSave: (updated: PadSettings) => {
              this.settings = updated;
              this.render();
            }
          }
        }));
        return;  // don't fall through to normal press logic
      }
      if (this.clickCount == 1) {
        this.transitionState("press");
      } else if (this.clickCount == 2) {
        this.transitionState("double-press");
      }
    });

    this.htmlElement.addEventListener("pointercancel", () => {
      this.holdStartTime = null;
      clearTimeout(this.holdTimerId);
      this.render();
    });
  }

  private setupListeners() {
    this.htmlElement.addEventListener('pad-update', (e: Event) => {
      const customEvent = e as CustomEvent<ControllerPadEvent>;
      this.transitionState(customEvent.detail);
    });

    document.addEventListener('global-state-update', () => {
      this.render();
    });
  }

  private transitionState(event: PadEvent) {
    const padContext: PadContext = {
      settingsPressed: this.globalState.settingsPressed,
      settings: this.settings,
    };

    const prevState = this.state;
    this.stateMachine.transition(event, padContext);
    if (this.state !== prevState) {
      this.audioHandler.handleStateChange(this.state);
    }
    this.render();
  }

  public render() {
    this.viewHandler.render({
      padNumber: 1,
      state: this.state,
      looping: this.looping,
      progress: 0,
      settingsPressed: this.globalState.settingsPressed,
      holdStartTime: this.holdStartTime,
      settings: this.settings,
    });
  }
}
