# Migration Plan: `main` → `claude-new-architecture`

## Goal

Port all functionality from `main` into the cleaner `fresh-build` architecture.
`main` is a working but monolithic app where one `Recorder` class (~400 lines) owns
recording, playback, audio processing, UI rendering, state, settings, and persistence.
`fresh-build` separates these into `PadStateMachine`, `PadAudioHandler`, `PadViewHandler`,
`SettingsModal`, and a `Pad` controller that orchestrates them.

---

## Architectural decisions (already agreed)

| Decision | Choice |
|---|---|
| Keyboard bindings | Live inside the `Pad` class |
| Cross-pad sync | Each `Pad` exposes `timeUntilLoopEnd: number \| null`; waiting states set a timer by querying all pads |
| Storage | Each `Pad` owns its own IndexedDB slot via a `PadStorage` helper |
| View / styles | Port the neo-brutalist HTML templates and CSS from `main` |
| `PadSettings` | Add all missing settings from `main` (trim, loopSync, syncThreshold) |

---

## File-by-file plan

### 1. `src/pad/pad-settings.ts` *(update)*

Add all settings that exist in `main` but are missing from `fresh-build`.

**Current `PadSettings`:**
```ts
loopable, recordSyncStart, recordSyncEnd, playSyncStart, playingPressBehavior
```

**Add:**
```ts
loopSync: boolean          // master toggle: enables the sync feature at all
syncThreshold: number      // ms window — only snap to loops ending within this time
trimAudio: boolean         // enable silence trimming post-record
trimThreshold: number      // amplitude value (0–1) below which a sample is "silent"
trimAudioLeft: boolean     // trim silence from the start of the recording
trimAudioRight: boolean    // trim silence from the end of the recording
```

**Also add `DEFAULT_PAD_SETTINGS` export** — a const with safe defaults so every
new `Pad` starts with a consistent baseline.

---

### 2. `src/pad/pad-constants.ts` *(update)*

Currently only has `HOLD_TO_DELETE_TIME` and `DOUBLE_CLICK_TIME`.

**Add the HTML template strings** ported from `main/src/constants.ts`:
- `EMPTY_TEMPLATE` — record icon, "Empty" status
- `RECORDING_TEMPLATE` — record icon (animated), "Recording" status
- `RECORDED_TEMPLATE` — play icon, waveform bars, "Ready" status
- `PLAYING_TEMPLATE` — play icon, waveform bars (animated), "Playing" status
- `SETTINGS_TEMPLATE` — settings gear icon, "Settings" status
- `WAITING_TEMPLATE` — a new one for the `waiting-*` states (e.g. pulsing border, "Waiting" status)

Each template takes parameters: `padNumber: number`, `isLooping: boolean` so the
pad number and loop indicator can be injected at render time.

---

### 3. `src/pad/pad-state-machine.ts` *(update)*

Two bugs to fix, one feature to add:

**Bug 1 — `restart` branch is wrong:**
```ts
// current (both branches return "recorded"):
"press": (ctx) => ctx.settings.playingPressBehavior === "stop" ? "recorded" : "recorded",

// fix:
"press": (ctx) => ctx.settings.playingPressBehavior === "stop" ? "recorded" : "playing",
```
When returning `"playing"` from `"playing"`, the audio handler will be called with
`"playing"` again — it needs to stop then re-start (handled in `PadAudioHandler`).

**Bug 2 — `looping` defaults to `true`:**
```ts
// fix: default to false
this.looping = false;
```
Looping should only be true after the user explicitly double-taps.

**Feature — `loopSync` master toggle:**
The waiting-state transitions currently check `ctx.settings.recordSyncStart` etc.
They should be gated by `ctx.settings.loopSync` too:
```ts
"press": (ctx) => ctx.settings.loopSync && ctx.settings.recordSyncStart
    ? "waiting-to-record"
    : "recording",
```

---

### 4. `src/pad/pad-audio.ts` *(update)*

**Add playback time tracking** so `Pad` can expose `timeUntilLoopEnd`:
```ts
private playbackStartTime: number   // audioContext.currentTime when play started
public get timeUntilEnd(): number | null  // (startTime + duration) - currentTime
```

**Fix `startPlaying`** — call `stopPlaying()` first so restart works without ghost audio:
```ts
public async startPlaying() {
  this.stopPlaying();   // ← add this
  ...
}
```

**Add silence trimming** ported from `main/src/helpers.ts` and `recorder._processChunks()`:
- `trimBuffer(buffer, ctx, threshold)` — scans sample-by-sample for first/last non-silent frame
- Applied in `mediaRecorder.onstop` based on `PadSettings` (trimAudio, trimLeft, trimRight)
- `PadAudioHandler` needs to receive/update `PadSettings` — add `updateSettings(s: PadSettings)` method

**Note on silence padding:** `main` added silence to the *start* of recordings to align
them when sync-recording mid-loop. With the new waiting-state approach we start recording
exactly at a loop boundary, so **silence padding is no longer needed**. Trimming remains
as a pure user preference for cleaning up hesitation at the start/end of takes.

---

