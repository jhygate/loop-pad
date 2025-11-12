import {
  RecorderStateMachine,
  RecorderState,
  RecorderEvent,
} from "./recorder-state-machine";
import { RecorderSettings } from "./recorder-settings";
import { DOUBLE_CLICK_TIME, HOLD_TO_DELETE_TIME } from "./constants";

export type RecorderContext = {
  settingsPressed: boolean;
  looping: boolean;
  settings: RecorderSettings;
};

//ToDo:
// - Implement View (Icons, animation handling)
// - Implement StateActioner (SyncActioner, AudioActioner)
// - Implement Settings
// - Figure out how context (e.g looping is managed, state machine)

export class Recorder {
  private stateMachine: RecorderStateMachine;
  private settings: RecorderSettings;

  private htmlElement: HTMLElement;

  private holdTimerId: number;
  private held: boolean;

  private clickCount: number;

  public looping: boolean;
  private settingsPressed;

  constructor(buttonId: string) {
    this.stateMachine = new RecorderStateMachine();

    this.htmlElement = document.getElementById(buttonId);

    this.holdTimerId = -1;
    this.held = false;

    this.looping = false;
    this.settingsPressed = false;

    this.bindUI();
  }

  public get state(): RecorderState {
    return this.stateMachine.state;
  }

  private bindUI() {
    this.htmlElement.addEventListener("pointerdown", (e) => {
      this.clickCount += 1;

      setTimeout(() => (this.clickCount = 0), DOUBLE_CLICK_TIME);

      this.holdTimerId = setTimeout(() => {
        this.held = true;
        this.transitionState("held");
      }, HOLD_TO_DELETE_TIME);
    });

    this.htmlElement.addEventListener("pointerup", (e) => {
      if (this.held) {
        this.held = false;
        return;
      }

      clearTimeout(this.holdTimerId);
      if (this.clickCount == 1) {
        this.transitionState("press");
      } else if (this.clickCount == 2) {
        this.transitionState("double-press");
      }
    });
  }

  private transitionState(event: RecorderEvent) {
    const recorderContext: RecorderContext = {
      settingsPressed: this.settingsPressed,
      looping: this.looping,
      settings: this.settings,
    };
    this.stateMachine.transition(event, recorderContext);
  }
}
