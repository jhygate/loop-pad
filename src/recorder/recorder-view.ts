//Needs access to settings (displaying settings info perhaps?)
// needs acces to FSM - looping/display
// needs access to audfio object for animations.

function getFilledTemplate(
  recorder_number,
  recorder_looping,
  recorder_state,
  recorder_progress
) {
  return `
    <div class="recorder-container">
      <div class="recorder-header">
        <div class="recorder-number">${recorder_number}</div>
        <div class="recorder-looping">${recorder_looping}</div>
      </div>
      <div class="recorder-icon">${recorder_state}</div>
      <div class="recorder-progress">${recorder_progress}</div>
    </div>

    <style>
      .recorder-container {
        width: 200px;
        height: 200px;
        display: flex;
        flex-direction: column;
        border-style: solid;
        justify-content: space-between;
      }

      .recorder-header {
        height: 100px;
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      .recorder-icon {
        align-self: center;
        border-style: solid;
      }

      .recorder-progress {
        display: flex;
        flex-direction: column;
        justify-content: flex-end; /* pushes content to bottom */
        height: 100px;
      }
    </style>
  `;
}

export class RecorderViewHandler {
  private htmlElement: HTMLElement;

  constructor(htmlElement: HTMLElement) {
    this.htmlElement = htmlElement;
  }

  public render(state: string) {
    this.htmlElement.innerHTML = getFilledTemplate("1", "x", state, "----");
  }
}
