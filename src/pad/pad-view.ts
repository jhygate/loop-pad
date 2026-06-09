//Needs access to settings (displaying settings info perhaps?)
// needs acces to FSM - looping/display
// needs access to audfio object for animations.

import { PadState } from "./pad-state-machine";
import { PadSettings } from "./pad-settings"
import { HOLD_TO_DELETE_TIME, HOLD_GRACE_TIME } from "./pad-constants.js";

const playIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M8 5v14l11-7z"/></svg>`;
const pauseIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
const recordIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><circle cx="12" cy="12" r="7"/></svg>`;
const loopIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4 9a5 5 0 0 1 5-5h9l-3-3M20 15a5 5 0 0 1-5 5H6l3 3"/></svg>`;

const STATEMAPPING: Record<PadState, { icon: string; className?: string }> = {
  "empty":                    { icon: recordIcon },
  "waiting-to-record":        { icon: recordIcon, className: "pulse" },
  "recording":                { icon: recordIcon, className: "pulse" },
  "waiting-to-end-recording": { icon: pauseIcon,  className: "pulse" },
  "recorded":                 { icon: playIcon },
  "waiting-to-play":          { icon: playIcon,   className: "pulse" },
  "playing":                  { icon: pauseIcon },
};

export type PadViewProps = {
  padNumber: number;
  state: PadState;
  looping: boolean;
  progress: number;
  settingsPressed: boolean;
  holdStartTime: number | null;
  settings: PadSettings; 
};

function getFilledTemplate({
  padNumber,
  state,
  looping,
  progress,
  settingsPressed,
  holdStartTime,
  settings,
}: PadViewProps) {
  const elapsed = holdStartTime === null ? 0 : performance.now() - holdStartTime;
  const delay = HOLD_GRACE_TIME - elapsed;
  const duration = HOLD_TO_DELETE_TIME - HOLD_GRACE_TIME;
  const deleteBar = (holdStartTime === null || state === "empty") ? "" : `
    <div class="delete-bar" style="animation-delay: ${delay}ms; animation-duration: ${duration}ms;"></div>
  `;

  const loopingColor = looping ? "black" : "lightgrey";
  const padLooping = !settings.loopable ? "" : `
    <div class="pad-looping" style="color: ${loopingColor};">${loopIcon}</div>
  `;

  const padIcon = `
    <div class="pad-icon ${STATEMAPPING[state].className ?? ""}">${settingsPressed ? "settings" : STATEMAPPING[state].icon}</div>
  `;

  return `
    <div class="pad-container">
      ${deleteBar}
      <div class="pad-header">
        <div class="pad-number">${padNumber}</div>
        ${padLooping}
      </div>
      ${padIcon}
      <div class="pad-progress">${progress}</div>
        </div>

    <style>
      .pad-container {
        width: 200px;
        height: 200px;
        display: flex;
        flex-direction: column;
        border-style: solid;
        justify-content: space-between;
        position: relative;
      }

      .delete-bar {
        position: absolute;
        inset: 0;
        background: linear-gradient(red, red) left/0 100% no-repeat;
        animation-name: deleteFill;
        animation-timing-function: linear;
        pointer-events: none;
        opacity: 20%;
      }

      @keyframes deleteFill {
        from { background-size: 0    100%; }
        to   { background-size: 100% 100%; }
      }

      .pad-header {
        height: 10%;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      .pad-icon {
        align-self: center;
        font-size: 40px;
        display: block;
      }

      .pad-looping {
        font-size: 24px;
      }

      .pulse {
        animation: pulse 1s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.3; }
      }

      .pad-progress {
        height: 10%;
        background: linear-gradient(red, red) left/10% 100% no-repeat;
        animation: progressFill 10s linear forwards;
      }

      @keyframes progressFill {
        from { background-size: 10%  100%; }
        to   { background-size: 100% 100%; }
      }

      .pad-icons {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        color: #333;
        font-size: 24px;
      }
    </style>
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
