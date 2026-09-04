import { PadState } from "@/pad/pad-state-machine.js";
import { PadSettings } from "@/pad/pad.js";
import { HOLD_TO_DELETE_TIME, HOLD_GRACE_TIME } from "@/pad/pad-constants.js";

const playIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M8 5v14l11-7z"/></svg>`;
const pauseIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
const recordIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><circle cx="12" cy="12" r="7"/></svg>`;
const loopIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4 9a5 5 0 0 1 5-5h9l-3-3M20 15a5 5 0 0 1-5 5H6l3 3"/></svg>`;

const STATEMAPPING: Record<PadState, { icon: string; className?: string }> = {
  "empty": { icon: recordIcon },
  "waiting-to-record": { icon: recordIcon, className: "pulse" },
  "recording": { icon: recordIcon, className: "pulse" },
  "waiting-to-end-recording": { icon: pauseIcon, className: "pulse" },
  "processing-recording": { icon: recordIcon, className: "greyed" },
  "recorded": { icon: playIcon },
  "waiting-to-play": { icon: playIcon, className: "pulse" },
  "playing": { icon: pauseIcon },
};

export type PadViewProps = {
  padNumber: number;
  state: PadState;
  looping: boolean;
  settingsPressed: boolean;
  holdStartTime: number | null;
  settings: PadSettings;
  audioLength: number | null;
  audioPlayed: number | null;
};

function getFilledTemplate({
  padNumber,
  state,
  looping,
  settingsPressed,
  holdStartTime,
  settings,
  audioLength,
  audioPlayed,
}: PadViewProps) {
  const { icon, className = "" } = STATEMAPPING[state];

  const deleteBar = holdStartTime === null || state === "empty" ? "" : `
    <div class="delete-bar" style="animation-delay: ${HOLD_GRACE_TIME - (performance.now() - holdStartTime)}ms; animation-duration: ${HOLD_TO_DELETE_TIME - HOLD_GRACE_TIME}ms;"></div>`;

  const padLooping = !settings.loopable ? "" : `
    <div class="pad-looping" style="color: ${looping ? "black" : "lightgrey"};">${loopIcon}</div>`;

  const padProgress = audioLength === null || audioPlayed === null ? `<div class="pad-progress"></div>` : `
    <div class="pad-progress" style="--start: ${100 * audioPlayed / audioLength}%; animation: progressFill ${audioLength - audioPlayed}s linear forwards;"></div>`;

  return `
    <div class="pad-container">
      ${deleteBar}
      <div class="pad-header">
        <div class="pad-number">${padNumber}</div>
        ${padLooping}
      </div>
      <div class="pad-icon ${className}">${settingsPressed ? "settings" : icon}</div>
      ${padProgress}
    </div>
  `;
}

export class PadViewHandler {
  private htmlElement: HTMLElement;

  constructor(htmlElement: HTMLElement) {
    this.htmlElement = htmlElement;
  }

  public render(props: PadViewProps) {
    this.htmlElement.innerHTML = getFilledTemplate(props);
  }
}
