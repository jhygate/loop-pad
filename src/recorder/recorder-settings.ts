export class RecorderSettings {
  public recordSyncStart: boolean;
  public recordSyncEnd: boolean;
  public playingPressBehavior: "stop" | "restart";
  public playSyncStart: boolean;
  public loopable: boolean;

  constructor() {
    this.recordSyncStart = false;
    this.recordSyncEnd = false;
    this.playingPressBehavior = "stop";
    this.playSyncStart = false;
    this.loopable = false;
  }
}
