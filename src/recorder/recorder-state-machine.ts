import { type RecorderContext } from "./recorder.js";

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

export type RecorderStateDetails = {
  state: RecorderState;
  looping: boolean;
};

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

type Transition = (ctx: RecorderContext, looping: boolean) => RecorderState;

const table: Record<RecorderState, Partial<Record<RecorderEvent, Transition>>> = {
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
    "press": (ctx) => ctx.settings.playSyncStart ? "waiting-to-play" : "ready-to-play",
  },
  "waiting-to-play": {
    "ready-to-play": () => "ready-to-play",
  },
  "ready-to-play": {
    "start-playing": () => "playing",
  },
  "playing": {
    "press": (ctx) => ctx.settings.playingPressBehavior === "stop" ? "recorded" : "ready-to-play",
    "loop-end": (_, looping) => looping ? "ready-to-play" : "recorded",
  },
  "deleting": {
    "deleted": () => "empty",
  },
};

const HELD_STATES: RecorderState[] = ["recorded", "playing"];

function getCrossCuttingTransition(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext,
  looping: boolean
): RecorderStateDetails | null {
  if (event === "double-press" && ctx.settings.loopable)
    return { state: currentState, looping: !looping };

  if (event === "held" && HELD_STATES.includes(currentState))
    return { state: "deleting", looping };

  return null;
}

function getNextStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext,
  looping: boolean
): RecorderStateDetails {
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

export class RecorderStateMachine {
  public state: RecorderState;
  public looping: boolean;

  constructor() {
    this.state = "empty";
    this.looping = false;
  }

  public transition(event: RecorderEvent, ctx: RecorderContext) {
    const next = getNextStateDetails(this.state, event, ctx, this.looping);
    this.state = next.state;
    this.looping = next.looping;
  }
}
