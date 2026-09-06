import type { ControllerPadEvent, PadEvent, PadState } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import { SYNC_GRACE_TIME } from "@/pad/pad-constants.js";

export type SyncDecision = "immediate" | "wait";

export type LoopReference = {
  originTime: number;
  cycleSec: number;
  cycleSamples: number;
};

export type LoopReferenceSource = {
  getLoopReference(): LoopReference | null;
};

export type CaptureWindow = {
  sync: boolean;
  ref: LoopReference | null;
  startBoundary: number | null;
  endBoundary: number | null;
};

export type SyncEffects = {
  scheduleReady: (event: ControllerPadEvent, delayMs: number) => void;
  beginCapture: (capture: CaptureWindow) => void;
  endCapture: (endBoundary: number) => void;
  schedulePlayback: (boundaryTime: number) => void;
};

export type SyncPlan = {
  decision: SyncDecision;
  apply: (effects: SyncEffects) => void;
};

const NO_SYNC: SyncPlan = { decision: "immediate", apply: () => { } };

export function nextBoundary(ref: LoopReference, time: number): number {
  const grace = SYNC_GRACE_TIME / 1000;
  const cycleIndex = Math.ceil((time - ref.originTime - grace) / ref.cycleSec);
  return ref.originTime + cycleIndex * ref.cycleSec;
}

export class PadSyncPlanner {
  constructor(
    private readonly getSettings: () => PadSettings,
    private readonly now: () => number,
    private readonly getSources: () => LoopReferenceSource[],
    private readonly getActiveCapture: () => CaptureWindow | null,
  ) { }

  public planFor(state: PadState, event: PadEvent): SyncPlan {
    if (event !== "press") return NO_SYNC;
    switch (state) {
      case "empty": return this.planRecordStart();
      case "recording": return this.planRecordEnd();
      case "recorded": return this.planPlayStart();
      default: return NO_SYNC;
    }
  }

  private findReference(): LoopReference | null {
    for (const source of this.getSources()) {
      const ref = source.getLoopReference();
      if (ref) return ref;
    }
    return null;
  }

  private planRecordStart(): SyncPlan {
    const sync = this.getSettings().sync;
    const ref = sync ? this.findReference() : null;
    if (!ref) {
      return {
        decision: "immediate",
        apply: (effects) => effects.beginCapture({ sync, ref: null, startBoundary: null, endBoundary: null }),
      };
    }

    const now = this.now();
    const startBoundary = nextBoundary(ref, now);
    const capture: CaptureWindow = { sync, ref, startBoundary, endBoundary: null };
    if (startBoundary > now) {
      return {
        decision: "wait",
        apply: (effects) => {
          effects.beginCapture(capture);
          effects.scheduleReady("ready-to-record", (startBoundary - now) * 1000);
        },
      };
    }
    return { decision: "immediate", apply: (effects) => effects.beginCapture(capture) };
  }

  private planRecordEnd(): SyncPlan {
    const capture = this.getActiveCapture();
    if (!capture?.ref) return NO_SYNC;

    const now = this.now();
    const endBoundary = nextBoundary(capture.ref, now);
    if (endBoundary > now) {
      return {
        decision: "wait",
        apply: (effects) => {
          effects.endCapture(endBoundary);
          effects.scheduleReady("ready-to-end-recording", (endBoundary - now) * 1000);
        },
      };
    }
    return { decision: "immediate", apply: (effects) => effects.endCapture(endBoundary) };
  }

  private planPlayStart(): SyncPlan {
    if (!this.getSettings().sync) return NO_SYNC;
    const ref = this.findReference();
    if (!ref) return NO_SYNC;

    const now = this.now();
    const startBoundary = nextBoundary(ref, now);
    if (startBoundary > now) {
      return {
        decision: "wait",
        apply: (effects) => {
          effects.schedulePlayback(startBoundary);
          effects.scheduleReady("ready-to-play", (startBoundary - now) * 1000);
        },
      };
    }
    return { decision: "immediate", apply: (effects) => effects.schedulePlayback(startBoundary) };
  }
}
