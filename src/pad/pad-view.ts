//Needs access to settings (displaying settings info perhaps?)
// needs acces to FSM - looping/display
// needs access to audfio object for animations.

import { PadState } from "./pad-state-machine";

function getFilledTemplate(
  pad_number: number,
  pad_looping: boolean,
  pad_state: PadState,
  pad_progress: number
) {
  return `
    <div class="pad-container">
      <div class="pad-header">
        <div class="pad-number">${pad_number}</div>
        <div class="pad-looping">${pad_looping}</div>
      </div>
      <div class="pad-icon">${pad_state}</div>
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
        height: 100px;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      .pad-icon {
        align-self: center;
        border-style: solid;
      }

      .pad-progress {
        display: flex;
        flex-direction: column;
        justify-content: flex-end; /* pushes content to bottom */
        height: 100px;
      }
    </style>
  `;
}

export class PadViewHandler {
  private htmlElement: HTMLElement;

  constructor(htmlElement: HTMLElement) {
    this.htmlElement = htmlElement;
  }

  public render(state: PadState) {
    this.htmlElement.innerHTML = getFilledTemplate(1, true, state, 0);
  }
}