### 5. `src/pad/pad-storage.ts` *(new file)*

A class scoped to a single pad index. Ported from `main/src/storage.ts` but as a
proper class instead of standalone functions.

```ts
export class PadStorage {
  constructor(private index: number) {}

  async save(settings: PadSettings, audioBuffer: AudioBuffer | null): Promise<void>
  async load(): Promise<{ settings: PadSettings; audioBuffer: AudioBuffer | null } | null>
  async clear(): Promise<void>
}
```

Uses the same IndexedDB schema as `main` (`LoopPadDB`, `recorders` store, keyed by index)
so existing saved sessions are compatible.

Helper functions `audioBufferToStorable` / `storableToAudioBuffer` also ported here.

---

### 6. `src/pad/pad-view.ts` *(rewrite)*

Currently a minimal placeholder. Replace with a proper implementation using the
template strings from `pad-constants.ts`.

```ts
export class PadViewHandler {
  constructor(private htmlElement: HTMLElement) {}

  public render(
    state: PadState,
    looping: boolean,
    settingsPressed: boolean,
    padNumber: number,
    deleteTime: number
  ): void
}
```

`render()` picks the right template based on state, injects `padNumber` and `looping`,
sets `innerHTML`, and manages CSS classes:

| State | Template | CSS classes added |
|---|---|---|
| `empty` | `EMPTY_TEMPLATE` | — |
| `recording` | `RECORDING_TEMPLATE` | `.recording` |
| `waiting-to-record` | `WAITING_TEMPLATE` | `.waiting` |
| `recorded` | `RECORDED_TEMPLATE` | `.has-audio` |
| `waiting-to-end-recording` | `WAITING_TEMPLATE` | `.waiting`, `.has-audio` |
| `playing` | `PLAYING_TEMPLATE` | `.playing`, `.has-audio` |
| `waiting-to-play` | `WAITING_TEMPLATE` | `.waiting`, `.has-audio` |

Also sets `--delete-time` CSS var on the element (for the hold-to-delete progress bar animation).

---

### 7. `src/pad/pad.ts` *(major update)*

This is the main controller. Changes:

**Constructor signature:**
```ts
constructor(
  buttonId: string,
  stream: MediaStream,
  audioContext: AudioContext,
  globalState: GlobalState,
  allPads: Pad[],    // ← new: reference to global pads array for sync
  key: string,       // ← new: keyboard binding e.g. "q"
  index: number      // ← new: used by storage
)
```

**New public getters:**
```ts
public get timeUntilLoopEnd(): number | null {
  if (this.state !== "playing" || !this.looping) return null;
  return this.audioHandler.timeUntilEnd;
}
```

**Keyboard bindings in `bindUI()`:**
```ts
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === this.key && !e.repeat) this.handlePointerDown();
});
document.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === this.key) this.handlePointerUp();
});
```

**Sync timer logic** — new private method called after every `transitionState()`:

Each waiting state maps to the specific `loopSync` sub-setting that enabled it.
Before waiting, the method checks whether that setting is actually on. This is a
belt-and-suspenders guard — the state machine already gates entry into waiting
states via these settings, but `handleWaitingState` re-checks them so that a
settings change mid-flight (or any future edge case) always fires immediately
rather than hanging forever.

```ts
// Maps each waiting state → (the ready event to fire, the setting that enabled it)
const waitingMap: Record<string, { readyEvent: ControllerPadEvent; settingEnabled: boolean }> = {
  "waiting-to-record":        { readyEvent: "ready-to-record",         settingEnabled: this.settings.loopSync && this.settings.recordSyncStart },
  "waiting-to-end-recording": { readyEvent: "ready-to-end-recording",  settingEnabled: this.settings.loopSync && this.settings.recordSyncEnd   },
  "waiting-to-play":          { readyEvent: "ready-to-play",           settingEnabled: this.settings.loopSync && this.settings.playSyncStart    },
};

private handleWaitingState(): void {
  const entry = waitingMap[this.state];
  if (!entry) return;

  const { readyEvent, settingEnabled } = entry;

  // If the relevant sync setting is off, fire immediately — don't wait
  if (!settingEnabled) {
    this.transitionState(readyEvent);
    return;
  }

  // Find the soonest loop end among all OTHER looping pads
  const times = this.allPads
    .filter(p => p !== this)
    .map(p => p.timeUntilLoopEnd)
    .filter((t): t is number => t !== null);

  if (times.length === 0) {
    // No looping pads to sync to — fire immediately
    this.transitionState(readyEvent);
    return;
  }

  const soonestMs = Math.min(...times) * 1000;
  this.syncTimerId = setTimeout(() => this.transitionState(readyEvent), soonestMs);
}
```

**Storage integration:**
- After recording completes (state → `"recorded"`): `this.storage.save(this.settings, this.audioHandler.audioBuffer)`
- After delete (state → `"empty"`): `this.storage.save(this.settings, null)`
- Settings are saved whenever the settings modal closes with confirm
- On construction: load from storage and restore state+audio

**Settings update propagation:**
When `onSave` fires from the `SettingsModal`, update both `this.settings` and call
`this.audioHandler.updateSettings(updated)` so trim settings are picked up on the next recording.

