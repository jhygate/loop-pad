import { PadState } from "@/pad/pad-state-machine.js";
import { PadSettings } from "@/pad/pad.js";
import { HOLD_TO_DELETE_TIME, HOLD_GRACE_TIME } from "@/pad/pad-constants.js";

export const playIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M8 5v14l11-7z"/></svg>`;
export const pauseIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
const recordIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" style="display:block"><circle cx="12" cy="12" r="7"/></svg>`;
const loopIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M4 9a5 5 0 0 1 5-5h9l-3-3M20 15a5 5 0 0 1-5 5H6l3 3"/></svg>`;

const STATEMAPPING: Record<PadState, { icon: string; className?: string }> = {
  "empty": { icon: recordIcon },
  "armed": { icon: recordIcon, className: "greyed" },
  "waiting-to-record": { icon: recordIcon, className: "pulse" },
  "recording": { icon: recordIcon, className: "pulse" },
  "waiting-to-end-recording": { icon: pauseIcon, className: "pulse" },
  "processing-recording": { icon: recordIcon, className: "greyed" },
  "recorded": { icon: playIcon },
  "waiting-to-play": { icon: playIcon, className: "pulse" },
  "playing": { icon: pauseIcon },
};

const ICON_CLASSES = ["pulse", "greyed"];

export type PadViewProps = {
  padNumber: number;
  state: PadState;
  looping: boolean;
  settingsPressed: boolean;
  holdStartTime: number | null;
  settings: PadSettings;
  audioLength: number | null;
  audioPlayed: number | null;
  playbackStart: number | null;
};

export class PadViewHandler {
  private readonly numberElement: HTMLElement;
  private readonly loopingElement: HTMLElement;
  private readonly iconElement: HTMLElement;
  private readonly deleteBarElement: HTMLElement;
  private readonly progressElement: HTMLElement;

  private renderedIcon = "";
  private deleteBarVisible = false;
  private lastPlaybackStart: number | null = null;

  constructor(htmlElement: HTMLElement) {
    htmlElement.innerHTML = `
      <div class="pad-container">
        <div class="delete-bar" data-role="delete-bar" hidden></div>
        <div class="pad-header">
          <div class="pad-number" data-role="number"></div>
          <div class="pad-looping" data-role="looping">${loopIcon}</div>
        </div>
        <div class="pad-icon" data-role="icon"></div>
        <div class="pad-progress" data-role="progress"></div>
      </div>
    `;

    this.numberElement = htmlElement.querySelector<HTMLElement>('[data-role="number"]');
    this.loopingElement = htmlElement.querySelector<HTMLElement>('[data-role="looping"]');
    this.iconElement = htmlElement.querySelector<HTMLElement>('[data-role="icon"]');
    this.deleteBarElement = htmlElement.querySelector<HTMLElement>('[data-role="delete-bar"]');
    this.progressElement = htmlElement.querySelector<HTMLElement>('[data-role="progress"]');
  }

  public render(props: PadViewProps) {
    this.numberElement.textContent = String(props.padNumber);
    this.renderIcon(props.state, props.settingsPressed);
    this.renderLooping(props.looping, props.settings.loopable);
    this.renderDeleteBar(props.holdStartTime, props.state);
    this.renderProgress(props.audioLength, props.audioPlayed, props.playbackStart);
  }

  private renderIcon(state: PadState, settingsPressed: boolean) {
    const { icon, className } = STATEMAPPING[state];
    const content = settingsPressed ? "settings" : icon;

    if (content !== this.renderedIcon) {
      this.iconElement.innerHTML = content;
      this.renderedIcon = content;
    }
    for (const candidate of ICON_CLASSES) {
      this.iconElement.classList.toggle(candidate, candidate === className);
    }
  }

  private renderLooping(looping: boolean, loopable: boolean) {
    this.loopingElement.hidden = !loopable;
    this.loopingElement.style.color = looping ? "black" : "lightgrey";
  }

  private renderDeleteBar(holdStartTime: number | null, state: PadState) {
    const visible = holdStartTime !== null && state !== "empty";
    if (visible === this.deleteBarVisible) return;
    this.deleteBarVisible = visible;

    if (!visible) {
      this.deleteBarElement.hidden = true;
      return;
    }

    const elapsed = performance.now() - holdStartTime;
    this.deleteBarElement.style.animationDelay = `${HOLD_GRACE_TIME - elapsed}ms`;
    this.deleteBarElement.style.animationDuration = `${HOLD_TO_DELETE_TIME - HOLD_GRACE_TIME}ms`;
    this.deleteBarElement.hidden = false;
  }

  private renderProgress(audioLength: number | null, audioPlayed: number | null, playbackStart: number | null) {
    if (audioLength === null || audioPlayed === null || playbackStart === null) {
      if (this.lastPlaybackStart !== null) {
        this.progressElement.style.animation = "";
        this.lastPlaybackStart = null;
      }
      return;
    }

    if (playbackStart === this.lastPlaybackStart) return;
    this.lastPlaybackStart = playbackStart;

    this.progressElement.style.animation = "none";
    void this.progressElement.offsetHeight;
    this.progressElement.style.animation = `progressFill ${audioLength}s linear infinite`;
    this.progressElement.style.animationDelay = `-${audioPlayed}s`;
  }
}
