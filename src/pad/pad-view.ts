//Needs access to settings (displaying settings info perhaps?)
// needs acces to FSM - looping/display
// needs access to audfio object for animations.

import { PadState } from "./pad-state-machine";

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

function getFilledTemplate(
  pad_number: number,
  pad_looping: boolean,
  pad_state: PadState,
  pad_progress: number,
  setting_pressed: boolean
) {

  

  return `
    <div class="pad-container">
      <div class="pad-header">
        <div class="pad-number">${pad_number}</div>
        <div class="pad-looping">${pad_looping ? loopIcon : "Not looping i guess"}</div>
      </div>
      <div class="pad-icon ${STATEMAPPING[pad_state].className ?? ""}">${setting_pressed ? "settings" : STATEMAPPING[pad_state].icon}</div>
      <div class="pad-progress">${pad_progress}</div>
        </div>

    <style>
      .pad-container {
        width: 200px;
        height: 200px;
        display: flex;
        flex-direction: column;
        border-style: solid;
        justify-content: space-between;
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

  public render(state: PadState, settings_pressed) {
    this.htmlElement.innerHTML = getFilledTemplate(1, true, state, 0, settings_pressed);
  }
}
