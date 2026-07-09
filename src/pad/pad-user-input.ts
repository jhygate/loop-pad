import type { UserPadEvent } from "@/pad/pad-state-machine.js";
import { DOUBLE_CLICK_TIME, HOLD_TO_DELETE_TIME } from "@/pad/pad-constants.js";

export class PadUserInputHandler {
  private holdTimerId = -1;
  private holdStartTimeMs: number | null = null;
  private holdFired = false;

  private clickCount = 0;
  private clickResetTimerId = -1;

  constructor(
    element: HTMLElement,
    private readonly onGesture: (gesture: UserPadEvent) => void,
    private readonly onChange: () => void,
  ) {
    element.addEventListener("pointerdown", () => this.onPointerDown());
    element.addEventListener("pointerup", () => this.onPointerUp());
    element.addEventListener("pointercancel", () => this.cancelHold());
  }

  public get holdStartTime(): number | null {
    return this.holdStartTimeMs;
  }

  private onPointerDown() {
    this.clickCount += 1;
    this.holdStartTimeMs = performance.now();
    this.holdFired = false;
    this.onChange();

    if (this.clickResetTimerId === -1) {
      this.clickResetTimerId = setTimeout(() => {
        this.clickCount = 0;
        this.clickResetTimerId = -1;
      }, DOUBLE_CLICK_TIME);
    }
    this.holdTimerId = setTimeout(() => {
      this.holdFired = true;
      this.onGesture("held");
    }, HOLD_TO_DELETE_TIME);
  }

  private onPointerUp() {
    this.cancelHold();
    if (this.holdFired) return;

    if (this.clickCount === 1) this.onGesture("press");
    else if (this.clickCount === 2) this.onGesture("double-press");
  }

  private cancelHold() {
    this.holdStartTimeMs = null;
    clearTimeout(this.holdTimerId);
    this.onChange();
  }
}
