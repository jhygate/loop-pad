import type { ControllerPadEvent, PadEvent, PadState } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
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
  noiseFloor: number | null;
};

export type SyncEffects = {
  scheduleReady: (event: ControllerPadEvent, delayMs: number) => void;
  beginCapture: (capture: CaptureWindow) => void;
  setCaptureStart: (startBoundary: number) => void;
  endCapture: (endBoundary: number) => void;
  schedulePlayback: (boundaryTime: number) => void;
};

export type SyncPlan = {
  decision: SyncDecision;
  apply: (effects: SyncEffects) => void;
};

const NO_SYNC: SyncPlan = { decision: "immediate", apply: () => { } };

export function snapBoundary(ref: LoopReference, time: number, backPct: number): number {
  const frac = (time - ref.originTime) / ref.cycleSec;
  const cycleIndex = Math.ceil(frac - backPct / 100);
  return ref.originTime + cycleIndex * ref.cycleSec;
}

export class PadSyncPlanner {
  constructor(
    private readonly getSettings: () => PadSettings,
    private readonly now: () => number,
    private readonly getSources: () => LoopReferenceSource[],
    private readonly getActiveCapture: () => CaptureWindow | null,
    private readonly getDetectedOnset: () => number | null,
    private readonly getLastSoundTime: () => number | null,
  ) { }

  public planFor(state: PadState, event: PadEvent): SyncPlan {
    if (state === "armed" && event === "input-detected") return this.planSoundStart();
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
    const settings = this.getSettings();
    const sync = settings.sync;
    const ref = sync ? this.findReference() : null;

    if (settings.startTrigger === "sound") {
      return {
        decision: "immediate",
        apply: (effects) => effects.beginCapture({ sync, ref, startBoundary: null, endBoundary: null, noiseFloor: null }),
      };
    }

    if (!ref) {
      return {
        decision: "immediate",
        apply: (effects) => effects.beginCapture({ sync, ref: null, startBoundary: null, endBoundary: null, noiseFloor: null }),
      };
    }

    const now = this.now();
    const startBoundary = snapBoundary(ref, now, settings.recordStartBackPct);
    const capture: CaptureWindow = { sync, ref, startBoundary, endBoundary: null, noiseFloor: null };
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

  private planSoundStart(): SyncPlan {
    const capture = this.getActiveCapture();
    const onset = this.getDetectedOnset() ?? this.now();
    const start = capture?.ref ? snapBoundary(capture.ref, onset, 100) : onset;
    return { decision: "immediate", apply: (effects) => effects.setCaptureStart(start) };
  }

  private planRecordEnd(): SyncPlan {
    const capture = this.getActiveCapture();
    const now = this.now();
    const virtualTime = this.getSettings().endTrigger === "sound"
      ? Math.min(this.getLastSoundTime() ?? now, now)
      : now;

    if (!capture?.ref) {
      if (capture && capture.startBoundary !== null) {
        return { decision: "immediate", apply: (effects) => effects.endCapture(virtualTime) };
      }
      return NO_SYNC;
    }

    const endBoundary = snapBoundary(capture.ref, virtualTime, this.getSettings().recordEndBackPct);
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
    const startBoundary = snapBoundary(ref, now, this.getSettings().playStartBackPct);
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
