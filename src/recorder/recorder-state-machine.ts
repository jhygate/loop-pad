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

//Access to settings - pass in live reference.

//ToDo:
// - Handle double press
//      - Where does looping state live?
//- Handle settings button presses

function getCurrentStateDetails(
  currentState: RecorderState,
  ctx: RecorderContext
) {
  return {
    state: currentState,
    looping: ctx.looping,
  };
}

function getEmptyStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["press"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: ctx.settings.recordSyncStart ? "waiting-to-record" : "recording",
    looping: ctx.looping,
  };
}

function getWaitingToRecordStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["ready-to-record"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: "recording",
    looping: ctx.looping,
  };
}

function getRecordingStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["press"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: ctx.settings.recordSyncEnd ? "waiting-to-end-recording" : "recorded",
    looping: ctx.looping,
  };
}

function getWaitingToEndRecordingStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["ready-to-end-recording"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: "recorded",
    looping: ctx.looping,
  };
}

function getRecordedStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["held", "press"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  if (event === "held")
    return {
      state: "deleting",
      looping: ctx.looping,
    };
  if (event === "press")
    return {
      state: ctx.settings.playSyncStart ? "waiting-to-play" : "ready-to-play",
      looping: ctx.looping,
    };
  return getCurrentStateDetails(currentState, ctx);
}

function getWaitingToPlayStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["ready-to-play"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: "ready-to-play",
    looping: ctx.looping,
  };
}

function getReadyToPlayStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["start-playing"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: "playing",
    looping: ctx.looping,
  };
}

function getPlayingStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["held", "press", "loop-end"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  if (event === "held")
    return {
      state: "deleting",
      looping: ctx.looping,
    };
  if (event === "press")
    return {
      state:
        ctx.settings.playingPressBehavior === "stop"
          ? "recorded"
          : "ready-to-play",
      looping: ctx.looping,
    };
  if (event === "loop-end")
    return {
      state: ctx.looping ? "ready-to-play" : "recorded",
      looping: ctx.looping,
    };
  return getCurrentStateDetails(currentState, ctx);
}

function getDeletingStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  if (!["deleted"].includes(event))
    return getCurrentStateDetails(currentState, ctx);
  return {
    state: "empty",
    looping: ctx.looping,
  };
}

function getNextStateDetails(
  currentState: RecorderState,
  event: RecorderEvent,
  ctx: RecorderContext
): RecorderStateDetails {
  switch (currentState) {
    case "empty":
      return getEmptyStateDetails(currentState, event, ctx);

    case "waiting-to-record":
      return getWaitingToRecordStateDetails(currentState, event, ctx);

    case "recording":
      return getRecordingStateDetails(currentState, event, ctx);

    case "waiting-to-end-recording":
      return getWaitingToEndRecordingStateDetails(currentState, event, ctx);

    case "recorded":
      return getRecordedStateDetails(currentState, event, ctx);

    case "waiting-to-play":
      return getWaitingToPlayStateDetails(currentState, event, ctx);

    case "ready-to-play":
      return getReadyToPlayStateDetails(currentState, event, ctx);

    case "playing":
      return getPlayingStateDetails(currentState, event, ctx);

    case "deleting":
      return getDeletingStateDetails(currentState, event, ctx);
  }
}

export class RecorderStateMachine {
  public state: RecorderState;
  public looping: boolean;

  constructor() {
    this.state = "empty";
    this.looping = false;
  }

  public transition(event: RecorderEvent, ctx: RecorderContext) {
    const stateDetails = getNextStateDetails(this.state, event, ctx);
    this.state = stateDetails.state;
    this.looping = stateDetails.looping;
  }
}
