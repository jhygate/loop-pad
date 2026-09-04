import type { ControllerPadEvent, PadEvent, PadState } from "@/pad/pad-state-machine.js";
import type { PadSettings } from "@/pad/pad.js";
import type { RecordingAdjustment } from "@/audio-helpers.js";

export type SyncDecision = "immediate" | "wait";

export type LoopBoundarySource = {
  getNearestLoopBoundary(): number | null;
};

export type SyncEffects = {
  scheduleReady: (event: ControllerPadEvent, delayMs: number) => void;
  adjustRecording: (adjustment: RecordingAdjustment) => void;
  offsetPlayback: (offsetMs: number) => void;
};

export type SyncPlan = {
  decision: SyncDecision;
  apply: (effects: SyncEffects) => void;
};

const NO_SYNC: SyncPlan = { decision: "immediate", apply: () => { } };

function nearestBoundary(sources: LoopBoundarySource[], now: number): number | null {
  let nearest: number | null = null;
  for (const source of sources) {
    const boundary = source.getNearestLoopBoundary();
    if (boundary === null) continue;
    if (nearest === null || Math.abs(boundary - now) < Math.abs(nearest - now)) {
      nearest = boundary;
    }
  }
  return nearest;
}

export class PadSyncPlanner {
  constructor(
    private readonly getSettings: () => PadSettings,
    private readonly now: () => number,
    private readonly getBoundarySources: () => LoopBoundarySource[],
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

  private planRecordStart(): SyncPlan {
    const settings = this.getSettings();
    const deltaMs = settings.recordSyncStart
      ? this.boundaryDeltaMs(settings.recordSyncStartThresholdMs)
      : null;

    if (deltaMs !== null && deltaMs > 0) {
      return {
        decision: "wait",
        apply: (effects) => effects.scheduleReady("ready-to-record", deltaMs),
      };
    }

    const prependMs = deltaMs === null ? 0 : -deltaMs;
    return {
      decision: "immediate",
      apply: (effects) => effects.adjustRecording({ prependMs, appendMs: 0, trimEndMs: 0 }),
    };
  }

  private planRecordEnd(): SyncPlan {
    const settings = this.getSettings();
    const deltaMs = settings.recordSyncEnd
      ? this.boundaryDeltaMs(settings.recordSyncEndThresholdMs)
      : null;

    const appendMs = deltaMs !== null && deltaMs > 0 ? deltaMs : 0;
    const trimEndMs = deltaMs !== null && deltaMs <= 0 ? -deltaMs : 0;
    return {
      decision: "immediate",
      apply: (effects) => effects.adjustRecording({ prependMs: 0, appendMs, trimEndMs }),
    };
  }

  private planPlayStart(): SyncPlan {
    const settings = this.getSettings();
    const deltaMs = settings.playSyncStart
      ? this.boundaryDeltaMs(settings.playSyncStartThresholdMs)
      : null;

    if (deltaMs !== null && deltaMs > 0) {
      return {
        decision: "wait",
        apply: (effects) => effects.scheduleReady("ready-to-play", deltaMs),
      };
    }

    const offsetMs = deltaMs === null ? 0 : -deltaMs;
    return {
      decision: "immediate",
      apply: (effects) => effects.offsetPlayback(offsetMs),
    };
  }

  private boundaryDeltaMs(thresholdMs: number): number | null {
    const now = this.now();
    const boundary = nearestBoundary(this.getBoundarySources(), now);
    if (boundary === null) return null;

    const deltaMs = (boundary - now) * 1000;
    return Math.abs(deltaMs) > thresholdMs ? null : deltaMs;
  }
}
