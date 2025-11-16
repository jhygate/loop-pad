class RecorderModel {
  recordingState: RecordingState;

  private mediaRecorder: MediaRecorder | null;
  private chunks: BlobPart[];
  private trimmedBuffer: AudioBuffer | null;
  private ctx: AudioContext | null;
  private src: AudioBufferSourceNode | null;

  private silenceDuration: number;
  private endTrim: number;

  startTime: number | undefined;
  loop: boolean;
}