---

### 8. `src/settings/settings-modal.ts` *(update)*

Port the full settings form from `main/src/settings.ts` into the `fresh-build` pattern
(template literal + `FormData` on close — no imperative value-setting).

Add the missing sections to the form:

**Audio Trimming section (new):**
- `trimAudio` checkbox
- `trimThreshold` number input (indented)
- `trimAudioLeft` checkbox (indented)
- `trimAudioRight` checkbox (indented)

**Loop Synchronization section (new):**
- `loopSync` checkbox (master toggle)
- `syncThreshold` number input (indented, ms)
- `recordSyncStart` checkbox (indented)
- `recordSyncEnd` checkbox (indented)
- `playSyncStart` checkbox (indented)

**Playback Options section (already present but needs styling):**
- `loopable` checkbox
- `playingPressBehavior` radio: Stop / Restart

Apply the neo-brutalist CSS class names from `styles.css` to all inputs.

---

### 9. `src/index.html` *(rewrite)*

Port the full layout from `main/src/index.html`:
- Header with "LoopPad" title and subtitle
- 9 pad buttons (`id="btn1"` … `id="btn9"`) in a 3×3 grid
- Side panel with: Pad Settings button, Save/Load Project buttons, Clear All Pads button
- `<dialog id="pad-settings-dialog">` for the settings modal
- Link `./styles.css`
- Script tag pointing to `./dist/script.js`

---

### 10. `src/script.ts` *(update)*

Currently only creates 2 pads. Port the full app from `main/src/script.ts`:

```ts
const audioCtx = new AudioContext();
// getUserMedia called ONCE and shared — key improvement over main
const stream = await navigator.mediaDevices.getUserMedia({ audio: { ... } });

const allPads: Pad[] = [];

const padConfigs = [
  { id: "btn1", key: "q" }, { id: "btn2", key: "w" }, { id: "btn3", key: "e" },
  { id: "btn4", key: "a" }, { id: "btn5", key: "s" }, { id: "btn6", key: "d" },
  { id: "btn7", key: "z" }, { id: "btn8", key: "x" }, { id: "btn9", key: "c" },
];

padConfigs.forEach(({ id, key }, i) => {
  allPads.push(new Pad(id, stream, audioCtx, globalState, allPads, key, i));
});
```

**Export/import/clear** — since pads own their own storage, these are coordinated here:
- **Export**: iterate `allPads`, call `pad.exportData()` on each, combine into JSON file download
- **Import**: parse JSON file, call `pad.importData(data)` on each
- **Clear**: iterate `allPads`, call `pad.clearStorage()` on each, then `location.reload()`

---

### 11. `styles.css` *(new file in root, copy from main)*

Copy `main/src/styles.css` verbatim. Already covers:
- Neo-brutalist pad buttons with hover/active transforms
- Recording pulse animation
- Playing progress bar (`::before` pseudo-element)
- Hold-to-delete progress bar (`::after` pseudo-element, `--delete-time` CSS var)
- Waveform bars
- Side panel and control buttons
- Settings dialog (full form styling)
- Responsive breakpoints

One addition needed: styles for `.pad.waiting` state (not in `main` since it had
no waiting states) — probably a subtle border animation to indicate the pad is
waiting for a sync point.

---

## Implementation order

Steps are ordered so each file only depends on things already written:

1. `pad-settings.ts` — pure types, no deps
2. `pad-constants.ts` — pure templates, no deps
3. `pad-state-machine.ts` — depends on `pad-settings.ts`
4. `pad-audio.ts` — depends on `pad-settings.ts`, `pad-state-machine.ts`
5. `pad-storage.ts` — depends on `pad-settings.ts`
6. `pad-view.ts` — depends on `pad-constants.ts`, `pad-state-machine.ts`
7. `pad.ts` — depends on all of the above
8. `settings/settings-modal.ts` — depends on `pad-settings.ts`
9. `styles.css` — no deps
10. `index.html` — depends on all (layout + script reference)
11. `script.ts` — depends on `pad.ts`, `settings/settings-modal.ts`

---

## What is NOT being ported

| Feature | Reason |
|---|---|
| Silence padding on sync record start | Unnecessary with waiting states — recording starts at beat 1 |
| Per-pad `getUserMedia` call | Replaced by single shared stream (already in `fresh-build`, better for browser permissions) |
| `settingsClicked` flag on `AppState` | Replaced by `globalState.settingsPressed` + custom events |
| GitHub Actions deploy workflow | Separate concern, add later |

---

## Open questions / future work

- Should `syncThreshold` still limit which loops are eligible for sync (as in `main`), or should the new waiting-state mechanism sync to whichever loop ends soonest regardless? Currently planning: sync to soonest regardless (simpler, waiting state is the natural boundary).
- The `ToDo.md` mentions **loop drift** — this is not addressed in this migration. It's a timing precision issue that would need a separate investigation.
- **Metronome** (from `ToDo.md`) — not in scope.
- **Record currently-playing loops** (from `ToDo.md`) — not in scope.
