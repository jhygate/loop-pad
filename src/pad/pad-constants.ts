export const HOLD_TO_DELETE_TIME = 600;
export const DOUBLE_CLICK_TIME = 400;

export function emptyTemplate(padNumber: number): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="icon-wrapper">
        <div class="record-icon"></div>
      </div>
      <div class="pad-status">Empty</div>
    </div>
  `;
}

export function recordingTemplate(padNumber: number): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="icon-wrapper">
        <div class="record-icon"></div>
      </div>
      <div class="pad-status">Recording</div>
    </div>
  `;
}

export function recordedTemplate(padNumber: number, isLooping: boolean): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="looping">${isLooping ? '<img src="/icons/loop.svg" style="width:20px;height:20px;">' : ''}</div>
      <div class="icon-wrapper">
        <div class="play-icon"></div>
      </div>
      <div class="waveform">
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
      </div>
      <div class="pad-status">Ready</div>
    </div>
  `;
}

export function playingTemplate(padNumber: number, isLooping: boolean): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="looping">${isLooping ? '<img src="/icons/loop.svg" style="width:20px;height:20px;">' : ''}</div>
      <div class="icon-wrapper">
        <div class="play-icon"></div>
      </div>
      <div class="waveform">
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
        <div class="waveform-bar"></div>
      </div>
      <div class="pad-status">Playing</div>
    </div>
  `;
}

export function settingsTemplate(padNumber: number): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="icon-wrapper">
        <img src="/icons/settings.svg" style="width:55px;height:55px;">
      </div>
      <div class="pad-status">Settings</div>
    </div>
  `;
}

export function waitingTemplate(padNumber: number, statusText: string): string {
  return `
    <div class="pad-inner">
      <div class="pad-number">${padNumber}</div>
      <div class="icon-wrapper">
        <div class="record-icon"></div>
      </div>
      <div class="pad-status">${statusText}</div>
    </div>
  `;
}
