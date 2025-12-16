import {
  RecorderStateMachine,
  RecorderState,
  RecorderEvent,
} from "./recorder-state-machine.js";
import { RecorderSettings } from "./recorder-settings.js";
import { RecorderViewHandler } from "./recorder-view.js";
import {
  DOUBLE_CLICK_TIME,
  HOLD_TO_DELETE_TIME,
} from "./recorder-constants.js";

export type RecorderContext = {
  settingsPressed: boolean;
  looping: boolean;
  settings: RecorderSettings;
};

//ToDo:
// - Implement View (Icons, animation handling)
// - Implement StateActioner (SyncActioner, AudioActioner)
// - Implement Settings

export class Recorder {
  private stateMachine: RecorderStateMachine;
  private viewHandler: RecorderViewHandler;

  private settings: RecorderSettings;

  private htmlElement: HTMLElement;

  private holdTimerId: number;
  private held: boolean;

  private clickCount: number;

  private settingsPressed;

  constructor(buttonId: string) {
    this.stateMachine = new RecorderStateMachine();

    this.htmlElement = document.getElementById(buttonId);
    this.viewHandler = new RecorderViewHandler(this.htmlElement);

    this.holdTimerId = -1;
    this.clickCount = 0;
    this.held = false;

    this.settingsPressed = false;
    this.settings = new RecorderSettings();

    this.bindUI();
    this.render();
  }

  public get state(): RecorderState {
    return this.stateMachine.state;
  }

  public get looping(): boolean {
    return this.stateMachine.looping;
  }

  private bindUI() {
    this.htmlElement.addEventListener("pointerdown", (e) => {
      this.clickCount += 1;

      setTimeout(() => {
        this.clickCount = 0;
        console.log("rest timer");
      }, DOUBLE_CLICK_TIME);

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
      console.log(this.clickCount);

      clearTimeout(this.holdTimerId);
      if (this.clickCount == 1) {
        this.transitionState("press");
      } else if (this.clickCount == 2) {
        this.transitionState("double-press");
      }
    });
  }

  private transitionState(event: RecorderEvent) {
    console.log(event);
    const recorderContext: RecorderContext = {
      settingsPressed: this.settingsPressed,
      looping: this.looping,
      settings: this.settings,
    };
    this.stateMachine.transition(event, recorderContext);
    this.render();
  }

  public render() {
    this.viewHandler.render(this.state);
  }
}
