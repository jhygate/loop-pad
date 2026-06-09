import { type PadContext } from "./pad.js";

export type PadState =
  | "empty"
  | "waiting-to-record"
  | "recording"
  | "waiting-to-end-recording"
  | "recorded"
  | "waiting-to-play"
  | "playing"

export type PadStateDetails = {
  state: PadState;
  looping: boolean;
};

export type UserPadEvent =
  | "press"
  | "double-press"
  | "held"

export type ControllerPadEvent =
  | "loop-end"
  | "ready-to-record"
  | "ready-to-end-recording"
  | "ready-to-play"

export type PadEvent =
  UserPadEvent | ControllerPadEvent


type Transition = (ctx: PadContext, looping: boolean) => PadState;

const table: Record<PadState, Partial<Record<PadEvent, Transition>>> = {
  "empty": {
    "press": (ctx) => ctx.settings.recordSyncStart ? "waiting-to-record" : "recording",
  },
  "waiting-to-record": {
    "ready-to-record": () => "recording",
  },
  "recording": {
    "press": (ctx) => ctx.settings.recordSyncEnd ? "waiting-to-end-recording" : "recorded",
  },
  "waiting-to-end-recording": {
    "ready-to-end-recording": () => "recorded",
  },
  "recorded": {
    "press": (ctx) => ctx.settings.playSyncStart ? "waiting-to-play" : "playing",
  },
  "waiting-to-play": {
    "ready-to-play": (_) => "playing"
  },
  "playing": {
    "press": (ctx) => ctx.settings.playingPressBehavior === "stop" ? "recorded" : "playing",
    "loop-end": (_, looping) => looping ? "playing" : "recorded",
  },
};

const HELD_STATES: PadState[] = ["recorded", "playing"];

function getCrossCuttingTransition(
  currentState: PadState,
  event: PadEvent,
  ctx: PadContext,
  looping: boolean
): PadStateDetails | null {
  if (event === "double-press" && ctx.settings.loopable){
    console.log("double press")
    return { state: currentState, looping: !looping };
  }

  if (event === "held" && HELD_STATES.includes(currentState))
    return { state: "empty", looping };

  return null;
}

function getNextStateDetails(
  currentState: PadState,
  event: PadEvent,
  ctx: PadContext,
  looping: boolean
): PadStateDetails {
  if (ctx.settingsPressed && ["press", "double-press", "held"].includes(event))
    return { state: currentState, looping };

  const crossCutting = getCrossCuttingTransition(currentState, event, ctx, looping);
  if (crossCutting) {
    return { state: crossCutting.state, looping: crossCutting.looping };
  }

  const nextState = table[currentState]?.[event]?.(ctx, looping) ?? currentState;
  const nextLooping = nextState === "empty" ? false : looping;

  return { state: nextState, looping: nextLooping };
}

export class PadStateMachine {
  public state: PadState;
  public looping: boolean;

  constructor() {
    this.state = "empty";
    this.looping = true;
  }

  public transition(event: PadEvent, ctx: PadContext) {
    const next = getNextStateDetails(this.state, event, ctx, this.looping);
    this.state = next.state;
    this.looping = next.looping;

    console.log(this.state);
  }
}
