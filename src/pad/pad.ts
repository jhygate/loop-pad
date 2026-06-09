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
  private held: boolean;

  private clickCount: number;

  private globalState: GlobalState

  constructor(buttonId: string, stream: MediaStream, audioContext: AudioContext, globalState: GlobalState) {
    this.stateMachine = new PadStateMachine();

    this.htmlElement = document.getElementById(buttonId);
    this.viewHandler = new PadViewHandler(this.htmlElement);

    this.audioHandler = new PadAudioHandler(stream, audioContext, this.htmlElement);

    this.holdTimerId = -1;
    this.clickCount = 0;
    this.held = false;

    this.settings = {
      recordSyncStart: false,
      recordSyncEnd: false,
      playSyncStart: false,
      playingPressBehavior: "stop",
      loopable: false

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

      setTimeout(() => {
        this.clickCount = 0;
      }, DOUBLE_CLICK_TIME);

      this.holdTimerId = setTimeout(() => {
        this.held = true;
        this.transitionState("held");
      }, HOLD_TO_DELETE_TIME);
    });

    this.htmlElement.addEventListener("pointerup", () => {
      if (this.held) {
        this.held = false;
        return;
      }

      clearTimeout(this.holdTimerId);

      if (this.globalState.settingsPressed) {
        document.dispatchEvent(new CustomEvent("open-pad-settings", {
          detail: {
            settings: this.settings,
            onSave: (updated: PadSettings) => {
              this.settings = updated;
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

    this.stateMachine.transition(event, padContext);
    this.audioHandler.handleStateChange(this.state);
    this.render();
  }

  public render() {
    this.viewHandler.render(this.state, this.globalState.settingsPressed);
  }
}
