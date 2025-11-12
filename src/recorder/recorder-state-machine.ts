import { type RecorderContext } from "./recorder";

export type RecorderState =
  | "empty"
  | "waiting-to-record"
  | "recording"
  | "waiting-to-end-recording"
  | "recorded"
  | "waiting-to-play"
  | "ready-to-play"
  | "playing"
  | "deleting";

export type RecorderEvent =
  | "press"
  | "double-press"
  | "held"
  | "loop-end"
  | "ready-to-record"
  | "ready-to-end-recording"
  | "ready-to-play"
  | "start-playing"
  | "deleted";

//Access to settings - pass in live reference

//ToDo:
// - Handle double press
//      - Where does looping state live?
//- Handle settings button presses

function getNextState(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderState {
  switch (currentState) {
    case "empty":
      if (!["press"].includes(event)) return currentState;
      return ctx.settings.recordSyncStart ? "waiting-to-record" : "recording";

    case "waiting-to-record":
      if (["ready-to-record"].includes(event)) return currentState;
      return "recording";

    case "recording":
      if (!["press"].includes(event)) return currentState;
      return ctx.settings.recordSyncEnd
        ? "waiting-to-end-recording"
        : "recorded";

    case "waiting-to-end-recording":
      if (!["ready-to-end-recording"].includes(event)) return currentState;
      return "recorded";

    case "recorded":
      if (!["held", "press"].includes(event)) return currentState;
      if (event === "held") return "deleting";
      if (event === "press")
        return ctx.settings.playSyncStart ? "waiting-to-play" : "ready-to-play";

    case "waiting-to-play":
      if (!["ready-to-play"].includes(event)) return currentState;
      return "ready-to-play";

    case "ready-to-play":
      if (!["start-playing"].includes(event)) return currentState;
      return "playing";

    case "playing":
      if (!["held", "press", "loop-end"].includes(event)) return currentState;
      if (event === "held") return "deleting";
      if (event === "press")
        return ctx.settings.playingPressBehavior === "stop"
          ? "recorded"
          : "ready-to-play";
      if (event === "loop-end")
        return ctx.looping ? "ready-to-play" : "recorded";

    case "deleting":
      if (!["deleted"].includes(event)) return currentState;
      return "empty";
  }
}

export class RecorderStateMachine {
  public state: RecorderState;

  constructor() {
    this.state = "empty";
  }

  public transition(event: RecorderEvent, ctx: RecorderContext) {
    this.state = getNextState(this.state, event, ctx);
  }
}
