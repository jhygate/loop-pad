import { type PadContext } from "@/pad/pad.js";

export type PadState =
  | "empty"
  | "waiting-to-record"
  | "recording"
  | "waiting-to-end-recording"
  | "processing-recording"
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
  | "processing-recording-complete"

export type PadEvent = UserPadEvent | ControllerPadEvent


type RuleArgs = { ctx: PadContext; state: PadState; looping: boolean };

type Rule = {
  from: PadState | "*";
  event: PadEvent;
  when?: (args: RuleArgs) => boolean;
  to: (args: RuleArgs) => PadState | PadStateDetails;
};

const HELD_STATES: PadState[] = ["recorded", "playing"];

const rules: Rule[] = [
  {
    from: "*", event: "double-press",
    when: ({ ctx }) => ctx.settings.loopable,
    to: ({ state, looping }) => ({ state, looping: !looping })
  },

  {
    from: "*", event: "held",
    when: ({ state }) => HELD_STATES.includes(state),
    to: () => "empty"
  },

  {
    from: "empty", event: "press",
    to: ({ ctx }) => ctx.syncStartDecision === "wait" ? "waiting-to-record" : "recording"
  },

  {
    from: "waiting-to-record", event: "ready-to-record",
    to: () => "recording"
  },

  {
    from: "recording", event: "press",
    to: ({ ctx }) => ctx.syncEndDecision === "wait" ? "waiting-to-end-recording" : "processing-recording"
  },

  {
    from: "waiting-to-end-recording", event: "ready-to-end-recording",
    to: () => "processing-recording"
  },

  {
    from: "processing-recording", event: "processing-recording-complete",
    to: () => "recorded"
  },

  {
    from: "recorded", event: "press",
    to: ({ ctx }) => ctx.playSyncDecision === "wait" ? "waiting-to-play" : "playing"
  },

  {
    from: "waiting-to-play", event: "ready-to-play",
    to: () => "playing"
  },

  {
    from: "playing", event: "press",
    to: ({ ctx }) => ctx.settings.playingPressBehavior === "stop" ? "recorded" : "playing"
  },

  {
    from: "playing", event: "loop-end",
    to: ({ looping }) => looping ? "playing" : "recorded"
  },
];

function getNextStateDetails(
  state: PadState,
  event: PadEvent,
  ctx: PadContext,
  looping: boolean,
): PadStateDetails {

  const args: RuleArgs = { ctx, state, looping };
  const rule = rules.find(r =>
    (r.from === "*" || r.from === state) &&
    r.event === event &&
    (!r.when || r.when(args))
  );

  const next = rule?.to(args) ?? state;
  const details: PadStateDetails = typeof next === "string" ? { state: next, looping } : next;
  return { state: details.state, looping: details.state === "empty" ? false : details.looping };
}

export class PadStateMachine {
  public state: PadState = "empty";
  private _looping: boolean = true;

  public get looping(): boolean {
    return this._looping;
  }

  public disableLooping() {
    this._looping = false;
  }

  public transition(event: PadEvent, ctx: PadContext) {
    const next = getNextStateDetails(this.state, event, ctx, this._looping);
    this.state = next.state;
    this._looping = next.looping;

    console.log(this.state);
  }
}
