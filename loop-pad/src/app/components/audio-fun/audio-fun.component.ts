import { Component } from '@angular/core';

@Component({
  selector: 'app-audio-fun',
  imports: [],
  templateUrl: './audio-fun.component.html',
  styleUrl: './audio-fun.component.css',
})
export class AudioFunComponent {
  mediaRecorder!: MediaRecorder;
  chunks: Blob[] = [];
  recordings: { [key: string]: Blob } = {};
  currentId = 0;

  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      const key = `Recording ${++this.currentId}`;
      this.recordings[key] = blob;
    };

    this.mediaRecorder.start();
  }

  stopRecording() {
    this.mediaRecorder.stop();
  }

  playRecording(key: string) {
    const audio = new Audio(URL.createObjectURL(this.recordings[key]));
    audio.play();
  }

  get recordingKeys(): string[] {
    return Object.keys(this.recordings);
  }
}
